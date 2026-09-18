import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  findContactDetails,
  normaliseDigits,
  OfferStatus,
  parseAmountToMinorUnits,
  RequestState,
  secondsBetween,
  toIsoUtc,
} from '@ninety/shared';
import { authenticate, requireRole, withSupplierProfile } from '../auth/guards.js';
import { getDb, getSql } from '../db/client.js';
import {
  offers,
  partCategories,
  requestFanouts,
  requests,
  supplierScoreEvents,
  supplierStockProfiles,
  suppliers,
  vehicles,
} from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { languageOf, t } from '../i18n/index.js';
import { nextAnonLabel } from '../requests/service.js';
import { log } from '../core/logger.js';
import { recordScoreEvent, recomputeSupplierScore } from '../matching/scoring.js';
import { onOfferSubmitted } from '../matching/hooks.js';

/**
 * The supplier terminal API.
 *
 * The most important surface in the business. A yard has fifteen minutes to
 * answer and should need under ninety seconds of it, on a cheap tablet, in a
 * noisy yard, in gloves, possibly in Arabic. Everything here is shaped by that:
 * one list, one submit, presets instead of typing, and no step a thumb can miss.
 *
 * What a supplier must never see is as important as what they do: no buyer name,
 * business, phone, email or exact address; no other supplier's price, identity
 * or even how many others were asked; and never whether they were undercut.
 * Competitive pricing depends on a yard quoting its own number rather than
 * reacting to someone else's.
 */
