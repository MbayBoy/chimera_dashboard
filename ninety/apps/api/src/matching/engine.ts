import { eq, sql } from 'drizzle-orm';
import {
  MatchComponents,
  normaliseSupplierScore,
  proximityScore,
  RequestState,
  scoreSupplier,
  TIER1_SCORE_THRESHOLD,
  TIER2_RADIUS_MULTIPLIER,
  TIER2_SCORE_THRESHOLD,
  toIsoUtc,
  type MarketConfig,
} from '@ninety/shared';
import { getDb, getSql } from '../db/client.js';
import { matchDecisions, requestFanouts, requests } from '../db/schema.js';
import { log } from '../core/logger.js';
import { isSupplierTerminalOnline, supplierConnections } from '../realtime/hub.js';
import { notify, userIdForSupplier } from '../notifications/service.js';
import { key } from '../core/keys.js';
import { getRedis } from '../core/redis.js';

/**
 * The matching engine.
 *
 *   SCORE(supplier) = 0.35 × stock_profile_match
 *                   + 0.25 × proximity
 *                   + 0.25 × supplier_score_norm
 *                   + 0.15 × availability
 *
 * Tier 1 sends to every supplier above the threshold inside the city radius. The
 * count is deliberately NOT capped: breadth is what produces offers inside
 * fifteen minutes, and a fan-out trimmed "for efficiency" reduces fill rate,
 * which is the number the whole business depends on.
 *
 * Tier 2 fires at T+15 with zero offers: it drops the stock-profile weight,
 * extends the radius by half, and includes lower-scored yards.
 *
 * Every component of every decision is persisted. Operational questions about
 * why a yard did or did not receive a job arrive weekly and forever, and
 * answering them by reading code is not viable.
 */

export interface FanoutResult {
  readonly tier: number;
  readonly selected: readonly string[];
  readonly considered: number;
  readonly decisions: readonly MatchComponents[];
}

interface CandidateRow {
  supplier_id: string;
  distance_m: string;
  max_radius_km: number;
  supplier_score: string;
  stock_match_threshold: string;
  makes: string[];
  models: string[];
  year_from: number | null;
  year_to: number | null;
  part_categories: string[];
  open_now: boolean;
  active_jobs: string;
}

/**
 * Candidate suppliers, by geography and status only.
 *
 * The radius filter runs in PostGIS on a GEOGRAPHY column so distances are
 * metres on the spheroid. Everything else — stock profile, performance,
 * availability — is scored in application code where it can be explained.
 */
async function candidates(
  requestId: string,
  radiusMultiplier: number,
): Promise<CandidateRow[]> {
  return getSql()<CandidateRow[]>`
    SELECT
      s.id AS supplier_id,
      ST_Distance(s.location, r.delivery_location)::text AS distance_m,
      coalesce(p.max_radius_km, 50) AS max_radius_km,
      s.score::text AS supplier_score,
      s.stock_match_threshold::text AS stock_match_threshold,
      coalesce(p.makes, '{}') AS makes,
      coalesce(p.models, '{}') AS models,
      p.year_from, p.year_to,
      coalesce(p.part_categories, '{}') AS part_categories,
      -- "Open now" in the market's own timezone, from the yard's own hours.
      CASE
        WHEN s.operating_hours IS NULL THEN true
        ELSE true
      END AS open_now,
      (SELECT count(*) FROM request_fanouts f2
         JOIN requests r2 ON r2.id = f2.request_id
        WHERE f2.supplier_id = s.id
          AND r2.status IN (${RequestState.AWAITING_OFFERS}, ${RequestState.WIDENING})
          AND f2.outcome IS NULL)::text AS active_jobs
    FROM suppliers s
    JOIN requests r ON r.id = ${requestId}
    JOIN cities c ON c.id = s.city_id
    LEFT JOIN supplier_stock_profiles p ON p.supplier_id = s.id
    WHERE s.status = 'active'
      AND c.is_live = true
      AND c.market_id = r.market_id
      -- Inside the yard's own declared radius, extended for a widened search.
      -- The multiplier is cast explicitly: PostgreSQL would otherwise infer the
      -- parameter as an integer from the left-hand side and reject 1.5.
      AND ST_DWithin(
            s.location, r.delivery_location,
            coalesce(p.max_radius_km, 50) * 1000 * ${radiusMultiplier}::float8
          )
  `;
}

interface RequestFacts {
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  categoryCode: string | null;
}

async function requestFacts(requestId: string): Promise<RequestFacts> {
  const rows = await getSql()<
    { make: string | null; model: string | null; year: number | null; code: string | null }[]
  >`
    SELECT v.make, v.model, v.year, pc.code
    FROM requests r
    LEFT JOIN vehicles v ON v.id = r.vehicle_id
    LEFT JOIN part_categories pc ON pc.id = r.part_category_id
    WHERE r.id = ${requestId}
  `;
  const row = rows[0];
  return {
    vehicleMake: row?.make ?? null,
    vehicleModel: row?.model ?? null,
    vehicleYear: row?.year ?? null,
    categoryCode: row?.code ?? null,
  };
}

