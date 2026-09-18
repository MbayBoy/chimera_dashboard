import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { toIsoUtc } from '@ninety/shared';
import { authenticate, requireRole, withBuyerProfile, withSupplierProfile } from '../auth/guards.js';
import { getDb } from '../db/client.js';
import { disputes, disputeEvidence, orders } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { transition } from '../state/machine.js';
import { ingestMedia } from '../media/pipeline.js';
import { log } from '../core/logger.js';

/**
 * Disputes.
 *
 * Either side may raise one. Neither side may resolve one: a dispute can only be
 * closed by an admin, which is enforced here and recorded on the row. A
 * marketplace where the counterparty decides the outcome is not a marketplace
 * with a dispute process.
 */
export async function registerDisputeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/orders/:id/dispute', { preHandler: [authenticate] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        reason: z.enum(['wrong_part', 'damaged', 'not_as_described', 'not_delivered', 'not_collected', 'other']),
        description: z.string().trim().max(1000).optional(),
      })
      .parse(req.body);

    const actor = req.ctx.actor!;
    if (actor.role === 'admin') throw new AppError('forbidden', 'error.role_not_permitted');

    const order = (await getDb().select().from(orders).where(eq(orders.id, params.id)).limit(1))[0];
    if (!order) throw new AppError('not_found', 'error.not_found');

    let raisedBy: 'buyer' | 'supplier';
    if (actor.role === 'buyer') {
      const buyerId = await withBuyerProfile(req);
      if (order.buyerId !== buyerId) throw new AppError('forbidden', 'error.request_not_yours');
      raisedBy = 'buyer';
    } else {
      const supplierId = await withSupplierProfile(req);
      if (order.supplierId !== supplierId) throw new AppError('forbidden', 'error.request_not_yours');
      raisedBy = 'supplier';
    }

    const existing = (
      await getDb()
        .select({ id: disputes.id })
        .from(disputes)
        .where(and(eq(disputes.orderId, params.id), eq(disputes.status, 'open')))
        .limit(1)
    )[0];
    if (existing) return reply.status(200).send({ disputeId: existing.id, alreadyOpen: true });

    const inserted = await getDb()
      .insert(disputes)
      .values({
        orderId: params.id,
        raisedBy,
        raisedByUserId: actor.userId,
        reason: body.reason,
        description: body.description ?? null,
        status: 'open',
      })
      .returning({ id: disputes.id });

    await transition(order.requestId, 'BUYER_DISPUTES', {
      actorType: raisedBy,
      actorId: actor.userId,
      reason: body.reason,
    }).catch((err) => {
      // A dispute raised after the request closed is still a valid dispute; the
      // state machine simply has nothing to move.
      log.info('dispute raised on a request that had already settled', { orderId: params.id, err: String(err) });
    });

    log.info('dispute opened', { disputeId: inserted[0]!.id, orderId: params.id, raisedBy, reason: body.reason });
    return reply.status(201).send({ disputeId: inserted[0]!.id, alreadyOpen: false });
  });

  app.post('/v1/disputes/:id/evidence', { preHandler: [authenticate] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const actor = req.ctx.actor!;

    const dispute = (await getDb().select().from(disputes).where(eq(disputes.id, params.id)).limit(1))[0];
    if (!dispute) throw new AppError('not_found', 'error.not_found');
    const order = (await getDb().select().from(orders).where(eq(orders.id, dispute.orderId)).limit(1))[0]!;

    // Both sides may add evidence to a dispute that concerns them.
    if (actor.role === 'buyer') {
      const buyerId = await withBuyerProfile(req);
      if (order.buyerId !== buyerId) throw new AppError('forbidden', 'error.forbidden');
    } else if (actor.role === 'supplier') {
      const supplierId = await withSupplierProfile(req);
      if (order.supplierId !== supplierId) throw new AppError('forbidden', 'error.forbidden');
    }

    const file = await req.file();
    if (file === undefined) throw new AppError('validation_failed', 'error.media_type_not_allowed');
    const ingested = await ingestMedia(await file.toBuffer(), { contentType: file.mimetype });

    const inserted = await getDb()
      .insert(disputeEvidence)
      .values({
        disputeId: params.id,
        uploadedBy: actor.userId,
        url: ingested.url,
        storageKey: ingested.key,
        kind: ingested.kind,
      })
      .returning({ id: disputeEvidence.id });
    return reply.status(201).send({ id: inserted[0]!.id, url: ingested.url });
  });

  app.get('/v1/disputes', { preHandler: [authenticate] }, async (req, reply) => {
    const actor = req.ctx.actor!;
    const rows =
      actor.role === 'buyer'
        ? await getDb()
            .select({ dispute: disputes, order: orders })
            .from(disputes)
            .innerJoin(orders, eq(orders.id, disputes.orderId))
            .where(eq(orders.buyerId, await withBuyerProfile(req)))
            .orderBy(desc(disputes.createdAt))
        : await getDb()
            .select({ dispute: disputes, order: orders })
            .from(disputes)
            .innerJoin(orders, eq(orders.id, disputes.orderId))
            .where(eq(orders.supplierId, await withSupplierProfile(req)))
            .orderBy(desc(disputes.createdAt));

    return reply.send({
      disputes: rows.map((r) => ({
        id: r.dispute.id,
        orderReference: r.order.reference,
        reason: r.dispute.reason,
        status: r.dispute.status,
        resolution: r.dispute.resolution,
        raisedBy: r.dispute.raisedBy,
        createdAt: toIsoUtc(r.dispute.createdAt),
      })),
    });
  });

  /**
   * Resolution is admin-only, deliberately.
   *
   * This route exists on the non-admin surface solely to refuse, and to say why,
   * rather than 404ing and leaving the counterparty wondering.
   */
  app.post('/v1/disputes/:id/resolve', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        outcome: z.enum(['upheld_refund', 'upheld_partial_refund', 'rejected']),
        resolution: z.string().trim().min(3).max(1000),
        refundCents: z.number().int().min(0).optional(),
      })
      .parse(req.body);

    const { resolveDispute } = await import('./service.js');
    const result = await resolveDispute(params.id, {
      adminUserId: req.ctx.actor!.userId,
      outcome: body.outcome,
      resolution: body.resolution,
      refundCents: body.refundCents ?? 0,
    });
    return reply.send(result);
  });
}
