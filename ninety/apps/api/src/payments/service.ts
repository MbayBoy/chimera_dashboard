import { and, desc, eq } from 'drizzle-orm';
import {
  OfferStatus,
  OrderStatus,
  ORDER_REFERENCE_PREFIX,
  randomReference,
  RequestState,
  toIsoUtc,
  type Cents,
} from '@ninety/shared';
import { getDb } from '../db/client.js';
import { offers, orders, payments, payoutQueue, requests, suppliers } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';
import { marketConfig } from '../market/config.js';
import { transition, transitionIfStillIn } from '../state/machine.js';
import { computeOrderBreakdown, deliveryChargeForBuyer } from './pricing.js';
import { getPaymentProvider } from './provider.js';
import { scheduleTimer, cancelTimer } from '../timers/queue.js';
import { notify, userIdForBuyer, userIdForSupplier } from '../notifications/service.js';
import { supplierConnections, buyerConnections } from '../realtime/hub.js';
import { recordScoreEvent } from '../matching/scoring.js';
import { slaDeadline } from '../core/clock.js';

/**
 * The money path.
 *
 * Authorise on acceptance, capture on delivery, void on failure. Nothing here
 * ever holds a balance on anyone's behalf.
 */

const AUTHORISATION_STALE_HOURS = 48;

export interface AcceptOfferInput {
  readonly requestId: string;
  readonly offerId: string;
  readonly buyerId: string;
  readonly paymentMethodToken: string;
  readonly customerRef?: string | null;
}

export interface AcceptOfferResult {
  readonly orderId: string;
  readonly reference: string;
  readonly status: OrderStatus;
  readonly requestStatus: RequestState;
  readonly breakdown: Record<string, number | string>;
  readonly failureCode?: string;
}

/**
 * Accept an offer and authorise payment.
 *
 * A failed authorisation must NOT close the request. The buyer loses nothing but
 * a moment: their other offers are still open and they can try another card or
 * another yard. Closing here would throw away fifteen minutes of supplier effort
 * because a card was declined.
 */
