import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { LIVE_STATES, RequestState, RequestTransition, toIsoUtc } from '@ninety/shared';
import { authenticate, requireRole } from '../auth/guards.js';
import { getDb, getSql } from '../db/client.js';
import {
  adminInterventions,
  disputes,
  opsQueue,
  orders,
  requests,
  suppliers,
  supplierTablets,
} from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { marketConfig, EDITABLE_MARKET_FIELDS } from '../market/config.js';
import { transition } from '../state/machine.js';
import {
  commercialMetrics,
  demandDataset,
  marketplaceHealth,
  speedMetrics,
  supplyMetrics,
  unfilledDemand,
} from './metrics.js';
import { logIdentityAccess } from '../security/audit.js';
import { log } from '../core/logger.js';
import { t } from '../i18n/index.js';
import { slaDeadline } from '../core/clock.js';

/**
 * The ops console API.
 *
 * Reconstructed from the application specification's admin section and the
 * technical reference's metrics list: the PHASE-06 build document was not part
 * of the package, so this is built from the two reference documents that
 * describe the same surface rather than guessed.
 *
 * In launch week this is used constantly. Fill rate in the first fortnight sets
 * the market's opinion permanently, and rescuing requests by hand is a
 * legitimate way to buy that — which is why every intervention here goes through
 * the state machine rather than writing to the database, and every one is logged
 * with who did it and why.
 *
 * This is also the one place supplier identity is legitimately visible, so every
 * access to it is audited.
 */
