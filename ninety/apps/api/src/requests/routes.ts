import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { LIVE_STATES, RequestState, toIsoUtc } from '@ninety/shared';
import { authenticate, requireRole, withBuyerProfile } from '../auth/guards.js';
import { getDb, getSql } from '../db/client.js';
import { orders, partCategories, requests, requestMedia, vehicles } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { createRequest, requestCounts } from './service.js';
import { transition } from '../state/machine.js';
import { languageOf, t } from '../i18n/index.js';

/**
 * Buyer-facing request routes.
 *
 * Every deadline in a response is an absolute UTC timestamp. The client renders
 * the countdown by subtracting from its own clock — the API never sends "minutes
 * remaining", because a device with a wrong system clock must not be able to
 * argue about the fifteen minutes.
 */

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const vehicleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('catalogue'), vehicleId: z.string().uuid() }),
  z.object({
    kind: z.literal('manual'),
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(60),
    year: z.number().int().min(1950).max(2100),
    variant: z.string().trim().max(60).nullish(),
  }),
  z.object({
    kind: z.literal('identifier'),
    identifier: z.string().trim().min(3).max(32),
    make: z.string().trim().min(1).max(60).optional(),
    model: z.string().trim().min(1).max(60).optional(),
    year: z.number().int().min(1950).max(2100).optional(),
  }),
]);

const createBody = z.object({
  vehicle: vehicleSchema,
  partCategoryId: z.string().uuid().nullable().default(null),
  partDescription: z.string().trim().min(2).max(400),
  conditionAccepted: z.array(z.enum(['used', 'refurbished', 'new'])).min(1).default(['used', 'refurbished']),
  quantity: z.number().int().min(1).max(20).default(1),
  // A pin, never a typed address.
  deliveryLocation: z.object({ lat: latitude, lng: longitude }),
  deliveryAddress: z.record(z.unknown()).default({}),
  submit: z.boolean().default(true),
  acknowledgeDuplicate: z.boolean().optional(),
});