export async function acceptOfferAndAuthorise(input: AcceptOfferInput): Promise<AcceptOfferResult> {
  const db = getDb();

  const request = (await db.select().from(requests).where(eq(requests.id, input.requestId)).limit(1))[0];
  if (!request) throw new AppError('not_found', 'error.not_found');
  if (request.buyerId !== input.buyerId) throw new AppError('forbidden', 'error.request_not_yours');

  const offer = (
    await db
      .select()
      .from(offers)
      .where(and(eq(offers.id, input.offerId), eq(offers.requestId, input.requestId)))
      .limit(1)
  )[0];
  if (!offer) throw new AppError('not_found', 'error.not_found');
  if (offer.status === OfferStatus.WITHDRAWN) throw new AppError('conflict', 'error.offer_not_available');

  const market = await marketConfig.byId(request.marketId);

  // Delivery is quoted for real in Phase 05's dispatch. At acceptance the buyer
  // is shown an estimate from the parcel class so the total they authorise is
  // the total they pay.
  const { estimateDeliveryCost } = await import('../logistics/service.js');
  const courierEstimate = await estimateDeliveryCost(input.requestId, offer.supplierId);
  const deliveryCents = deliveryChargeForBuyer(courierEstimate.costCents, market);

  const breakdown = computeOrderBreakdown({
    partCents: offer.priceCents,
    deliveryCents,
    market,
  });

  await transition(input.requestId, 'BUYER_ACCEPTS', {
    actorType: 'buyer',
    actorId: input.buyerId,
    reason: `accepted offer ${offer.anonLabel}`,
    patch: { acceptedAt: new Date() },
  });

  const reference = randomReference(ORDER_REFERENCE_PREFIX);
  const inserted = await db
    .insert(orders)
    .values({
      reference,
      requestId: input.requestId,
      offerId: offer.id,
      buyerId: input.buyerId,
      supplierId: offer.supplierId,
      currency: breakdown.currency,
      partCents: breakdown.partCents,
      deliveryCents: breakdown.deliveryCents,
      buyerFeeCents: breakdown.buyerFeeCents,
      taxCents: breakdown.taxCents,
      totalCents: breakdown.totalCents,
      commissionCents: breakdown.commissionCents,
      supplierPayoutCents: breakdown.supplierPayoutCents,
      status: OrderStatus.CREATED,
    })
    .returning({ id: orders.id });
  const orderId = inserted[0]!.id;

  const provider = getPaymentProvider(market.paymentProvider);
  const authorisation = await provider.authorise({
    orderId,
    orderReference: reference,
    amountCents: breakdown.totalCents,
    currency: breakdown.currency,
    method: { token: input.paymentMethodToken, customerRef: input.customerRef ?? null },
    description: `NINETY ${request.reference}`,
    // Derived from the order, so a retried request cannot double-authorise.
    idempotencyKey: `auth:${orderId}`,
  });

  await db.insert(payments).values({
    orderId,
    provider: provider.name,
    providerRef: authorisation.providerRef,
    intent: 'authorisation',
    amountCents: authorisation.amountCents,
    status: authorisation.status,
    failureCode: authorisation.failureCode,
    raw: authorisation.raw as never,
  });

  if (authorisation.status !== 'authorised') {
    await db.update(orders).set({ status: OrderStatus.AUTHORISATION_FAILED }).where(eq(orders.id, orderId));
    await transition(input.requestId, 'PAYMENT_AUTHORISATION_FAILED', {
      actorType: 'system',
      reason: authorisation.failureCode ?? 'authorisation failed',
    });
    // Straight back to the offer list. The request stays alive.
    await transition(input.requestId, 'RETURN_TO_SELECTION', {
      actorType: 'system',
      reason: 'buyer may try another card or another offer',
    });
    await notifyBuyerOf(input.buyerId, 'notify.buyer.payment_failed', { reference: request.reference }, input.requestId);

    return {
      orderId,
      reference,
      status: OrderStatus.AUTHORISATION_FAILED,
      requestStatus: RequestState.COLLECTING_OFFERS,
      breakdown: serialiseBreakdown(breakdown),
      failureCode: authorisation.failureCode ?? 'authorisation_failed',
    };
  }

  await db
    .update(orders)
    .set({ status: OrderStatus.AUTHORISED, authorisedAt: new Date() })
    .where(eq(orders.id, orderId));
  await db.update(offers).set({ status: OfferStatus.ACCEPTED }).where(eq(offers.id, offer.id));
  await db
    .update(offers)
    .set({ status: OfferStatus.REJECTED })
    .where(and(eq(offers.requestId, input.requestId), eq(offers.status, OfferStatus.SUBMITTED)));

  await transition(input.requestId, 'PAYMENT_AUTHORISED', {
    actorType: 'system',
    reason: 'card authorised; funds ring-fenced but not taken',
  });

  // Anything still authorised after two days means something is stuck.
  const staleAt = slaDeadline(new Date(), AUTHORISATION_STALE_HOURS * 60);
  await scheduleTimer(
    { kind: 'authorisation-stale', requestId: input.requestId, orderId, expectedStates: [], dueAt: toIsoUtc(staleAt) },
    staleAt,
  );

  await notifyBuyerOf(
    input.buyerId,
    'notify.buyer.payment_authorised',
    { reference: request.reference, total: formatAmount(breakdown.totalCents, market.currencyMinorUnitExponent) },
    input.requestId,
  );

  // The winning yard, told plainly what they will be paid and how to pack it.
  const supplierUserId = await userIdForSupplier(offer.supplierId);
  if (supplierUserId !== null) {
    await notify({
      userId: supplierUserId,
      channel: 'web_push',
      messageKey: 'notify.supplier.offer_accepted',
      params: {
        reference: request.reference,
        payout: formatAmount(breakdown.supplierPayoutCents, market.currencyMinorUnitExponent),
      },
      requestId: input.requestId,
      orderId,
    });
  }
  supplierConnections.send(offer.supplierId, {
    type: 'offer_accepted',
    requestId: input.requestId,
    orderId,
    reference: request.reference,
    payoutCents: breakdown.supplierPayoutCents,
  });

  // And the yards that did not win, so their terminal does not sit on a dead job.
  const losers = await db
    .select({ supplierId: offers.supplierId })
    .from(offers)
    .where(and(eq(offers.requestId, input.requestId), eq(offers.status, OfferStatus.REJECTED)));
  for (const loser of losers) {
    supplierConnections.send(loser.supplierId, { type: 'offer_lost', requestId: input.requestId, reference: request.reference });
  }

  // Phase 05 takes it from here.
  const { dispatchForOrder } = await import('../logistics/service.js');
  void dispatchForOrder(orderId).catch((err) => {
    log.error('dispatch failed to start', { orderId, err: err instanceof Error ? err.message : String(err) });
  });

  return {
    orderId,
    reference,
    status: OrderStatus.AUTHORISED,
    requestStatus: RequestState.PAYMENT_HELD,
    breakdown: serialiseBreakdown(breakdown),
  };
}