export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const adminOnly = { preHandler: [authenticate, requireRole('admin')] };

  /** C1 — the live request board. */
  app.get('/v1/admin/requests', adminOnly, async (req, reply) => {
    const query = z
      .object({
        marketCode: z.string().max(4).optional(),
        cityId: z.string().uuid().optional(),
        status: z.string().max(40).optional(),
        live: z.coerce.boolean().optional(),
        atRisk: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(req.query);

    const marketId = query.marketCode === undefined ? null : (await marketConfig.byCode(query.marketCode)).id;

    const rows = await getSql()<
      {
        id: string;
        reference: string;
        status: string;
        outcome: string | null;
        part_description: string;
        city: string | null;
        buyer_business: string | null;
        created_at: Date;
        response_deadline: Date | null;
        offers_deadline: Date | null;
        selection_deadline: Date | null;
        delivery_deadline: Date | null;
        fanout_count: number;
        offer_count: number;
        seconds_to_deadline: string | null;
      }[]
    >`
      SELECT r.id, r.reference, r.status, r.outcome, r.part_description,
             c.name AS city, b.business_name AS buyer_business,
             r.created_at, r.response_deadline, r.offers_deadline, r.selection_deadline, r.delivery_deadline,
             r.fanout_count, r.offer_count,
             EXTRACT(EPOCH FROM (
               coalesce(r.response_deadline, r.offers_deadline, r.selection_deadline, r.delivery_deadline) - now()
             ))::text AS seconds_to_deadline
        FROM requests r
        LEFT JOIN cities c ON c.id = r.city_id
        LEFT JOIN buyers b ON b.id = r.buyer_id
       WHERE r.submitted_at IS NOT NULL
         AND (${marketId}::uuid IS NULL OR r.market_id = ${marketId}::uuid)
         AND (${query.cityId ?? null}::uuid IS NULL OR r.city_id = ${query.cityId ?? null}::uuid)
         AND (${query.status ?? null}::text IS NULL OR r.status = ${query.status ?? null}::text)
         AND (${query.live ?? false} = false OR r.status = ANY(${LIVE_STATES as unknown as string[]}))
       ORDER BY coalesce(r.response_deadline, r.offers_deadline, r.selection_deadline) ASC NULLS LAST,
                r.created_at DESC
       LIMIT ${query.limit}
    `;

    const board = rows.map((row) => {
      const secondsToDeadline = row.seconds_to_deadline === null ? null : Math.round(Number(row.seconds_to_deadline));
      return {
        id: row.id,
        reference: row.reference,
        status: row.status,
        statusLabel: t(`state.${row.status}`, req.ctx.locale),
        outcome: row.outcome,
        partDescription: row.part_description,
        city: row.city,
        buyerBusiness: row.buyer_business,
        suppliersNotified: row.fanout_count,
        offers: row.offer_count,
        createdAt: toIsoUtc(row.created_at),
        secondsToDeadline,
        // Anything within two minutes of a deadline, or already past one while
        // still live, is what the launch-week team actually needs to see.
        atRisk:
          secondsToDeadline !== null &&
          secondsToDeadline < 120 &&
          LIVE_STATES.includes(row.status as RequestState),
      };
    });

    const filtered = query.atRisk === true ? board.filter((b) => b.atRisk) : board;
    return reply.send({ requests: filtered, serverTime: toIsoUtc(new Date()) });
  });

  /** Why each yard did or did not receive a job. */
  app.get('/v1/admin/requests/:id/match-decisions', adminOnly, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const rows = await getSql()<
      {
        supplier_id: string;
        business_name: string;
        tier: number;
        stock_profile_match: string;
        proximity: string;
        supplier_score_norm: string;
        availability: string;
        total: string;
        distance_km: string;
        threshold: string;
        selected: boolean;
        reason: string;
      }[]
    >`
      SELECT md.supplier_id, s.business_name, md.tier, md.stock_profile_match, md.proximity,
             md.supplier_score_norm, md.availability, md.total, md.distance_km, md.threshold,
             md.selected, md.reason
        FROM match_decisions md JOIN suppliers s ON s.id = md.supplier_id
       WHERE md.request_id = ${params.id}
       ORDER BY md.tier, md.total DESC
    `;

    // Supplier identity, in the one place it is legitimate — and audited.
    await logIdentityAccess({
      actorUserId: req.ctx.actor!.userId,
      actorRole: 'admin',
      route: '/v1/admin/requests/:id/match-decisions',
      supplierId: null,
      fields: ['business_name'],
      allowed: true,
      requestId: req.ctx.requestId,
    });

    return reply.send({
      decisions: rows.map((r) => ({
        supplierId: r.supplier_id,
        businessName: r.business_name,
        tier: r.tier,
        components: {
          stockProfileMatch: Number(r.stock_profile_match),
          proximity: Number(r.proximity),
          supplierScore: Number(r.supplier_score_norm),
          availability: Number(r.availability),
        },
        total: Number(r.total),
        threshold: Number(r.threshold),
        distanceKm: Number(r.distance_km),
        selected: r.selected,
        reason: r.reason,
      })),
    });
  });

  /**
   * Manual intervention.
   *
   * Every one goes through the state machine — never a direct database write —
   * and every one is logged with who did it and why. Rescuing a stalled request
   * by hand is legitimate; doing it invisibly is not.
   */
  app.post('/v1/admin/requests/:id/intervene', adminOnly, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        action: z.enum(['refan', 'widen', 'extend_deadline', 'cancel', 'force_transition', 'close']),
        reason: z.string().trim().min(3).max(500),
        extendMinutes: z.number().int().min(1).max(240).optional(),
        transitionName: z.string().max(60).optional(),
      })
      .parse(req.body);

    const adminId = req.ctx.actor!.userId;
    const request = (await getDb().select().from(requests).where(eq(requests.id, params.id)).limit(1))[0];
    if (!request) throw new AppError('not_found', 'error.not_found');

    let outcome: Record<string, unknown> = {};

    switch (body.action) {
      case 'refan':
      case 'widen': {
        const market = await marketConfig.byId(request.marketId);
        const { selectSuppliers, sendFanout } = await import('../matching/engine.js');
        const tier = body.action === 'widen' ? 2 : 1;
        const result = await selectSuppliers(params.id, { tier, market });
        const sent = await sendFanout(params.id, result.selected, {
          tier,
          reference: request.reference,
          responseDeadline: request.responseDeadline ?? slaDeadline(new Date(), market.sla.responseMin),
          summary: { part: request.partDescription, minutes: market.sla.responseMin },
        });
        outcome = { considered: result.considered, selected: result.selected.length, sent };
        break;
      }
      case 'extend_deadline': {
        const minutes = body.extendMinutes ?? 10;
        const current = request.responseDeadline ?? request.offersDeadline ?? new Date();
        const extended = new Date(current.getTime() + minutes * 60_000);
        await getDb().update(requests).set({ responseDeadline: extended }).where(eq(requests.id, params.id));
        const { scheduleTimer } = await import('../timers/queue.js');
        await scheduleTimer(
          {
            kind: 'response-deadline',
            requestId: params.id,
            expectedStates: [RequestState.AWAITING_OFFERS],
            dueAt: toIsoUtc(extended),
          },
          extended,
        );
        outcome = { newDeadline: toIsoUtc(extended) };
        break;
      }
      case 'cancel': {
        const result = await transition(params.id, 'BUYER_CANCELS', {
          actorType: 'admin',
          actorId: adminId,
          reason: body.reason,
        });
        outcome = { status: result.to };
        break;
      }
      case 'close': {
        const result = await transition(params.id, 'CLOSE', { actorType: 'admin', actorId: adminId, reason: body.reason });
        outcome = { status: result.to };
        break;
      }
      case 'force_transition': {
        if (body.transitionName === undefined) throw new AppError('validation_failed', 'error.validation_failed');
        // Still validated by the state machine. "Force" means an admin chose the
        // transition, not that the machine is bypassed — an invalid one is still
        // refused, because a request in an impossible state is unrecoverable.
        const result = await transition(params.id, body.transitionName as RequestTransition, {
          actorType: 'admin',
          actorId: adminId,
          reason: body.reason,
        });
        outcome = { status: result.to, outcome: result.outcome };
        break;
      }
    }

    await getDb().insert(adminInterventions).values({
      adminId,
      requestId: params.id,
      action: body.action,
      reason: body.reason,
      payload: outcome as never,
    });
    log.warn('admin intervened on a request', { requestId: params.id, adminId, action: body.action, reason: body.reason });
    return reply.send({ action: body.action, ...outcome });
  });

  app.get('/v1/admin/requests/:id/timeline', adminOnly, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const { transitionHistory } = await import('../state/machine.js');
    const rows = await transitionHistory(params.id);
    return reply.send({
      timeline: rows.map((r) => ({
        from: r.fromState,
        to: r.toState,
        transition: r.transition,
        actorType: r.actorType,
        actorId: r.actorId,
        reason: r.reason,
        at: toIsoUtc(r.createdAt),
      })),
    });
  });

  /** C2 — the supplier onboarding pipeline. Only the last stage counts. */
  app.get('/v1/admin/suppliers', adminOnly, async (req, reply) => {
    const query = z
      .object({ stage: z.string().max(40).optional(), status: z.string().max(20).optional(), limit: z.coerce.number().int().min(1).max(500).default(200) })
      .parse(req.query);

    const rows = await getSql()<
      {
        id: string;
        business_name: string;
        city: string;
        status: string;
        onboarding_stage: string;
        stage_days: string;
        score: string;
        response_rate: string;
        verified: boolean;
        online: boolean | null;
        last_seen_at: Date | null;
        tablet_serial: string | null;
        tablet_status: string | null;
      }[]
    >`
      SELECT s.id, s.business_name, c.name AS city, s.status, s.onboarding_stage,
             EXTRACT(DAY FROM (now() - s.onboarding_stage_at))::text AS stage_days,
             s.score::text, s.response_rate::text, s.verified,
             p.online, p.last_seen_at,
             tb.serial_number AS tablet_serial, tb.status AS tablet_status
        FROM suppliers s
        JOIN cities c ON c.id = s.city_id
        LEFT JOIN supplier_presence p ON p.supplier_id = s.id
        LEFT JOIN LATERAL (SELECT serial_number, status FROM supplier_tablets WHERE supplier_id = s.id ORDER BY issued_at DESC LIMIT 1) tb ON true
       WHERE (${query.stage ?? null}::text IS NULL OR s.onboarding_stage = ${query.stage ?? null}::text)
         AND (${query.status ?? null}::text IS NULL OR s.status = ${query.status ?? null}::text)
       ORDER BY s.onboarding_stage, s.business_name
       LIMIT ${query.limit}
    `;

    await logIdentityAccess({
      actorUserId: req.ctx.actor!.userId,
      actorRole: 'admin',
      route: '/v1/admin/suppliers',
      supplierId: null,
      fields: ['business_name', 'address'],
      allowed: true,
      requestId: req.ctx.requestId,
    });

    const pipeline = await getSql()<{ onboarding_stage: string; n: string }[]>`
      SELECT onboarding_stage, count(*)::text AS n FROM suppliers GROUP BY 1
    `;
    const stageCount = (stage: string) => Number(pipeline.find((p) => p.onboarding_stage === stage)?.n ?? '0');

    return reply.send({
      // The only number that counts is the last one. Counting a signed yard with
      // an unconfigured tablet inflates supply and breaks the fill-rate forecast.
      pipeline: {
        signed: stageCount('signed') + stageCount('tablet_installed') + stageCount('profile_configured') + stageCount('test_request_passed'),
        tabletInstalled: stageCount('tablet_installed') + stageCount('profile_configured') + stageCount('test_request_passed'),
        profileConfigured: stageCount('profile_configured') + stageCount('test_request_passed'),
        testRequestPassed: stageCount('test_request_passed'),
      },
      suppliers: rows.map((r) => ({
        id: r.id,
        businessName: r.business_name,
        city: r.city,
        status: r.status,
        onboardingStage: r.onboarding_stage,
        daysAtStage: Number(r.stage_days),
        score: Number(r.score),
        responseRate: Number(r.response_rate),
        verified: r.verified,
        terminalOnline: r.online ?? false,
        lastSeenAt: r.last_seen_at === null ? null : toIsoUtc(r.last_seen_at),
        tablet: r.tablet_serial === null ? null : { serial: r.tablet_serial, status: r.tablet_status },
      })),
    });
  });

  app.post('/v1/admin/suppliers/:id/stage', adminOnly, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        stage: z.enum(['signed', 'tablet_installed', 'profile_configured', 'test_request_passed']),
        verified: z.boolean().optional(),
        activate: z.boolean().optional(),
      })
      .parse(req.body);

    await getDb()
      .update(suppliers)
      .set({
        onboardingStage: body.stage,
        onboardingStageAt: new Date(),
        ...(body.verified === undefined ? {} : { verified: body.verified, verifiedAt: body.verified ? new Date() : null }),
        // A yard goes active only once it has passed a live test request.
        ...(body.activate === true && body.stage === 'test_request_passed' ? { status: 'active' as const } : {}),
      })
      .where(eq(suppliers.id, params.id));
    return reply.send({ ok: true });
  });

  app.post('/v1/admin/suppliers/:id/tablet', adminOnly, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        serialNumber: z.string().trim().min(3).max(60),
        issuedTo: z.string().trim().max(120).optional(),
        status: z.enum(['deployed', 'returned', 'lost', 'broken', 'replaced']).default('deployed'),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(req.body);
    await getDb()
      .insert(supplierTablets)
      .values({
        supplierId: params.id,
        serialNumber: body.serialNumber,
        issuedTo: body.issuedTo ?? null,
        status: body.status,
        notes: body.notes ?? null,
      })
      .onConflictDoUpdate({
        target: supplierTablets.serialNumber,
        set: { status: body.status, notes: body.notes ?? null, supplierId: params.id },
      });
    return reply.send({ ok: true });
  });

  /** C3 — the metrics dashboard. */
  app.get('/v1/admin/metrics', adminOnly, async (req, reply) => {
    const query = z
      .object({ marketCode: z.string().max(4).optional(), cityId: z.string().uuid().optional(), days: z.coerce.number().int().min(1).max(365).default(30) })
      .parse(req.query);
    const marketId = query.marketCode === undefined ? null : (await marketConfig.byCode(query.marketCode)).id;
    const window = { marketId, cityId: query.cityId ?? null, days: query.days };

    const [health, speed, commercial, supply] = await Promise.all([
      marketplaceHealth(window),
      speedMetrics(window),
      commercialMetrics(window),
      supplyMetrics(window),
    ]);
    return reply.send({ window, marketplace: health, speed, commercial, supply });
  });

  /** C4 — the demand dataset, and the unfilled view that decides what to stock. */
  app.get('/v1/admin/demand/unfilled', adminOnly, async (req, reply) => {
    const query = z
      .object({ marketCode: z.string().max(4).optional(), days: z.coerce.number().int().min(1).max(365).default(90), limit: z.coerce.number().int().min(1).max(1000).default(200) })
      .parse(req.query);
    const marketId = query.marketCode === undefined ? null : (await marketConfig.byCode(query.marketCode)).id;
    const rows = await unfilledDemand({ marketId, days: query.days }, query.limit);
    return reply.send({
      unfilled: rows.map((r) => ({
        partDescription: r.part_description,
        partCode: r.part_code,
        vehicle: r.vehicle_make === null ? null : `${r.vehicle_make} ${r.vehicle_model ?? ''} ${r.vehicle_year ?? ''}`.trim(),
        misses: Number(r.misses),
        lastSeen: toIsoUtc(r.last_seen),
        missKind: r.miss_kind,
      })),
    });
  });

  app.get('/v1/admin/demand/export', adminOnly, async (req, reply) => {
    const query = z
      .object({ marketCode: z.string().max(4).optional(), days: z.coerce.number().int().min(1).max(365).default(90) })
      .parse(req.query);
    const marketId = query.marketCode === undefined ? null : (await marketConfig.byCode(query.marketCode)).id;
    const rows = await demandDataset({ marketId, days: query.days });
    return reply.type('text/csv').header('content-disposition', 'attachment; filename="ninety-demand.csv"').send(toCsv(rows));
  });

  /** C5 — the market editor. No deploy, full audit trail. */
  app.get('/v1/admin/markets', adminOnly, async (_req, reply) => {
    const all = await marketConfig.all();
    return reply.send({ markets: all, editableFields: EDITABLE_MARKET_FIELDS });
  });

  app.put('/v1/admin/markets/:code', adminOnly, async (req, reply) => {
    const params = z.object({ code: z.string().min(2).max(4) }).parse(req.params);
    const body = z
      .object({
        reason: z.string().trim().min(3).max(300),
        changes: z.record(z.unknown()),
      })
      .parse(req.body);

    const before = await marketConfig.byCode(params.code);
    const after = await marketConfig.update(before.id, body.changes, {
      adminId: req.ctx.actor!.userId,
      reason: body.reason,
    });
    return reply.send({ before, after });
  });

  app.get('/v1/admin/markets/:code/audit', adminOnly, async (req, reply) => {
    const params = z.object({ code: z.string().min(2).max(4) }).parse(req.params);
    const market = await marketConfig.byCode(params.code);
    const rows = await getSql()<
      { field: string; old_value: string | null; new_value: string | null; reason: string | null; created_at: Date; changed_by: string | null }[]
    >`
      SELECT field, old_value, new_value, reason, created_at, changed_by
        FROM market_config_audit WHERE market_id = ${market.id}
       ORDER BY created_at DESC LIMIT 200
    `;
    return reply.send({
      audit: rows.map((r) => ({
        field: r.field,
        from: r.old_value,
        to: r.new_value,
        reason: r.reason,
        changedBy: r.changed_by,
        at: toIsoUtc(r.created_at),
      })),
    });
  });

  /** C6 — disputes and the ops queue. */
  app.get('/v1/admin/disputes', adminOnly, async (req, reply) => {
    const query = z.object({ status: z.string().max(20).optional() }).parse(req.query);
    const rows = await getDb()
      .select({ dispute: disputes, order: orders })
      .from(disputes)
      .innerJoin(orders, eq(orders.id, disputes.orderId))
      .where(query.status === undefined ? undefined : eq(disputes.status, query.status))
      .orderBy(desc(disputes.createdAt))
      .limit(200);
    return reply.send({
      disputes: rows.map((r) => ({
        id: r.dispute.id,
        orderReference: r.order.reference,
        orderTotalCents: r.order.totalCents,
        currency: r.order.currency,
        reason: r.dispute.reason,
        description: r.dispute.description,
        raisedBy: r.dispute.raisedBy,
        status: r.dispute.status,
        resolution: r.dispute.resolution,
        createdAt: toIsoUtc(r.dispute.createdAt),
      })),
    });
  });

  app.get('/v1/admin/ops-queue', adminOnly, async (req, reply) => {
    const query = z.object({ status: z.enum(['open', 'acknowledged', 'resolved']).default('open') }).parse(req.query);
    const rows = await getDb()
      .select()
      .from(opsQueue)
      .where(eq(opsQueue.status, query.status))
      .orderBy(desc(opsQueue.createdAt))
      .limit(200);
    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        severity: r.severity,
        summary: r.summary,
        requestId: r.requestId,
        orderId: r.orderId,
        status: r.status,
        createdAt: toIsoUtc(r.createdAt),
      })),
    });
  });

  app.post('/v1/admin/ops-queue/:id/resolve', adminOnly, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ resolution: z.string().trim().min(3).max(500) }).parse(req.body);
    await getDb()
      .update(opsQueue)
      .set({ status: 'resolved', resolution: body.resolution, resolvedBy: req.ctx.actor!.userId, resolvedAt: new Date() })
      .where(eq(opsQueue.id, params.id));
    return reply.send({ ok: true });
  });

  /** The identity-access audit, and its anomaly view. */
  app.get('/v1/admin/audit/identity-access', adminOnly, async (req, reply) => {
    const query = z.object({ minutes: z.coerce.number().int().min(1).max(10_080).default(1440) }).parse(req.query);
    const { identityAccessAnomalies } = await import('../security/audit.js');
    const anomalies = await identityAccessAnomalies(query.minutes, 100);
    const recent = await getSql()<
      { actor_role: string | null; route: string; allowed: boolean; created_at: Date; n: string }[]
    >`
      SELECT actor_role, route, allowed, max(created_at) AS created_at, count(*)::text AS n
        FROM identity_access_log
       WHERE created_at > now() - make_interval(mins => ${query.minutes})
       GROUP BY actor_role, route, allowed
       ORDER BY count(*) DESC LIMIT 100
    `;
    return reply.send({
      anomalies: anomalies.map((a) => ({ actorUserId: a.actor_user_id, actorRole: a.actor_role, accesses: Number(a.accesses) })),
      summary: recent.map((r) => ({
        actorRole: r.actor_role,
        route: r.route,
        allowed: r.allowed,
        accesses: Number(r.n),
        lastAt: toIsoUtc(r.created_at),
      })),
    });
  });
}

/** CSV with proper quoting. Export is on every view, per the specification. */
function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}
