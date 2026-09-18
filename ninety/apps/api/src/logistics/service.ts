import { and, desc, eq } from 'drizzle-orm';
import {
  addMinutes,
  DeliveryStatus,
  isPeak,
  parcelClassForCategoryCode,
  RequestState,
  toIsoUtc,
  type Cents,
  type ParcelClass,
  type Quote,
} from '@ninety/shared';
import { getDb, getSql } from '../db/client.js';
import { deliveries, deliveryQuotes, offers, opsQueue, orders, requests } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';
import { marketConfig } from '../market/config.js';
import { couriersForMarket, type CourierProvider, type GeoPoint } from './provider.js';
import { transition, transitionIfStillIn } from '../state/machine.js';
import { scheduleTimer, cancelTimer } from '../timers/queue.js';
import { notify, userIdForBuyer, userIdForSupplier } from '../notifications/service.js';
import { buyerConnections } from '../realtime/hub.js';
import { captureForOrder, voidAuthorisationForOrder } from '../payments/service.js';

/**
 * Logistics.
 *
 * Quote every available provider in parallel, pick on ETA first and price
 * second, dispatch, and fail over to the next provider if no driver is assigned
 * within five minutes. When all of them fail, a human picks it up and the buyer
 * is told honestly with a revised ETA.
 *
 * Selecting on price rather than ETA looks reasonable and breaks the only thing
 * that differentiates this product. The promise is speed.
 */

const NO_DRIVER_TIMEOUT_MINUTES = 5;

/** Parcel class from the part category. Data, not a heuristic in code. */
export async function parcelClassForRequest(requestId: string): Promise<ParcelClass> {
  const rows = await getSql()<{ parcel_class: string | null; code: string | null }[]>`
    SELECT pc.parcel_class, pc.code
      FROM requests r LEFT JOIN part_categories pc ON pc.id = r.part_category_id
     WHERE r.id = ${requestId}
  `;
  const row = rows[0];
  if (row?.parcel_class != null) return row.parcel_class as ParcelClass;
  if (row?.code != null) return parcelClassForCategoryCode(row.code);
  return 'car';
}

async function locations(requestId: string, supplierId: string): Promise<{ pickup: GeoPoint; dropoff: GeoPoint }> {
  const rows = await getSql()<{ p_lat: number; p_lng: number; d_lat: number; d_lng: number }[]>`
    SELECT ST_Y(s.location::geometry) AS p_lat, ST_X(s.location::geometry) AS p_lng,
           ST_Y(r.delivery_location::geometry) AS d_lat, ST_X(r.delivery_location::geometry) AS d_lng
      FROM suppliers s, requests r
     WHERE s.id = ${supplierId} AND r.id = ${requestId}
  `;
  const row = rows[0];
  if (row === undefined) throw new AppError('not_found', 'error.not_found');
  return { pickup: { lat: row.p_lat, lng: row.p_lng }, dropoff: { lat: row.d_lat, lng: row.d_lng } };
}

/**
 * An estimate for the acceptance screen.
 *
 * The buyer authorises a total, so the delivery line has to be right before the
 * courier is booked. Uses the cheapest live quote, falling back to the manual
 * placeholder if nobody answers.
 */
export async function estimateDeliveryCost(
  requestId: string,
  supplierId: string,
): Promise<{ costCents: Cents; etaMinutes: number; parcel: ParcelClass }> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request) throw new AppError('not_found', 'error.not_found');
  const market = await marketConfig.byId(request.marketId);
  const parcel = await parcelClassForRequest(requestId);
  const { pickup, dropoff } = await locations(requestId, supplierId);

  const providers = couriersForMarket(market.courierProviders);
  const quotes = await quoteAll(providers, { pickup, dropoff, parcel, currency: market.currency });
  const best = pickBestQuote(quotes);
  if (best === null) {
    return { costCents: 3000, etaMinutes: market.sla.deliveryMin, parcel };
  }
  return { costCents: best.priceCents, etaMinutes: best.etaMinutes, parcel };
}

/** Quote everyone at once. A provider that errors simply does not compete. */
async function quoteAll(
  providers: readonly CourierProvider[],
  request: { pickup: GeoPoint; dropoff: GeoPoint; parcel: ParcelClass; currency: string },
): Promise<{ quote: Quote | null; provider: string; error: string | null }[]> {
  const settled = await Promise.allSettled(providers.map((p) => p.quote(request)));
  return settled.map((result, i) => ({
    provider: providers[i]!.name,
    quote: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? String(result.reason instanceof Error ? result.reason.message : result.reason) : null,
  }));
}