/** Delivery confirmed. Capture, and queue the supplier's payout. */
export async function captureForOrder(orderId: string, reason: string): Promise<void> {
  const db = getDb();
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) throw new AppError('not_found', 'error.not_found');
  if (order.status === OrderStatus.CAPTURED) return; // idempotent
  if (order.status !== OrderStatus.AUTHORISED) {
    throw new AppError('conflict', 'error.illegal_transition', { details: { orderStatus: order.status } });
  }

  const authorisation = await latestPayment(orderId, 'authorisation');
  if (authorisation === null) throw new AppError('internal_error', 'error.internal');

  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;
  const market = await marketConfig.byId(request.marketId);
  const provider = getPaymentProvider(market.paymentProvider);

  const capture = await provider.capture(authorisation.providerRef, order.totalCents, `capture:${orderId}`);

  await db.insert(payments).values({
    orderId,
    provider: provider.name,
    providerRef: capture.providerRef,
    intent: 'capture',
    amountCents: capture.amountCents,
    status: 'captured',
    raw: capture.raw as never,
  });
  await db.update(orders).set({ status: OrderStatus.CAPTURED, capturedAt: new Date() }).where(eq(orders.id, orderId));
  await cancelTimer({ kind: 'authorisation-stale', requestId: order.requestId });

  // Queued, not held. The payout runs from the operating account on a schedule,
  // and is blocked until the supplier's verification is complete.
  const supplier = (await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId)).limit(1))[0];
  const blocked = supplier === undefined || !supplier.verified;
  await db
    .insert(payoutQueue)
    .values({
      supplierId: order.supplierId,
      orderId,
      currency: order.currency,
      amountCents: order.supplierPayoutCents,
      status: blocked ? 'blocked_kyc' : 'queued',
      blockedReason: blocked ? 'supplier verification incomplete' : null,
    })
    .onConflictDoNothing();

  await recordScoreEvent(order.supplierId, 'fulfilled', { requestId: order.requestId, note: reason });

  const supplierUserId = await userIdForSupplier(order.supplierId);
  if (supplierUserId !== null) {
    await notify({
      userId: supplierUserId,
      channel: 'web_push',
      messageKey: 'notify.supplier.payout_queued',
      params: {
        reference: request.reference,
        payout: formatAmount(order.supplierPayoutCents, market.currencyMinorUnitExponent),
      },
      orderId,
    });
  }

  log.info('payment captured', { orderId, amountCents: order.totalCents, reason });
}