export async function registerSupplierRoutes(app: FastifyInstance): Promise<void> {
  /**
   * The live list. The only screen most users ever see.
   *
   * Soonest-expiring first: a job with two minutes left is worth more attention
   * than one with twelve, and the operator should not have to work that out.
   */
  app.get('/v1/supplier/requests', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const supplierId = await withSupplierProfile(req);
    const language = languageOf(req.ctx.locale);
    const now = new Date();

    const rows = await getSql()<
      {
        request_id: string;
        reference: string;
        status: string;
        part_description: string;
        part_category_code: string | null;
        part_name_i18n: Record<string, string> | null;
        make: string | null;
        model: string | null;
        year: number | null;
        variant: string | null;
        response_deadline: Date | null;
        sent_at: Date;
        seen_at: Date | null;
        tier: number;
        distance_km: string | null;
        already_offered: boolean;
        declined: boolean;
        media: { url: string; kind: string }[] | null;
      }[]
    >`
      SELECT
        r.id AS request_id, r.reference, r.status, r.part_description,
        pc.code AS part_category_code, pc.name_i18n AS part_name_i18n,
        v.make, v.model, v.year, v.variant,
        r.response_deadline, f.sent_at, f.seen_at, f.tier,
        round(ST_Distance(s.location, r.delivery_location)::numeric / 1000, 1)::text AS distance_km,
        EXISTS (SELECT 1 FROM offers o WHERE o.request_id = r.id AND o.supplier_id = ${supplierId}
                  AND o.status <> 'withdrawn') AS already_offered,
        f.outcome = 'declined' AS declined,
        (SELECT json_agg(json_build_object('url', m.url, 'kind', m.kind))
           FROM request_media m WHERE m.request_id = r.id) AS media
      FROM request_fanouts f
      JOIN requests r ON r.id = f.request_id
      JOIN suppliers s ON s.id = f.supplier_id
      LEFT JOIN part_categories pc ON pc.id = r.part_category_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      WHERE f.supplier_id = ${supplierId}
        AND r.status IN (${RequestState.AWAITING_OFFERS}, ${RequestState.WIDENING}, ${RequestState.COLLECTING_OFFERS})
        AND coalesce(f.outcome, '') <> 'declined'
      ORDER BY r.response_deadline ASC NULLS LAST
      LIMIT 50
    `;

    return reply.send({
      // The server's own clock, so a terminal can detect its drift and still
      // render an honest countdown from the absolute deadline below.
      serverTime: toIsoUtc(now),
      requests: rows.map((row) => ({
        requestId: row.request_id,
        reference: row.reference,
        vehicle:
          row.make === null
            ? null
            : { make: row.make, model: row.model, year: row.year, variant: row.variant },
        part: {
          description: row.part_description,
          categoryCode: row.part_category_code,
          name:
            row.part_name_i18n === null
              ? row.part_description
              : (row.part_name_i18n[language] ?? row.part_name_i18n.en ?? row.part_description),
        },
        // Distance only. Never a bearing: distance plus direction locates a
        // workshop on a map in about four seconds.
        distanceKm: row.distance_km === null ? null : Number(row.distance_km),
        // Absolute UTC. Never a duration — a tablet with a wrong clock must not
        // be able to argue about the fifteen minutes.
        responseDeadline: row.response_deadline === null ? null : toIsoUtc(row.response_deadline),
        sentAt: toIsoUtc(row.sent_at),
        seen: row.seen_at !== null,
        tier: row.tier,
        alreadyOffered: row.already_offered,
        media: row.media ?? [],
      })),
    });
  });

  /** Mark a job as seen. Feeds the response-time statistics, nothing else. */
  app.post('/v1/supplier/requests/:id/seen', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const supplierId = await withSupplierProfile(req);
    await getDb()
      .update(requestFanouts)
      .set({ seenAt: new Date() })
      .where(
        and(
          eq(requestFanouts.requestId, params.id),
          eq(requestFanouts.supplierId, supplierId),
          isNull(requestFanouts.seenAt),
        ),
      );
    return reply.status(204).send();
  });

  /**
   * Submit an offer.
   *
   * Price arrives as text so Arabic-Indic digits are accepted — a yard typing
   * ٤٢٠ must not lose the job inside the fifteen minutes because a field only
   * understands ASCII.
   */
  app.post('/v1/supplier/requests/:id/offer', {
    preHandler: [authenticate, requireRole('supplier')],
    config: { rateLimit: { max: 120, timeWindow: '5 minutes' } },
    handler: async (req, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          price: z.union([z.string().trim().min(1).max(20), z.number()]),
          condition: z.enum(['used', 'refurbished', 'new']),
          warrantyDays: z.number().int().min(0).max(3650).default(0),
          readyInMin: z.number().int().min(0).max(1440).default(0),
          notes: z.string().trim().max(500).nullish(),
          /** Set by the terminal when replaying a submission queued while offline. */
          composedAt: z.string().datetime().optional(),
        })
        .parse(req.body);

      const supplierId = await withSupplierProfile(req);
      const market = req.ctx.market!;

      const priceCents =
        typeof body.price === 'number'
          ? Math.round(body.price * Math.pow(10, market.currencyMinorUnitExponent))
          : parseAmountToMinorUnits(String(body.price), market.currencyMinorUnitExponent);
      if (priceCents === null || priceCents <= 0) {
        throw new AppError('validation_failed', 'error.price_out_of_range');
      }

      // Rejected, not silently mangled. A supplier whose note was quietly
      // altered will not understand why the buyer is confused, and will
      // conclude the product is broken rather than that the rule exists.
      const scrub = findContactDetails(body.notes ?? null);
      if (!scrub.clean) {
        throw new AppError('contact_details_rejected', 'scrub.rejected', {
          details: {
            why: t('scrub.why', req.ctx.locale),
            found: scrub.violations.map((v) => ({
              kind: v.kind,
              reason: t(v.messageKey, req.ctx.locale),
              fragment: v.fragment,
            })),
          },
        });
      }

      const fanout = (
        await getDb()
          .select()
          .from(requestFanouts)
          .where(and(eq(requestFanouts.requestId, params.id), eq(requestFanouts.supplierId, supplierId)))
          .limit(1)
      )[0];
      if (!fanout) throw new AppError('forbidden', 'error.supplier_not_fanned_out');

      const request = (await getDb().select().from(requests).where(eq(requests.id, params.id)).limit(1))[0];
      if (!request) throw new AppError('not_found', 'error.not_found');

      // The window is the server's, and it closed when the server says it did.
      const openStates: string[] = [RequestState.AWAITING_OFFERS, RequestState.WIDENING, RequestState.COLLECTING_OFFERS];
      const windowOpen =
        openStates.includes(request.status) &&
        (request.responseDeadline === null || request.responseDeadline.getTime() > Date.now());
      if (!windowOpen) throw new AppError('conflict', 'error.offer_window_closed');

      const existing = (
        await getDb()
          .select({ id: offers.id, status: offers.status })
          .from(offers)
          .where(and(eq(offers.requestId, params.id), eq(offers.supplierId, supplierId)))
          .limit(1)
      )[0];
      if (existing !== undefined && existing.status !== OfferStatus.WITHDRAWN) {
        throw new AppError('conflict', 'error.already_offered');
      }

      const distanceRows = await getSql()<{ km: string }[]>`
        SELECT round(ST_Distance(s.location, r.delivery_location)::numeric / 1000, 2)::text AS km
        FROM suppliers s, requests r WHERE s.id = ${supplierId} AND r.id = ${params.id}
      `;
      const distanceKm = Number(distanceRows[0]?.km ?? '0');

      // Response time is measured from the fan-out, not from when the terminal
      // happened to render. An offer composed offline and replayed on reconnect
      // is credited to when it was composed.
      const composedAt = body.composedAt === undefined ? new Date() : new Date(body.composedAt);
      const effectiveAt = composedAt.getTime() < fanout.sentAt.getTime() ? new Date() : composedAt;
      const responseSeconds = secondsBetween(fanout.sentAt, effectiveAt);

      const anonLabel = await nextAnonLabel(params.id);

      const inserted = await getDb()
        .insert(offers)
        .values({
          requestId: params.id,
          supplierId,
          anonLabel,
          priceCents,
          condition: body.condition,
          warrantyDays: body.warrantyDays,
          notes: body.notes ?? null,
          distanceKm: String(distanceKm),
          readyInMin: body.readyInMin,
          status: OfferStatus.SUBMITTED,
          responseSeconds,
        })
        .returning({ id: offers.id });
      const offerId = inserted[0]!.id;

      await getDb()
        .update(requestFanouts)
        .set({ respondedAt: new Date(), outcome: 'offered' })
        .where(eq(requestFanouts.id, fanout.id));

      await getDb()
        .update(requests)
        .set({ offerCount: sql`${requests.offerCount} + 1` })
        .where(eq(requests.id, params.id));

      await recordScoreEvent(supplierId, responseSeconds <= 180 ? 'responded_fast' : 'responded', {
        requestId: params.id,
        note: `responded in ${responseSeconds}s`,
      });

      // Tells the state machine an offer arrived — which is what moves a request
      // out of WIDENING and what the buyer's live offer screen is waiting for.
      await onOfferSubmitted(params.id);

      log.info('offer submitted', { offerId, requestId: params.id, supplierId, responseSeconds, anonLabel });

      return reply.status(201).send({
        offerId,
        anonLabel,
        responseSeconds,
        // What this yard will actually be paid, stated plainly rather than as a
        // percentage they have to work out.
        estimatedPayoutCents: priceCents - Math.round(priceCents * market.fees.commissionRate),
        currency: market.currency,
      });
    },
  });

  /** Decline. Two taps, and it must be as cheap as ignoring it. */
  app.post('/v1/supplier/requests/:id/decline', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ reason: z.enum(['no_stock', 'wrong_vehicle', 'too_far', 'busy', 'other']).optional() }).parse(
      req.body ?? {},
    );
    const supplierId = await withSupplierProfile(req);

    const updated = await getDb()
      .update(requestFanouts)
      .set({ respondedAt: new Date(), outcome: 'declined' })
      .where(and(eq(requestFanouts.requestId, params.id), eq(requestFanouts.supplierId, supplierId)))
      .returning({ id: requestFanouts.id });
    if (updated.length === 0) throw new AppError('forbidden', 'error.supplier_not_fanned_out');

    // Declining costs nothing in score. It is information, and a yard that
    // declines honestly is more useful than one that ignores the alert.
    await recordScoreEvent(supplierId, 'declined', { requestId: params.id, note: body.reason ?? 'declined' });
    await refreshDeclineRate(supplierId);
    return reply.status(204).send();
  });

  /** Withdraw an offer already made — stock sold, part turned out to be wrong. */
  app.post('/v1/supplier/offers/:id/withdraw', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ reason: z.string().trim().max(200).optional() }).parse(req.body ?? {});
    const supplierId = await withSupplierProfile(req);

    const offer = (
      await getDb()
        .select()
        .from(offers)
        .where(and(eq(offers.id, params.id), eq(offers.supplierId, supplierId)))
        .limit(1)
    )[0];
    if (!offer) throw new AppError('not_found', 'error.not_found');
    if (offer.status === OfferStatus.WITHDRAWN) return reply.status(204).send();

    const wasAccepted = offer.status === OfferStatus.ACCEPTED;
    await getDb()
      .update(offers)
      .set({ status: OfferStatus.WITHDRAWN, withdrawnAt: new Date(), withdrawnReason: body.reason ?? null })
      .where(eq(offers.id, params.id));
    await getDb()
      .update(requests)
      .set({ offerCount: sql`greatest(0, ${requests.offerCount} - 1)` })
      .where(eq(requests.id, offer.requestId));

    if (wasAccepted) {
      // Withdrawing a job already won is a different thing from withdrawing an
      // open quote, and it costs the yard score, because the buyer has been let
      // down after committing.
      await recordScoreEvent(supplierId, 'cancelled_after_win', { requestId: offer.requestId, note: body.reason ?? 'withdrawn after acceptance' });
    }

    const { onOfferWithdrawn } = await import('../matching/hooks.js');
    await onOfferWithdrawn(offer.requestId, params.id, wasAccepted);

    return reply.status(204).send();
  });

  /**
   * Performance.
   *
   * A commercial instrument, not a report. The whole supply-side incentive rests
   * on a yard understanding that answering faster earns more, so the link is
   * made explicit rather than left to be inferred from a number.
   */
  app.get('/v1/supplier/performance', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const supplierId = await withSupplierProfile(req);
    const market = req.ctx.market!;

    const supplier = (await getDb().select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1))[0];
    if (!supplier) throw new AppError('not_found', 'error.not_found');

    const stats = (
      await getSql()<
        {
          rank: string;
          city_total: string;
          jobs_won: string;
          earned_cents: string;
          offers_30d: string;
          fanouts_30d: string;
          median_response_s: string | null;
        }[]
      >`
        WITH ranked AS (
          SELECT id, rank() OVER (ORDER BY score DESC) AS rnk, count(*) OVER () AS total
          FROM suppliers WHERE city_id = ${supplier.cityId} AND status = 'active'
        )
        SELECT
          (SELECT rnk FROM ranked WHERE id = ${supplierId})::text AS rank,
          (SELECT total FROM ranked LIMIT 1)::text AS city_total,
          (SELECT count(*) FROM orders WHERE supplier_id = ${supplierId})::text AS jobs_won,
          (SELECT coalesce(sum(supplier_payout_cents), 0) FROM orders
             WHERE supplier_id = ${supplierId} AND status = 'captured')::text AS earned_cents,
          (SELECT count(*) FROM offers WHERE supplier_id = ${supplierId}
             AND created_at > now() - interval '30 days')::text AS offers_30d,
          (SELECT count(*) FROM request_fanouts WHERE supplier_id = ${supplierId}
             AND sent_at > now() - interval '30 days' AND was_online_at_send = true)::text AS fanouts_30d,
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY response_seconds)
             FROM offers WHERE supplier_id = ${supplierId}
             AND created_at > now() - interval '30 days')::text AS median_response_s
      `
    )[0]!;

    const fanouts = Number(stats.fanouts_30d);
    const responded = Number(stats.offers_30d);

    return reply.send({
      score: Number(supplier.score),
      rank: stats.rank === null ? null : Number(stats.rank),
      cityTotal: Number(stats.city_total),
      responseRate30d: fanouts === 0 ? null : Math.round((responded / fanouts) * 100) / 100,
      medianResponseSeconds: stats.median_response_s === null ? null : Math.round(Number(stats.median_response_s)),
      jobsWon: Number(stats.jobs_won),
      earnedCents: Number(stats.earned_cents),
      currency: market.currency,
      fulfilmentRate30d: Number(supplier.fulfilmentRate),
      disputeRate30d: Number(supplier.disputeRate),
      // The commercial link, said out loud on the screen that shows the number.
      incentiveMessageKey: 'notify.supplier.score_changed',
    });
  });

  app.get('/v1/supplier/score-history', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const supplierId = await withSupplierProfile(req);
    const rows = await getDb()
      .select()
      .from(supplierScoreEvents)
      .where(eq(supplierScoreEvents.supplierId, supplierId))
      .orderBy(desc(supplierScoreEvents.createdAt))
      .limit(50);
    return reply.send({
      events: rows.map((r) => ({
        event: r.event,
        delta: Number(r.delta),
        scoreAfter: r.scoreAfter === null ? null : Number(r.scoreAfter),
        note: r.note,
        at: toIsoUtc(r.createdAt),
      })),
    });
  });

  /**
   * The stock profile.
   *
   * Drives matching, and therefore decides whether this terminal receives work
   * worth watching. A badly configured profile produces irrelevant alerts, and
   * irrelevant alerts are how a terminal dies.
   */
  app.get('/v1/supplier/stock-profile', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const supplierId = await withSupplierProfile(req);
    const row = (
      await getDb().select().from(supplierStockProfiles).where(eq(supplierStockProfiles.supplierId, supplierId)).limit(1)
    )[0];
    const language = languageOf(req.ctx.locale);
    const categories = await getDb().select().from(partCategories).where(isNull(partCategories.parentId)).orderBy(partCategories.sortOrder);
    const makes = await getDb().selectDistinct({ make: vehicles.make }).from(vehicles).orderBy(vehicles.make);

    return reply.send({
      profile:
        row === undefined
          ? { makes: [], models: [], yearFrom: null, yearTo: null, partCategories: [], maxRadiusKm: 50 }
          : {
              makes: row.makes,
              models: row.models,
              yearFrom: row.yearFrom,
              yearTo: row.yearTo,
              partCategories: row.partCategories,
              maxRadiusKm: row.maxRadiusKm,
            },
      options: {
        makes: makes.map((m) => m.make),
        categories: categories.map((c) => ({
          code: c.code,
          name: c.nameI18n[language] ?? c.nameI18n.en ?? c.code,
        })),
      },
    });
  });

  app.put('/v1/supplier/stock-profile', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const body = z
      .object({
        makes: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
        models: z.array(z.string().trim().min(1).max(60)).max(200).default([]),
        yearFrom: z.number().int().min(1950).max(2100).nullable().default(null),
        yearTo: z.number().int().min(1950).max(2100).nullable().default(null),
        partCategories: z.array(z.string().trim().min(1).max(80)).max(120).default([]),
        maxRadiusKm: z.number().int().min(1).max(200).default(50),
      })
      .parse(req.body);
    if (body.yearFrom !== null && body.yearTo !== null && body.yearFrom > body.yearTo) {
      throw new AppError('validation_failed', 'error.validation_failed');
    }

    const supplierId = await withSupplierProfile(req);
    await getDb()
      .insert(supplierStockProfiles)
      .values({ supplierId, ...body, updatedAt: new Date() })
      .onConflictDoUpdate({ target: supplierStockProfiles.supplierId, set: { ...body, updatedAt: new Date() } });

    // Configuring the profile is the third of the four onboarding stages, and
    // only the fourth — passing a live test request — actually counts.
    await getDb()
      .update(suppliers)
      .set({ onboardingStage: 'profile_configured', onboardingStageAt: new Date() })
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.onboardingStage, 'tablet_installed')));

    return reply.send({ ok: true });
  });

  /** Won orders, with the collection instructions and the packaging rule. */
  app.get('/v1/supplier/orders', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const supplierId = await withSupplierProfile(req);
    const market = req.ctx.market!;
    const rows = await getSql()<
      {
        order_id: string;
        reference: string;
        part_description: string;
        price_cents: number;
        payout_cents: number;
        status: string;
        created_at: Date;
        driver_eta: Date | null;
        delivery_status: string | null;
      }[]
    >`
      SELECT o.id AS order_id, o.reference, r.part_description, o.part_cents AS price_cents,
             o.supplier_payout_cents AS payout_cents, o.status, o.created_at,
             d.dispatched_at AS driver_eta, d.status AS delivery_status
      FROM orders o
      JOIN requests r ON r.id = o.request_id
      LEFT JOIN LATERAL (
        SELECT status, dispatched_at FROM deliveries WHERE order_id = o.id ORDER BY attempt DESC LIMIT 1
      ) d ON true
      WHERE o.supplier_id = ${supplierId}
      ORDER BY o.created_at DESC
      LIMIT 50
    `;
    return reply.send({
      currency: market.currency,
      // Not decorative. The parcel is the last place anonymity can leak, and it
      // leaks through habit rather than malice.
      packagingRule: t('notify.supplier.packaging_rule', req.ctx.locale),
      orders: rows.map((row) => ({
        orderId: row.order_id,
        reference: row.reference,
        partDescription: row.part_description,
        priceCents: row.price_cents,
        payoutCents: row.payout_cents,
        status: row.status,
        deliveryStatus: row.delivery_status,
        driverExpectedAt: row.driver_eta === null ? null : toIsoUtc(row.driver_eta),
        createdAt: toIsoUtc(row.created_at),
      })),
    });
  });

  app.post('/v1/supplier/orders/:id/ready', { preHandler: [authenticate, requireRole('supplier')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const supplierId = await withSupplierProfile(req);
    const { markPackedAndReady } = await import('../logistics/service.js');
    await markPackedAndReady(params.id, supplierId);
    return reply.status(204).send();
  });
}

/**
 * Keep the decline rate current.
 *
 * A climbing decline rate means this yard is being sent work it does not want,
 * and the matching engine raises their stock-profile threshold in response.
 * Relevance protects the clock.
 */
async function refreshDeclineRate(supplierId: string): Promise<void> {
  const rows = await getSql()<{ rate: string }[]>`
    SELECT coalesce(
      count(*) FILTER (WHERE outcome = 'declined')::numeric / nullif(count(*), 0), 0
    )::text AS rate
    FROM request_fanouts
    WHERE supplier_id = ${supplierId} AND sent_at > now() - interval '30 days'
  `;
  const rate = Number(rows[0]?.rate ?? '0');
  await getDb().update(suppliers).set({ declineRate: rate.toFixed(4) }).where(eq(suppliers.id, supplierId));
  const { adjustStockThresholdForDeclineRate } = await import('../matching/scoring.js');
  await adjustStockThresholdForDeclineRate(supplierId, rate);
  await recomputeSupplierScore(supplierId);
}

