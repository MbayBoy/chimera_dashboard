import { eq } from 'drizzle-orm';
import { RequestState, type Cents } from '@ninety/shared';
import { getDb } from '../db/client.js';
import { disputes, orders, requests, users } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';
import { transitionIfStillIn } from '../state/machine.js';
import { refundOrder } from '../payments/service.js';
import { recordScoreEvent } from '../matching/scoring.js';
import { notify, userIdForBuyer, userIdForSupplier } from '../notifications/service.js';

/**
 * Dispute resolution.
 *
 * Only an admin resolves. The rule is enforced twice on purpose: the route is
 * admin-guarded, and this function refuses a resolver who is a party to the
 * order even if they somehow hold an admin role. A dispute resolved by the
 * counterparty is worse than no dispute process, because it looks like one.
 */

export interface ResolveInput {
  readonly adminUserId: string;
  readonly outcome: 'upheld_refund' | 'upheld_partial_refund' | 'rejected';
  readonly resolution: string;
  readonly refundCents: Cents;
}

export interface ResolveResult {
  readonly disputeId: string;
  readonly status: string;
  readonly refundedCents: number;
}

export async function resolveDispute(disputeId: string, input: ResolveInput): Promise<ResolveResult> {
  const db = getDb();
  const dispute = (await db.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1))[0];
  if (!dispute) throw new AppError('not_found', 'error.not_found');
  if (dispute.status === 'resolved' || dispute.status === 'rejected') {
    return { disputeId, status: dispute.status, refundedCents: dispute.refundCents ?? 0 };
  }

  const order = (await db.select().from(orders).where(eq(orders.id, dispute.orderId)).limit(1))[0];
  if (!order) throw new AppError('not_found', 'error.not_found');

  // The counterparty check, independent of the route guard.
  const resolver = (await db.select().from(users).where(eq(users.id, input.adminUserId)).limit(1))[0];
  if (!resolver || resolver.role !== 'admin') {
    throw new AppError('forbidden', 'error.dispute_counterparty_cannot_resolve');
  }
  const { buyers, suppliers } = await import('../db/schema.js');
  const resolverBuyer = (await db.select({ id: buyers.id }).from(buyers).where(eq(buyers.userId, input.adminUserId)).limit(1))[0];
  const resolverSupplier = (
    await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.userId, input.adminUserId)).limit(1)
  )[0];
  if (resolverBuyer?.id === order.buyerId || resolverSupplier?.id === order.supplierId) {
    throw new AppError('forbidden', 'error.dispute_counterparty_cannot_resolve');
  }

  const refundCents =
    input.outcome === 'upheld_refund'
      ? order.totalCents
      : input.outcome === 'upheld_partial_refund'
        ? Math.min(input.refundCents, order.totalCents)
        : 0;

  if (refundCents > 0) {
    await refundOrder(order.id, refundCents, `dispute ${disputeId}: ${input.resolution}`);
  }

  await db
    .update(disputes)
    .set({
      status: input.outcome === 'rejected' ? 'rejected' : 'resolved',
      resolution: input.resolution,
      refundCents,
      resolvedBy: input.adminUserId,
      resolvedAt: new Date(),
    })
    .where(eq(disputes.id, disputeId));

  // The score effect. A dispute upheld against a yard costs them; one that was
  // rejected costs them nothing, because being complained about is not the same
  // as being at fault.
  if (input.outcome !== 'rejected' && dispute.raisedBy === 'buyer') {
    await recordScoreEvent(order.supplierId, 'disputed', {
      requestId: order.requestId,
      note: `dispute upheld: ${dispute.reason}`,
    });
  }

  await transitionIfStillIn(
    order.requestId,
    [RequestState.DISPUTED],
    refundCents >= order.totalCents ? 'DISPUTE_RESOLVED_REFUND' : 'DISPUTE_RESOLVED_COMPLETE',
    { actorType: 'admin', actorId: input.adminUserId, reason: input.resolution },
  );

  const request = (await db.select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0];
  const buyerUserId = await userIdForBuyer(order.buyerId);
  if (buyerUserId !== null) {
    await notify({
      userId: buyerUserId,
      channel: 'push',
      messageKey: 'notify.buyer.dispute_resolved',
      params: { reference: request?.reference ?? '', resolution: input.resolution },
      orderId: order.id,
    });
  }
  const supplierUserId = await userIdForSupplier(order.supplierId);
  if (supplierUserId !== null) {
    await notify({
      userId: supplierUserId,
      channel: 'web_push',
      messageKey: 'notify.supplier.dispute_opened',
      params: { reference: request?.reference ?? '' },
      orderId: order.id,
    });
  }

  log.info('dispute resolved', { disputeId, outcome: input.outcome, refundCents, adminUserId: input.adminUserId });
  return { disputeId, status: input.outcome === 'rejected' ? 'rejected' : 'resolved', refundedCents: refundCents };
}

/** Whether a given user is a party to the order behind a dispute. */
export async function isCounterparty(disputeId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const dispute = (await db.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1))[0];
  if (!dispute) return false;
  const order = (await db.select().from(orders).where(eq(orders.id, dispute.orderId)).limit(1))[0];
  if (!order) return false;
  const { buyers, suppliers } = await import('../db/schema.js');
  const asBuyer = (await db.select({ id: buyers.id }).from(buyers).where(eq(buyers.userId, userId)).limit(1))[0];
  const asSupplier = (await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.userId, userId)).limit(1))[0];
  return asBuyer?.id === order.buyerId || asSupplier?.id === order.supplierId;
}