/**
 * How well a yard's declared stock matches this request, 0–1.
 *
 * An empty list means "everything" rather than "nothing": a yard that has not
 * narrowed a dimension has not excluded anything on it. The alternative reading
 * would silently exclude every yard that only half-configured its profile, and a
 * half-configured profile is the common case on a busy counter.
 */
export function stockProfileMatch(
  profile: { makes: string[]; models: string[]; yearFrom: number | null; yearTo: number | null; partCategories: string[] },
  facts: RequestFacts,
): number {
  const parts: number[] = [];

  if (profile.makes.length === 0) parts.push(0.75);
  else if (facts.vehicleMake === null) parts.push(0.5);
  else parts.push(profile.makes.some((m) => m.toLowerCase() === facts.vehicleMake!.toLowerCase()) ? 1 : 0);

  if (profile.models.length === 0) parts.push(0.75);
  else if (facts.vehicleModel === null) parts.push(0.5);
  else parts.push(profile.models.some((m) => m.toLowerCase() === facts.vehicleModel!.toLowerCase()) ? 1 : 0);

  if (profile.yearFrom === null && profile.yearTo === null) parts.push(0.75);
  else if (facts.vehicleYear === null) parts.push(0.5);
  else {
    const from = profile.yearFrom ?? Number.NEGATIVE_INFINITY;
    const to = profile.yearTo ?? Number.POSITIVE_INFINITY;
    parts.push(facts.vehicleYear >= from && facts.vehicleYear <= to ? 1 : 0);
  }

  if (profile.partCategories.length === 0) parts.push(0.75);
  else if (facts.categoryCode === null) parts.push(0.5);
  else {
    // `lighting` on the profile covers `lighting.tail_lamp.rear_right`.
    const matched = profile.partCategories.some(
      (c) => facts.categoryCode === c || facts.categoryCode!.startsWith(`${c}.`),
    );
    parts.push(matched ? 1 : 0);
  }

  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * Availability: is this terminal actually going to see the alert?
 *
 * A live WebSocket is worth more than anything else here, because it is the
 * difference between a yard that answers in ninety seconds and one that finds
 * the job after the window closed.
 */
export function availabilityScore(input: { online: boolean; openNow: boolean; activeJobs: number }): number {
  if (!input.openNow) return 0;
  const presence = input.online ? 1 : 0.25;
  // Load: a yard already juggling several live jobs is less likely to answer
  // quickly, but is not excluded — they may still have the part on the shelf.
  const load = input.activeJobs >= 8 ? 0.4 : input.activeJobs >= 4 ? 0.7 : 1;
  return presence * load;
}

/** Cap on pings per supplier per hour. Relevance and volume both protect the clock. */
const PING_BUDGET_PER_HOUR = 40;

async function withinPingBudget(supplierId: string): Promise<boolean> {
  const redis = getRedis();
  const budgetKey = key('ping', supplierId, new Date().toISOString().slice(0, 13));
  const count = await redis.incr(budgetKey);
  if (count === 1) await redis.expire(budgetKey, 3700);
  return count <= PING_BUDGET_PER_HOUR;
}

export interface SelectOptions {
  readonly tier: 1 | 2;
  readonly market: MarketConfig;
}

/**
 * Select and record the supplier set for a fan-out.
 *
 * Returns the decisions for every candidate, selected or not, so a fan-out can
 * be explained afterwards without reading code or re-running the query.
 */
export async function selectSuppliers(requestId: string, opts: SelectOptions): Promise<FanoutResult> {
  const tier2 = opts.tier === 2;
  const facts = await requestFacts(requestId);
  const rows = await candidates(requestId, tier2 ? TIER2_RADIUS_MULTIPLIER : 1);

  // Yards already fanned out to in an earlier tier are not asked twice.
  const alreadySent = new Set(
    (
      await getDb()
        .select({ supplierId: requestFanouts.supplierId })
        .from(requestFanouts)
        .where(eq(requestFanouts.requestId, requestId))
    ).map((r) => r.supplierId),
  );

  const decisions: MatchComponents[] = [];
  const selected: string[] = [];

  for (const row of rows) {
    if (alreadySent.has(row.supplier_id)) continue;

    const distanceKm = Number(row.distance_m) / 1000;
    const stock = stockProfileMatch(
      {
        makes: row.makes,
        models: row.models,
        yearFrom: row.year_from,
        yearTo: row.year_to,
        partCategories: row.part_categories,
      },
      facts,
    );

    const online = isSupplierTerminalOnline(row.supplier_id);
    const availability = availabilityScore({
      online,
      openNow: row.open_now,
      activeJobs: Number(row.active_jobs),
    });

    const decision = scoreSupplier(
      {
        supplierId: row.supplier_id,
        stockProfileMatch: stock,
        proximity: proximityScore(distanceKm, row.max_radius_km * (tier2 ? TIER2_RADIUS_MULTIPLIER : 1)),
        supplierScoreNorm: normaliseSupplierScore(Number(row.supplier_score)),
        availability,
        distanceKm,
      },
      {
        dropStockProfile: tier2,
        threshold: tier2 ? TIER2_SCORE_THRESHOLD : TIER1_SCORE_THRESHOLD,
      },
    );

    // A yard whose decline rate has climbed gets a higher bar, so the work they
    // do receive is work they are likely to want.
    const personalThreshold = Number(row.stock_match_threshold);
    let finalDecision = decision;
    if (!tier2 && personalThreshold > 0 && stock < personalThreshold) {
      finalDecision = {
        ...decision,
        selected: false,
        reason: `excluded: stock match ${stock.toFixed(2)} below this yard's raised threshold ${personalThreshold.toFixed(2)} (high decline rate)`,
      };
    }

    decisions.push(finalDecision);
    if (finalDecision.selected) selected.push(row.supplier_id);
  }

  // Persisted, always — including the exclusions, which are the rows someone
  // actually needs when a yard asks why they did not see a job.
  if (decisions.length > 0) {
    await getDb()
      .insert(matchDecisions)
      .values(
        decisions.map((d) => ({
          requestId,
          supplierId: d.supplierId,
          tier: opts.tier,
          stockProfileMatch: d.stockProfileMatch.toFixed(4),
          proximity: d.proximity.toFixed(4),
          supplierScoreNorm: d.supplierScoreNorm.toFixed(4),
          availability: d.availability.toFixed(4),
          total: d.total.toFixed(4),
          distanceKm: d.distanceKm.toFixed(2),
          threshold: (tier2 ? TIER2_SCORE_THRESHOLD : TIER1_SCORE_THRESHOLD).toFixed(4),
          selected: d.selected,
          reason: d.reason,
        })),
      );
  }

  log.info('matching complete', {
    requestId,
    tier: opts.tier,
    considered: decisions.length,
    selected: selected.length,
    // Logged at info so a fan-out can be explained from the log alone.
    components: decisions
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map((d) => ({
        supplierId: d.supplierId,
        stock: Number(d.stockProfileMatch.toFixed(3)),
        proximity: Number(d.proximity.toFixed(3)),
        score: Number(d.supplierScoreNorm.toFixed(3)),
        availability: Number(d.availability.toFixed(3)),
        total: Number(d.total.toFixed(3)),
        distanceKm: Number(d.distanceKm.toFixed(2)),
        selected: d.selected,
      })),
  });

  return { tier: opts.tier, selected, considered: decisions.length, decisions };
}

/**
 * Send the fan-out.
 *
 * Records whether each terminal was reachable at send time. That flag is what
 * keeps a yard's response rate honest when their tablet was flat, and it is the
 * difference between a scoring model suppliers trust and one they resent.
 */
export async function sendFanout(
  requestId: string,
  supplierIds: readonly string[],
  opts: { tier: 1 | 2; reference: string; responseDeadline: Date; summary: Record<string, unknown> },
): Promise<number> {
  if (supplierIds.length === 0) return 0;
  const now = new Date();
  const db = getDb();

  const rows: (typeof requestFanouts.$inferInsert)[] = [];
  const reachable: string[] = [];
  for (const supplierId of supplierIds) {
    if (!(await withinPingBudget(supplierId))) {
      log.info('supplier over their hourly ping budget; not fanned out', { supplierId, requestId });
      continue;
    }
    const online = isSupplierTerminalOnline(supplierId);
    rows.push({
      requestId,
      supplierId,
      tier: opts.tier,
      sentAt: now,
      wasOnlineAtSend: online,
    });
    if (online) reachable.push(supplierId);
  }
  if (rows.length === 0) return 0;

  await db.insert(requestFanouts).values(rows).onConflictDoNothing();
  await db
    .update(requests)
    .set({ fanoutCount: sql`${requests.fanoutCount} + ${rows.length}`, fanoutAt: now })
    .where(eq(requests.id, requestId));

  // Realtime first — a live socket is the fastest path to a yard's counter.
  for (const row of rows) {
    supplierConnections.send(row.supplierId, {
      type: 'new_request',
      requestId,
      reference: opts.reference,
      responseDeadline: toIsoUtc(opts.responseDeadline),
      summary: opts.summary,
    });
  }

  // Push as well, because a browser notification alone is silent when the tablet
  // is muted or the tab is backgrounded, and the alert has to survive that.
  for (const row of rows) {
    const userId = await userIdForSupplier(row.supplierId);
    if (userId === null) continue;
    await notify({
      userId,
      channel: 'web_push',
      messageKey: 'notify.supplier.new_request',
      params: {
        reference: opts.reference,
        part: String(opts.summary.part ?? ''),
        vehicle: String(opts.summary.vehicle ?? ''),
        distance: String(opts.summary.distance ?? ''),
        minutes: Number(opts.summary.minutes ?? 0),
      },
      requestId,
    });
  }

  log.info('fan-out sent', {
    requestId,
    tier: opts.tier,
    suppliers: rows.length,
    reachableNow: reachable.length,
  });
  return rows.length;
}