/**
 * ETA first, price second.
 *
 * Deliberately not the cheapest. The promise this product sells is speed, and a
 * courier chosen on price is a courier chosen on the wrong axis.
 */
export function pickBestQuote(results: readonly { quote: Quote | null }[]): Quote | null {
  const quotes = results.map((r) => r.quote).filter((q): q is Quote => q !== null);
  if (quotes.length === 0) return null;
  return quotes.sort((a, b) => a.etaMinutes - b.etaMinutes || a.priceCents - b.priceCents)[0]!;
}

/** Book a courier for an order, with failover behind it. */
export async function dispatchForOrder(orderId: string, attempt = 1): Promise<void> {
  const db = getDb();
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) return;
  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0];
  if (!request) return;

  const market = await marketConfig.byId(request.marketId);
  const parcel = await parcelClassForRequest(order.requestId);
  const { pickup, dropoff } = await locations(order.requestId, order.supplierId);

  const alreadyTried = new Set(
    (await db.select({ provider: deliveries.provider }).from(deliveries).where(eq(deliveries.orderId, orderId))).map(
      (r) => r.provider,
    ),
  );
  const providers = couriersForMarket(market.courierProviders).filter((p) => !alreadyTried.has(p.name));

  if (providers.length === 0) {
    await escalateToOps(order.id, order.requestId, 'every courier provider has been tried');
    return;
  }

  const automatic = providers.filter((p) => p.automatic);
  const results = await quoteAll(automatic, { pickup, dropoff, parcel, currency: market.currency });

  // Every quote is recorded, winner or not. Without this there is no way to tell
  // whether courier margin is real, and it is one of four revenue lines.
  if (results.length > 0) {
    await db.insert(deliveryQuotes).values(
      results.map((r) => ({
        orderId,
        provider: r.provider,
        parcelClass: parcel,
        priceCents: r.quote?.priceCents ?? null,
        etaMinutes: r.quote?.etaMinutes ?? null,
        selected: false,
        error: r.error,
      })),
    );
  }

  const best = pickBestQuote(results);
  if (best === null) {
    const manual = providers.find((p) => !p.automatic);
    if (manual === undefined) {
      await escalateToOps(order.id, order.requestId, 'no courier quoted and no manual fallback configured');
      return;
    }
    await escalateToOps(order.id, order.requestId, 'no automatic courier quoted');
    return;
  }

  await db
    .update(deliveryQuotes)
    .set({ selected: true })
    .where(and(eq(deliveryQuotes.orderId, orderId), eq(deliveryQuotes.provider, best.provider)));

  const provider = providers.find((p) => p.name === best.provider)!;
  const supplierAddress = await pickupInstructionsFor(order.supplierId);

  let ref;
  try {
    ref = await provider.dispatch({
      orderId,
      orderReference: order.reference,
      pickup,
      dropoff,
      parcel,
      // The driver gets the yard's address. The buyer never does.
      pickupInstructions: supplierAddress,
      dropoffInstructions: 'Deliver to the pin. NINETY packaging only.',
    });
  } catch (err) {
    log.warn('courier dispatch failed; failing over', {
      orderId,
      provider: provider.name,
      err: err instanceof Error ? err.message : String(err),
    });
    await db.insert(deliveries).values({
      orderId,
      provider: provider.name,
      status: DeliveryStatus.FAILED,
      parcelClass: parcel,
      pickupLocation: { lng: pickup.lng, lat: pickup.lat },
      dropoffLocation: { lng: dropoff.lng, lat: dropoff.lat },
      quotedCents: best.priceCents,
      quotedEtaMin: best.etaMinutes,
      attempt,
      failureReason: err instanceof Error ? err.message : String(err),
    });
    await dispatchForOrder(orderId, attempt + 1);
    return;
  }

  const now = new Date();
  const inserted = await db
    .insert(deliveries)
    .values({
      orderId,
      provider: ref.provider,
      providerRef: ref.providerRef,
      status: DeliveryStatus.DISPATCHED,
      parcelClass: parcel,
      pickupLocation: { lng: pickup.lng, lat: pickup.lat },
      dropoffLocation: { lng: dropoff.lng, lat: dropoff.lat },
      quotedCents: best.priceCents,
      quotedEtaMin: best.etaMinutes,
      attempt,
      dispatchedAt: now,
      wasPeak: isPeak(now, market.timezone, market.businessCalendar.weekendDays),
    })
    .returning({ id: deliveries.id });
  const deliveryId = inserted[0]!.id;

  const deliveryDeadline = addMinutes(request.acceptedAt ?? now, market.sla.deliveryMin);
  await db.update(orders).set({ courierCostCents: best.priceCents }).where(eq(orders.id, orderId));
  await transitionIfStillIn(order.requestId, [RequestState.PAYMENT_HELD], 'COURIER_BOOKED', {
    actorType: 'system',
    reason: `dispatched via ${ref.provider}`,
    patch: { deliveryDeadline },
  });

  // Five minutes without a driver and we move on. Provider failure is routine.
  const failoverAt = addMinutes(now, NO_DRIVER_TIMEOUT_MINUTES);
  await scheduleTimer(
    {
      kind: 'courier-no-driver',
      requestId: order.requestId,
      orderId,
      deliveryId,
      expectedStates: [RequestState.DISPATCHED],
      dueAt: toIsoUtc(failoverAt),
    },
    failoverAt,
  );
  await scheduleTimer(
    {
      kind: 'delivery-deadline',
      requestId: order.requestId,
      orderId,
      expectedStates: [RequestState.DISPATCHED, RequestState.IN_TRANSIT],
      dueAt: toIsoUtc(deliveryDeadline),
    },
    deliveryDeadline,
  );

  await notifyBuyer(order.buyerId, order.requestId, 'notify.buyer.courier_assigned', {
    reference: request.reference,
    eta: toIsoUtc(addMinutes(now, best.etaMinutes)),
  });
  const supplierUserId = await userIdForSupplier(order.supplierId);
  if (supplierUserId !== null) {
    await notify({
      userId: supplierUserId,
      channel: 'web_push',
      messageKey: 'notify.supplier.driver_eta',
      params: { reference: request.reference, eta: toIsoUtc(addMinutes(now, Math.round(best.etaMinutes / 2))) },
      orderId,
    });
  }

  log.info('courier dispatched', { orderId, deliveryId, provider: ref.provider, etaMinutes: best.etaMinutes, parcel });
}