/** Delivery failed, or the yard withdrew. Void immediately — never leave a hold. */
export async function voidAuthorisationForOrder(orderId: string, reason: string): Promise<void> {
  const db = getDb();
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) return;
  if (order.status === OrderStatus.VOIDED || order.status === OrderStatus.CAPTURED) return;

  const authorisation = await latestPayment(orderId, 'authorisation');
  if (authorisation === null) return;

  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;
  const market = await marketConfig.byId(request.marketId);
  const provider = getPaymentProvider(market.paymentProvider);

  await provider.void(authorisation.providerRef, `void:${orderId}`);
  await db.insert(payments).values({
    orderId,
    provider: provider.name,
    providerRef: authorisation.providerRef,
    intent: 'void',
    amountCents: order.totalCents,
    status: 'voided',
    raw: { reason } as never,
  });
  await db.update(orders).set({ status: OrderStatus.VOIDED, voidedAt: new Date() }).where(eq(orders.id, orderId));
  await cancelTimer({ kind: 'authorisation-stale', requestId: order.requestId });

  // A held authorisation left to expire shows on the buyer's card for a week.
  log.info('authorisation voided', { orderId, reason });
}

export async function voidAuthorisationForRequest(requestId: string, reason: string): Promise<void> {
  const rows = await getDb()
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.requestId, requestId))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (rows[0]) await voidAuthorisationForOrder(rows[0].id, reason);
  await transitionIfStillIn(requestId, [RequestState.PAYMENT_HELD, RequestState.ACCEPTED], 'BUYER_CANCELS', {
    actorType: 'system',
    reason,
  }).catch(() => undefined);
}

export async function refundOrder(orderId: string, amountCents: Cents, reason: string): Promise<void> {
  const db = getDb();
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) throw new AppError('not_found', 'error.not_found');
  const capture = await latestPayment(orderId, 'capture');
  if (capture === null) throw new AppError('conflict', 'error.illegal_transition');

  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;
  const market = await marketConfig.byId(request.marketId);
  const provider = getPaymentProvider(market.paymentProvider);

  const refund = await provider.refund(capture.providerRef, amountCents, `refund:${orderId}:${amountCents}`);
  await db.insert(payments).values({
    orderId,
    provider: provider.name,
    providerRef: refund.providerRef,
    intent: 'refund',
    amountCents: refund.amountCents,
    status: 'refunded',
    raw: { ...(refund.raw as object), reason } as never,
  });
  await db
    .update(orders)
    .set({ status: amountCents >= order.totalCents ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED })
    .where(eq(orders.id, orderId));

  await notifyBuyerOf(
    order.buyerId,
    'notify.buyer.refund_issued',
    {
      reference: request.reference,
      amount: formatAmount(amountCents, market.currencyMinorUnitExponent),
    },
    order.requestId,
  );
}

/**
 * An authorisation still open after 48 hours.
 *
 * Not an error in itself — it means a delivery is stuck, which is an operational
 * problem someone needs to see before the seven-day window closes on its own.
 */
/**
 * Settle a disputed order, whatever state its money is in.
 *
 * A dispute is usually raised INSTEAD of confirming receipt, which means the
 * card has been authorised and never captured. There is nothing to refund at
 * that point, and the first version of this path threw an illegal-transition
 * error at the admin trying to resolve it — the buyer's complaint would have
 * been stuck behind a payments technicality.
 *
 * So the outcome is expressed as "what the buyer ends up paying", and the route
 * to it depends on where the money already is:
 *
 *   captured  →  refund the difference
 *   authorised, buyer pays nothing  →  void the hold
 *   authorised, buyer pays something  →  capture that amount and no more
 *
 * Money only ever moves in one direction per order, and the total the buyer is
 * charged is the number the admin decided, in minor units, in every branch.
 */
