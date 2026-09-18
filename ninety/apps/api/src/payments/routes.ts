import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { toIsoUtc } from '@ninety/shared';
import { authenticate, requireRole, withBuyerProfile } from '../auth/guards.js';
import { getDb } from '../db/client.js';
import { orders, requests } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { confirmReceipt } from '../logistics/service.js';
import { t } from '../i18n/index.js';

/**
 * Buyer-facing order routes.
 *
 * The breakdown is shown in full — part, delivery, service fee, tax, total — and
 * the authorisation is described in plain words, because "your card is
 * authorised, not charged" is a genuine reassurance and burying it wastes it.
 */
export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/orders/:id', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const buyerId = await withBuyerProfile(req);
    const market = req.ctx.market!;

    const order = (
      await getDb()
        .select()
        .from(orders)
        .where(and(eq(orders.id, params.id), eq(orders.buyerId, buyerId)))
        .limit(1)
    )[0];
    if (!order) throw new AppError('not_found', 'error.not_found');
    const request = (await getDb().select().from(requests).where(eq(requests.id, order.requestId)).limit(1))[0]!;

    return reply.send({
      id: order.id,
      reference: order.reference,
      requestReference: request.reference,
      status: order.status,
      currency: order.currency,
      breakdown: {
        partCents: order.partCents,
        deliveryCents: order.deliveryCents,
        buyerFeeCents: order.buyerFeeCents,
        taxCents: order.taxCents,
        taxLabel: market.tax.label,
        totalCents: order.totalCents,
      },
      // Said plainly, because it is the reassurance the buyer actually needs.
      paymentExplanation: t('notify.buyer.payment_authorised', req.ctx.locale, {
        reference: request.reference,
        total: (order.totalCents / Math.pow(10, market.currencyMinorUnitExponent)).toFixed(market.currencyMinorUnitExponent),
      }),
      authorisedAt: order.authorisedAt === null ? null : toIsoUtc(order.authorisedAt),
      capturedAt: order.capturedAt === null ? null : toIsoUtc(order.capturedAt),
      createdAt: toIsoUtc(order.createdAt),
    });
  });

  app.post('/v1/orders/:id/confirm-receipt', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const buyerId = await withBuyerProfile(req);
    const order = (
      await getDb()
        .select()
        .from(orders)
        .where(and(eq(orders.id, params.id), eq(orders.buyerId, buyerId)))
        .limit(1)
    )[0];
    if (!order) throw new AppError('not_found', 'error.not_found');

    await confirmReceipt(order.requestId, buyerId);
    return reply.send({ status: 'completed' });
  });

  app.get('/v1/orders', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const buyerId = await withBuyerProfile(req);
    const rows = await getDb()
      .select()
      .from(orders)
      .where(eq(orders.buyerId, buyerId))
      .orderBy(desc(orders.createdAt))
      .limit(50);
    return reply.send({
      orders: rows.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        totalCents: o.totalCents,
        currency: o.currency,
        createdAt: toIsoUtc(o.createdAt),
      })),
    });
  });
}
