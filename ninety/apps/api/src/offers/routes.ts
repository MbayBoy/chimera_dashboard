import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, ne } from 'drizzle-orm';
import { OfferStatus, toIsoUtc, type AnonymisableOffer, type OfferSort } from '@ninety/shared';
import { authenticate, requireRole, withBuyerProfile } from '../auth/guards.js';
import { getDb } from '../db/client.js';
import { offers, offerMedia, requests } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { sortOffers, toBuyerViews } from './to-buyer-view.js';
import { transition } from '../state/machine.js';
import { acceptOfferAndAuthorise } from '../payments/service.js';
import { logIdentityAccess } from '../security/audit.js';

/**
 * Buyer-facing offer routes.
 *
 * Every response here is produced by `toBuyerView()`. There is no second path,
 * and adding one would be the leak.
 */
export async function registerBuyerOfferRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/requests/:id/offers', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const query = z
      .object({ sort: z.enum(['price_asc', 'soonest', 'closest', 'warranty_desc']).default('price_asc') })
      .parse(req.query);
    const buyerId = await withBuyerProfile(req);
    const market = req.ctx.market!;

    const request = (
      await getDb()
        .select()
        .from(requests)
        .where(and(eq(requests.id, params.id), eq(requests.buyerId, buyerId)))
        .limit(1)
    )[0];
    if (!request) throw new AppError('not_found', 'error.not_found');

    const rows = await getDb()
      .select()
      .from(offers)
      .where(and(eq(offers.requestId, params.id), ne(offers.status, OfferStatus.WITHDRAWN)));

    // Only the fields the narrowed type permits are read out of the row. The
    // supplier id sitting in `row` is never carried into the serialiser.
    const anonymisable: AnonymisableOffer[] = [];
    for (const row of rows) {
      const media = await getDb().select().from(offerMedia).where(eq(offerMedia.offerId, row.id));
      anonymisable.push({
        id: row.id,
        requestId: row.requestId,
        anonLabel: row.anonLabel,
        priceCents: row.priceCents,
        condition: row.condition as 'used' | 'refurbished' | 'new',
        warrantyDays: row.warrantyDays,
        notes: row.notes,
        distanceKm: Number(row.distanceKm),
        readyInMin: row.readyInMin,
        status: row.status,
        createdAt: row.createdAt,
        media: media
          // An image flagged as a possible visual leak is withheld until a human
          // has cleared it. The offer still stands; only the photo waits.
          .filter((m) => m.leakReviewStatus !== 'pending' && m.leakReviewStatus !== 'blocked')
          .map((m) => ({ url: m.url, kind: m.kind })),
      });
    }

    const views = sortOffers(toBuyerViews(anonymisable, market.currency), query.sort as OfferSort);

    return reply.send({
      requestId: request.id,
      reference: request.reference,
      status: request.status,
      sort: query.sort,
      // Absolute UTC. The client renders the countdown.
      offersDeadline: request.offersDeadline === null ? null : toIsoUtc(request.offersDeadline),
      selectionDeadline: request.selectionDeadline === null ? null : toIsoUtc(request.selectionDeadline),
      serverTime: toIsoUtc(new Date()),
      suppliersNotified: request.fanoutCount,
      offers: views,
    });
  });

  /**
   * Accept an offer.
   *
   * Creates the order and authorises the card. A failed authorisation returns
   * the buyer to the offer list rather than closing the request.
   */
  app.post('/v1/offers/:id/accept', {
    preHandler: [authenticate, requireRole('buyer')],
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
    handler: async (req, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          paymentMethodToken: z.string().min(3).max(200),
          customerRef: z.string().max(200).nullish(),
        })
        .parse(req.body);
      const buyerId = await withBuyerProfile(req);

      const offer = (await getDb().select().from(offers).where(eq(offers.id, params.id)).limit(1))[0];
      if (!offer) throw new AppError('not_found', 'error.not_found');

      // Reading an offer row to find its request touches the supplier id. That
      // access is audited, because every non-admin path that can see identity is.
      await logIdentityAccess({
        actorUserId: req.ctx.actor!.userId,
        actorRole: req.ctx.actor!.role,
        route: '/v1/offers/:id/accept',
        supplierId: offer.supplierId,
        fields: ['supplier_id'],
        allowed: true,
        requestId: req.ctx.requestId,
      });

      const result = await acceptOfferAndAuthorise({
        requestId: offer.requestId,
        offerId: offer.id,
        buyerId,
        paymentMethodToken: body.paymentMethodToken,
        customerRef: body.customerRef ?? null,
      });

      if (result.status === 'authorisation_failed') {
        return reply.status(402).send({
          error: {
            code: 'payment_failed',
            messageKey: 'notify.buyer.payment_failed',
            failureCode: result.failureCode,
          },
          // The offers are still there. Say so in the same response.
          requestStatus: result.requestStatus,
          orderId: result.orderId,
          requestId: req.ctx.requestId,
        });
      }

      return reply.status(201).send({
        orderId: result.orderId,
        reference: result.reference,
        status: result.status,
        requestStatus: result.requestStatus,
        breakdown: result.breakdown,
      });
    },
  });

  /** Decline everything. A legitimate outcome, recorded as one. */
  app.post('/v1/requests/:id/decline-all', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const buyerId = await withBuyerProfile(req);
    const owned = (
      await getDb()
        .select({ id: requests.id })
        .from(requests)
        .where(and(eq(requests.id, params.id), eq(requests.buyerId, buyerId)))
        .limit(1)
    )[0];
    if (!owned) throw new AppError('not_found', 'error.not_found');

    await getDb()
      .update(offers)
      .set({ status: OfferStatus.REJECTED })
      .where(and(eq(offers.requestId, params.id), eq(offers.status, OfferStatus.SUBMITTED)));
    const result = await transition(params.id, 'BUYER_DECLINES_ALL', {
      actorType: 'buyer',
      actorId: buyerId,
      reason: 'buyer declined every offer',
    });
    return reply.send({ status: result.to, outcome: result.outcome });
  });
}