export async function settleDisputedOrder(
  orderId: string,
  buyerPaysCents: Cents,
  reason: string,
): Promise<{ refundedCents: Cents; capturedCents: Cents; voided: boolean }> {
  const db = getDb();
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) throw new AppError('not_found', 'error.not_found');

  const pays = Math.max(0, Math.min(buyerPaysCents, order.totalCents));

  if (order.status === OrderStatus.CAPTURED) {
    const refund = order.totalCents - pays;
    if (refund > 0) await refundOrder(orderId, refund, reason);
    return { refundedCents: refund, capturedCents: pays, voided: false };
  }

  if (order.status !== OrderStatus.AUTHORISED) {
    // Already voided or cancelled: the buyer has been charged nothing and there
    // is nothing left to move. Reporting that honestly beats throwing.
    return { refundedCents: 0, capturedCents: 0, voided: order.status === OrderStatus.VOIDED };
  }

  if (pays === 0) {
    await voidAuthorisationForOrder(orderId, reason);
    return { refundedCents: order.totalCents, capturedCents: 0, voided: true };
  }

  const authorisation = await latestPayment(orderId, 'authorisation');
  if (authorisation === null) throw new AppError('internal_error', 'error.internal');
  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;
  const market = await marketConfig.byId(request.marketId);
  const provider = getPaymentProvider(market.paymentProvider);

  const capture = await provider.capture(authorisation.providerRef, pays, `capture:dispute:${orderId}`);
  await db.insert(payments).values({
    orderId,
    provider: provider.name,
    providerRef: capture.providerRef,
    intent: 'capture',
    amountCents: capture.amountCents,
    status: 'captured',
    raw: capture.raw as never,
  });
  await db.update(orders).set({ status: OrderStatus.CAPTURED, capturedAt: new Date() }).where(eq(orders.id, orderId));
  await cancelTimer({ kind: 'authorisation-stale', requestId: order.requestId });

  log.info('disputed order settled by partial capture', {
    orderId,
    authorisedCents: order.totalCents,
    capturedCents: pays,
    reason,
  });
  return { refundedCents: order.totalCents - pays, capturedCents: pays, voided: false };
}

export async function onStaleAuthorisation(orderId: string): Promise<void> {
  const order = (await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order || order.status !== OrderStatus.AUTHORISED) return;
  const { opsQueue } = await import('../db/schema.js');
  await getDb().insert(opsQueue).values({
    kind: 'stale_authorisation',
    orderId,
    requestId: order.requestId,
    severity: 'high',
    summary: `Authorisation on ${order.reference} has been open for ${AUTHORISATION_STALE_HOURS} hours`,
    detail: { orderId, totalCents: order.totalCents, authorisedAt: order.authorisedAt } as never,
  });
  log.warn('authorisation is stale; escalated to ops', { orderId, reference: order.reference });
}

async function latestPayment(orderId: string, intent: 'authorisation' | 'capture') {
  const rows = await getDb()
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.intent, intent)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (intent === 'authorisation' && row.status !== 'authorised') return null;
  return row;
}

function serialiseBreakdown(breakdown: ReturnType<typeof computeOrderBreakdown>): Record<string, number | string> {
  return {
    partCents: breakdown.partCents,
    deliveryCents: breakdown.deliveryCents,
    buyerFeeCents: breakdown.buyerFeeCents,
    taxCents: breakdown.taxCents,
    totalCents: breakdown.totalCents,
    currency: breakdown.currency,
  };
}

/** Minor units to a plain decimal string, for interpolation into a message. */
function formatAmount(cents: Cents, exponent: number): string {
  return (cents / Math.pow(10, exponent)).toFixed(exponent);
}

async function notifyBuyerOf(
  buyerId: string,
  messageKey: string,
  params: Record<string, string | number>,
  requestId: string,
): Promise<void> {
  const userId = await userIdForBuyer(buyerId);
  if (userId === null) return;
  await notify({ userId, channel: 'push', messageKey, params, requestId });
  buyerConnections.send(buyerId, { type: 'status_changed', requestId, status: messageKey });
}