/** Five minutes, no driver. Cancel and fail over. */
export async function onNoDriverAssigned(deliveryId: string): Promise<void> {
  const db = getDb();
  const delivery = (await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1))[0];
  if (!delivery) return;
  if (delivery.status !== DeliveryStatus.DISPATCHED) return;

  const provider = couriersForMarket([delivery.provider])[0];
  if (provider !== undefined && delivery.providerRef !== null) {
    try {
      const status = await provider.track(delivery.providerRef);
      if (status.driverAssigned) {
        await db
          .update(deliveries)
          .set({ status: DeliveryStatus.DRIVER_ASSIGNED, driverAssignedAt: new Date() })
          .where(eq(deliveries.id, deliveryId));
        return;
      }
      await provider.cancel(delivery.providerRef).catch(() => {});
    } catch (err) {
      log.warn('could not check driver assignment', { deliveryId, err: err instanceof Error ? err.message : String(err) });
    }
  }

  await db
    .update(deliveries)
    .set({ status: DeliveryStatus.FAILED, failureReason: `no driver assigned within ${NO_DRIVER_TIMEOUT_MINUTES} minutes` })
    .where(eq(deliveries.id, deliveryId));

  log.warn('courier failed to assign a driver; failing over', { deliveryId, provider: delivery.provider });
  await transitionIfStillIn(
    (await db.select({ requestId: orders.requestId }).from(orders).where(eq(orders.id, delivery.orderId)).limit(1))[0]!.requestId,
    [RequestState.DISPATCHED],
    'COURIER_FAILED',
    { actorType: 'timer', reason: 'no driver assigned' },
  ).catch(() => undefined);
  await dispatchForOrder(delivery.orderId, delivery.attempt + 1);
}

/** Courier reports collection. */
export async function markCollected(deliveryId: string): Promise<void> {
  const db = getDb();
  const delivery = (await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1))[0];
  if (!delivery) throw new AppError('not_found', 'error.not_found');
  await db
    .update(deliveries)
    .set({ status: DeliveryStatus.COLLECTED, collectedAt: new Date() })
    .where(eq(deliveries.id, deliveryId));
  await cancelTimer({ kind: 'courier-no-driver', requestId: delivery.orderId });

  const order = (await db.select().from(orders).where(eq(orders.id, delivery.orderId)).limit(1))[0]!;
  await transitionIfStillIn(order.requestId, [RequestState.DISPATCHED], 'COURIER_COLLECTED', {
    actorType: 'system',
    reason: 'courier collected the part',
  });
  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;
  await notifyBuyer(order.buyerId, order.requestId, 'notify.buyer.courier_collected', { reference: request.reference });
  buyerConnections.send(order.buyerId, { type: 'courier_collected', requestId: order.requestId });
}