export async function registerRequestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/requests', {
    preHandler: [authenticate, requireRole('buyer')],
    // A competitor scraping the market by posting requests is a real risk, and
    // so is a buyer double-tapping on a bad connection.
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const body = createBody.parse(req.body);
      const buyerId = await withBuyerProfile(req);
      const created = await createRequest({
        buyerId,
        market: req.ctx.market!,
        vehicle: body.vehicle,
        partCategoryId: body.partCategoryId,
        partDescription: body.partDescription,
        conditionAccepted: body.conditionAccepted,
        quantity: body.quantity,
        deliveryLocation: body.deliveryLocation,
        deliveryAddress: body.deliveryAddress,
        submit: body.submit,
        ...(body.acknowledgeDuplicate === undefined ? {} : { acknowledgeDuplicate: body.acknowledgeDuplicate }),
      });
      return reply.status(201).send(created);
    },
  });

  app.get('/v1/requests', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const query = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(25), live: z.coerce.boolean().optional() })
      .parse(req.query);
    const buyerId = await withBuyerProfile(req);
    const rows = await getDb()
      .select()
      .from(requests)
      .where(eq(requests.buyerId, buyerId))
      .orderBy(desc(requests.createdAt))
      .limit(query.limit);
    const filtered = query.live === true ? rows.filter((r) => LIVE_STATES.includes(r.status as RequestState)) : rows;
    return reply.send({
      requests: filtered.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        statusLabel: t(`state.${r.status}`, req.ctx.locale),
        partDescription: r.partDescription,
        createdAt: toIsoUtc(r.createdAt),
        outcome: r.outcome,
        offerCount: r.offerCount,
      })),
    });
  });

  app.get('/v1/requests/:id', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const buyerId = await withBuyerProfile(req);
    const row = (
      await getDb()
        .select()
        .from(requests)
        .where(and(eq(requests.id, params.id), eq(requests.buyerId, buyerId)))
        .limit(1)
    )[0];
    if (!row) throw new AppError('not_found', 'error.not_found');

    const media = await getDb().select().from(requestMedia).where(eq(requestMedia.requestId, row.id));
    const counts = await requestCounts(row.id);
    const language = languageOf(req.ctx.locale);

    const category = row.partCategoryId === null
      ? null
      : (await getDb().select().from(partCategories).where(eq(partCategories.id, row.partCategoryId)).limit(1))[0];
    const vehicle = row.vehicleId === null
      ? null
      : (await getDb().select().from(vehicles).where(eq(vehicles.id, row.vehicleId)).limit(1))[0];

    return reply.send({
      id: row.id,
      reference: row.reference,
      status: row.status,
      statusLabel: t(`state.${row.status}`, req.ctx.locale),
      partDescription: row.partDescription,
      partCategory: category === undefined || category === null
        ? null
        : { id: category.id, code: category.code, name: category.nameI18n[language] ?? category.nameI18n.en ?? category.code },
      vehicle: vehicle === undefined || vehicle === null
        ? row.vehicleRaw
        : { make: vehicle.make, model: vehicle.model, year: vehicle.year, variant: vehicle.variant },
      conditionAccepted: row.conditionAccepted,
      quantity: row.quantity,
      media: media.map((m) => ({ url: m.url, kind: m.kind })),
      // Absolute UTC, always. The client subtracts from its own clock.
      deadlines: {
        responseDeadline: row.responseDeadline === null ? null : toIsoUtc(row.responseDeadline),
        offersDeadline: row.offersDeadline === null ? null : toIsoUtc(row.offersDeadline),
        wideningDeadline: row.wideningDeadline === null ? null : toIsoUtc(row.wideningDeadline),
        selectionDeadline: row.selectionDeadline === null ? null : toIsoUtc(row.selectionDeadline),
        deliveryDeadline: row.deliveryDeadline === null ? null : toIsoUtc(row.deliveryDeadline),
        serverTime: toIsoUtc(new Date()),
      },
      progress: { suppliersNotified: counts.fanoutCount, offersReceived: counts.offerCount },
      outcome: row.outcome,
      createdAt: toIsoUtc(row.createdAt),
    });
  });

  app.post('/v1/requests/:id/cancel', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ reason: z.string().trim().max(200).optional() }).parse(req.body ?? {});
    const buyerId = await withBuyerProfile(req);
    const owned = (
      await getDb()
        .select({ id: requests.id })
        .from(requests)
        .where(and(eq(requests.id, params.id), eq(requests.buyerId, buyerId)))
        .limit(1)
    )[0];
    if (!owned) throw new AppError('not_found', 'error.not_found');

    // Void FIRST, then transition.
    //
    // A cancellation that changes the state and leaves the authorisation on the
    // card is the worst version of this path: the buyer has cancelled, sees the
    // request closed, and their money is still ring-fenced for a week. Doing it
    // in this order means a failure to void leaves the request open and visible
    // rather than closed and wrong.
    const { voidAuthorisationForOrder } = await import('../payments/service.js');
    const held = (
      await getDb()
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(eq(orders.requestId, params.id))
        .orderBy(desc(orders.createdAt))
        .limit(1)
    )[0];
    if (held !== undefined) {
      await voidAuthorisationForOrder(held.id, body.reason ?? 'cancelled by buyer');
    }

    const result = await transition(params.id, 'BUYER_CANCELS', {
      actorType: 'buyer',
      actorId: buyerId,
      reason: body.reason ?? 'cancelled by buyer',
    });

    // Which message the buyer gets depends on how far the job had gone. Being
    // told "the hold is released" when a driver already has the part in a van is
    // not true, and they will find out.
    const { notifyBuyerUnhappyPath } = await import('./notify-cancel.js');
    await notifyBuyerUnhappyPath(params.id, result.from);

    return reply.send({ status: result.to, outcome: result.outcome, authorisationVoided: held !== undefined });
  });

  /**
   * The buyer's own view of the request timeline.
   *
   * Deliberately derived from state transitions rather than from a separate
   * event stream, so what the buyer sees and what the ops console sees cannot
   * disagree about what happened.
   */
  app.get('/v1/requests/:id/timeline', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const buyerId = await withBuyerProfile(req);
    const rows = await getSql()<{ to_state: string; created_at: Date }[]>`
      SELECT tr.to_state, tr.created_at
      FROM request_state_transitions tr
      JOIN requests r ON r.id = tr.request_id
      WHERE tr.request_id = ${params.id} AND r.buyer_id = ${buyerId}
      ORDER BY tr.created_at
    `;
    return reply.send({
      timeline: rows.map((r) => ({
        state: r.to_state,
        label: t(`state.${r.to_state}`, req.ctx.locale),
        at: toIsoUtc(r.created_at),
      })),
    });
  });
}