/** Courier reports delivery. Starts the 24-hour auto-confirm clock. */
export async function markDelivered(deliveryId: string, proofUrl: string | null, actualCents: Cents | null): Promise<void> {
  const db = getDb();
  const delivery = (await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1))[0];
  if (!delivery) throw new AppError('not_found', 'error.not_found');

  const now = new Date();
  await db
    .update(deliveries)
    .set({ status: DeliveryStatus.DELIVERED, deliveredAt: now, proofUrl, actualCents })
    .where(eq(deliveries.id, deliveryId));

  const order = (await db.select().from(orders).where(eq(orders.id, delivery.orderId)).limit(1))[0]!;
  if (actualCents !== null) {
    // Quoted versus actual, both stored. Without the pair there is no way to
    // tell whether courier margin is real.
    await db.update(orders).set({ courierCostCents: actualCents }).where(eq(orders.id, order.id));
  }

  await transitionIfStillIn(order.requestId, [RequestState.IN_TRANSIT, RequestState.DISPATCHED], 'COURIER_DELIVERED', {
    actorType: 'system',
    reason: 'courier delivered',
    patch: { deliveredAt: now },
  });

  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;
  const windows = await marketConfig.windows(request.marketId);
  const autoConfirmAt = addMinutes(now, windows.autoConfirmHours * 60);
  await scheduleTimer(
    {
      kind: 'auto-confirm',
      requestId: order.requestId,
      orderId: order.id,
      expectedStates: [RequestState.DELIVERED],
      dueAt: toIsoUtc(autoConfirmAt),
    },
    autoConfirmAt,
  );

  await notifyBuyer(order.buyerId, order.requestId, 'notify.buyer.delivered', { reference: request.reference });
  buyerConnections.send(order.buyerId, { type: 'delivered', requestId: order.requestId });
}

/** Delivery failed. Void immediately rather than leaving a hold on the card. */
export async function markDeliveryFailed(deliveryId: string, reason: string): Promise<void> {
  const db = getDb();
  const delivery = (await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1))[0];
  if (!delivery) throw new AppError('not_found', 'error.not_found');

  await db
    .update(deliveries)
    .set({ status: DeliveryStatus.FAILED, failureReason: reason })
    .where(eq(deliveries.id, deliveryId));

  const order = (await db.select().from(orders).where(eq(orders.id, delivery.orderId)).limit(1))[0]!;
  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;

  await transitionIfStillIn(order.requestId, [RequestState.DISPATCHED, RequestState.IN_TRANSIT], 'COURIER_FAILED', {
    actorType: 'system',
    reason,
  });

  // The part physically exists and is in a van somewhere. That is an operations
  // problem, and the yard did nothing wrong — they are not penalised for it.
  const collected = delivery.collectedAt !== null;
  await escalateToOps(
    order.id,
    order.requestId,
    collected ? `courier failed AFTER collection: ${reason}` : `courier failed before collection: ${reason}`,
    collected ? 'critical' : 'high',
  );

  await voidAuthorisationForOrder(order.id, `delivery failed: ${reason}`);
  await notifyBuyer(
    order.buyerId,
    order.requestId,
    collected ? 'notify.buyer.courier_failed_after_collection' : 'notify.buyer.delivery_failed',
    { reference: request.reference },
  );
  buyerConnections.send(order.buyerId, { type: 'delivery_failed', requestId: order.requestId });
}

/** The buyer confirms. This is what captures the money. */
export async function confirmReceipt(requestId: string, buyerId: string): Promise<void> {
  const db = getDb();
  const order = (
    await db
      .select()
      .from(orders)
      .where(and(eq(orders.requestId, requestId), eq(orders.buyerId, buyerId)))
      .orderBy(desc(orders.createdAt))
      .limit(1)
  )[0];
  if (!order) throw new AppError('not_found', 'error.not_found');

  await transition(requestId, 'BUYER_CONFIRMS_RECEIPT', { actorType: 'buyer', actorId: buyerId, reason: 'buyer confirmed receipt' });
  await captureForOrder(order.id, 'buyer confirmed receipt');
  await cancelTimer({ kind: 'auto-confirm', requestId });
  await transitionIfStillIn(requestId, [RequestState.COMPLETED], 'CLOSE', { actorType: 'system' });
}

/** Twenty-four hours of silence. Auto-confirm, and say so. */
export async function autoConfirmDelivery(requestId: string): Promise<void> {
  const result = await transitionIfStillIn(requestId, [RequestState.DELIVERED], 'AUTO_CONFIRM', {
    actorType: 'timer',
    reason: 'auto-confirmed after the configured silence window',
  });
  if (result === null) return;

  const order = (
    await getDb().select().from(orders).where(eq(orders.requestId, requestId)).orderBy(desc(orders.createdAt)).limit(1)
  )[0];
  if (!order) return;
  await captureForOrder(order.id, 'auto-confirmed after 24 hours');
  await transitionIfStillIn(requestId, [RequestState.COMPLETED], 'CLOSE', { actorType: 'timer' });

  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0]!;
  const market = await marketConfig.byId(request.marketId);
  await notifyBuyer(order.buyerId, requestId, 'notify.buyer.auto_confirmed', {
    reference: request.reference,
    total: (order.totalCents / Math.pow(10, market.currencyMinorUnitExponent)).toFixed(market.currencyMinorUnitExponent),
  });
}

/** The 90-minute deadline passed and it is not there yet. Tell the buyer. */
export async function onDeliveryDeadline(requestId: string): Promise<void> {
  const db = getDb();
  const request = (await db.select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request) return;
  if (request.status !== RequestState.DISPATCHED && request.status !== RequestState.IN_TRANSIT) return;

  const order = (
    await db.select().from(orders).where(eq(orders.requestId, requestId)).orderBy(desc(orders.createdAt)).limit(1)
  )[0];
  if (!order) return;

  // The promise is "typically 90 minutes, up to 3 hours in peak traffic". Late
  // is not a silent event: the buyer is told, with a revised time, and is not
  // charged more for it.
  await notifyBuyer(order.buyerId, requestId, 'notify.buyer.delivery_delayed', {
    reference: request.reference,
    eta: toIsoUtc(addMinutes(new Date(), 30)),
  });
  await escalateToOps(order.id, requestId, 'delivery has passed the market SLA', 'high');
}

/** The yard says it is packed. */
export async function markPackedAndReady(orderId: string, supplierId: string): Promise<void> {
  const order = (
    await getDb()
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.supplierId, supplierId)))
      .limit(1)
  )[0];
  if (!order) throw new AppError('not_found', 'error.not_found');
  await getDb()
    .update(offers)
    .set({ status: 'accepted' })
    .where(eq(offers.id, order.offerId));
  log.info('supplier marked an order packed and ready', { orderId, supplierId });
}

async function pickupInstructionsFor(supplierId: string): Promise<string> {
  const rows = await getSql()<{ business_name: string; address: Record<string, unknown> }[]>`
    SELECT business_name, address FROM suppliers WHERE id = ${supplierId}
  `;
  const row = rows[0];
  if (row === undefined) return 'Collect from the pin.';
  // This string reaches the DRIVER only. It never appears in any buyer-facing
  // payload — that is enforced by the tracking serialiser and tested.
  return `${row.business_name} — ${JSON.stringify(row.address)}`;
}

async function escalateToOps(
  orderId: string,
  requestId: string,
  summary: string,
  severity: 'normal' | 'high' | 'critical' = 'high',
): Promise<void> {
  await getDb().insert(opsQueue).values({
    kind: 'courier_escalation',
    orderId,
    requestId,
    severity,
    summary,
    detail: { at: new Date().toISOString() } as never,
  });

  const order = (await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (order !== undefined && request !== undefined) {
    // Told honestly, with a revised ETA. A buyer being told is what protects the
    // relationship; a request that goes quiet is what ends it.
    await notifyBuyer(order.buyerId, requestId, 'notify.buyer.courier_all_failed', {
      reference: request.reference,
      eta: toIsoUtc(addMinutes(new Date(), 60)),
    });
  }
  log.warn('escalated to the ops queue', { orderId, requestId, summary, severity });
}

async function notifyBuyer(
  buyerId: string,
  requestId: string,
  messageKey: string,
  params: Record<string, string | number>,
): Promise<void> {
  const userId = await userIdForBuyer(buyerId);
  if (userId === null) return;
  await notify({ userId, channel: 'push', messageKey, params, requestId });
}

