import { eq, sql } from 'drizzle-orm';
import {
  computeSupplierScore,
  normaliseMedianResponseTime,
  scoreEventDelta,
  type ScoreEvent,
} from '@ninety/shared';
import { getDb, getSql } from '../db/client.js';
import { suppliers, supplierScoreEvents } from '../db/schema.js';
import { marketConfig } from '../market/config.js';
import { log } from '../core/logger.js';

/**
 * Supplier scoring.
 *
 *   score = 3.0
 *         + 1.0 × response_rate_30d
 *         + 0.5 × (1 − normalised_median_response_time)
 *         + 0.5 × fulfilment_rate_30d
 *         − 2.0 × dispute_rate_30d          clamped to [0, 5]
 *
 * The commercial logic is that fast yards receive more requests and therefore
 * earn more, so speed pays. That only works if the yard can see it, which is why
 * the score is on the terminal and why every change writes an auditable event.
 *
 * A scoring model that only ever goes up is decoration. The no-response and
 * dispute penalties are here, and they are tested, because they are the ones
 * most often left out — they are harder to trigger deliberately.
 */

export async function recordScoreEvent(
  supplierId: string,
  event: ScoreEvent,
  context: { requestId?: string | null; note?: string } = {},
): Promise<void> {
  const delta = scoreEventDelta(event);
  await getDb().insert(supplierScoreEvents).values({
    supplierId,
    event,
    delta: delta.toFixed(2),
    requestId: context.requestId ?? null,
    note: context.note ?? null,
  });
  // Recomputed from the underlying rates rather than accumulated from deltas:
  // an accumulated score drifts, and a yard that disputes their rank deserves a
  // number that can be rederived from the record.
  await recomputeSupplierScore(supplierId);
}

/**
 * Recompute a supplier's score from their last 30 days.
 *
 * Runs on every terminal event and nightly. A fan-out sent while the terminal
 * was demonstrably offline is excluded from the denominator — penalising a yard
 * for a power cut or a flat tablet is the fastest way to lose the yards it took
 * three months to sign.
 */
export async function recomputeSupplierScore(supplierId: string): Promise<number> {
  const supplier = (await getDb().select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1))[0];
  if (!supplier) return 0;

  const market = await marketForSupplier(supplierId);
  const responseWindowSeconds = market.sla.responseMin * 60;

  const stats = (
    await getSql()<
      {
        reachable_fanouts: string;
        responded: string;
        median_response_s: string | null;
        won: string;
        fulfilled: string;
        disputed: string;
      }[]
    >`
      SELECT
        (SELECT count(*) FROM request_fanouts
           WHERE supplier_id = ${supplierId} AND sent_at > now() - interval '30 days'
             AND was_online_at_send = true AND coalesce(outcome, '') <> 'unreachable')::text AS reachable_fanouts,
        (SELECT count(*) FROM request_fanouts
           WHERE supplier_id = ${supplierId} AND sent_at > now() - interval '30 days'
             AND outcome IN ('offered', 'declined'))::text AS responded,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY response_seconds)
           FROM offers WHERE supplier_id = ${supplierId}
             AND created_at > now() - interval '30 days')::text AS median_response_s,
        (SELECT count(*) FROM orders WHERE supplier_id = ${supplierId}
           AND created_at > now() - interval '30 days')::text AS won,
        (SELECT count(*) FROM orders WHERE supplier_id = ${supplierId}
           AND created_at > now() - interval '30 days' AND status = 'captured')::text AS fulfilled,
        (SELECT count(*) FROM disputes d JOIN orders o ON o.id = d.order_id
           WHERE o.supplier_id = ${supplierId} AND d.created_at > now() - interval '30 days'
             AND d.status <> 'rejected')::text AS disputed
    `
  )[0]!;

  const reachable = Number(stats.reachable_fanouts);
  const responded = Number(stats.responded);
  const won = Number(stats.won);
  const fulfilled = Number(stats.fulfilled);
  const disputed = Number(stats.disputed);
  const medianResponse = stats.median_response_s === null ? null : Number(stats.median_response_s);

  // A yard with no reachable fan-outs yet is neither good nor bad. Starting them
  // at zero response rate would sink a new yard before it had a chance to answer
  // anything, and new yards are the entire supply pipeline.
  const responseRate = reachable === 0 ? Number(supplier.responseRate) : Math.min(1, responded / reachable);
  const fulfilmentRate = won === 0 ? Number(supplier.fulfilmentRate) : fulfilled / won;
  const disputeRate = won === 0 ? 0 : Math.min(1, disputed / won);

  const score = computeSupplierScore({
    responseRate30d: responseRate,
    normalisedMedianResponseTime: normaliseMedianResponseTime(medianResponse, responseWindowSeconds),
    fulfilmentRate30d: fulfilmentRate,
    disputeRate30d: disputeRate,
  });

  await getDb()
    .update(suppliers)
    .set({
      score: score.toFixed(2),
      responseRate: responseRate.toFixed(4),
      medianResponseS: medianResponse === null ? null : Math.round(medianResponse),
      fulfilmentRate: fulfilmentRate.toFixed(4),
      disputeRate: disputeRate.toFixed(4),
    })
    .where(eq(suppliers.id, supplierId));

  await getDb()
    .update(supplierScoreEvents)
    .set({ scoreAfter: score.toFixed(2) })
    .where(sql`${supplierScoreEvents.supplierId} = ${supplierId} AND ${supplierScoreEvents.scoreAfter} IS NULL`);

  return score;
}

/**
 * Raise a yard's stock-profile threshold when their decline rate climbs.
 *
 * A supplier who keeps receiving work they do not want stops watching the
 * terminal, and a terminal nobody watches breaks the SLA for every buyer.
 * Relevance protects the clock, so the system tightens what it sends them
 * instead of waiting for someone to notice.
 */
export async function adjustStockThresholdForDeclineRate(supplierId: string, declineRate: number): Promise<number> {
  // Below 40% declines, send everything that matches. Above that, tighten in
  // proportion, to a ceiling that still lets genuinely relevant work through.
  const LOW = 0.4;
  const CEILING = 0.6;
  const threshold = declineRate <= LOW ? 0 : Math.min(CEILING, (declineRate - LOW) * 1.5);
  await getDb()
    .update(suppliers)
    .set({ stockMatchThreshold: threshold.toFixed(3) })
    .where(eq(suppliers.id, supplierId));
  if (threshold > 0) {
    log.info('raised stock-profile threshold after declines', { supplierId, declineRate, threshold });
  }
  return threshold;
}

/** Nightly recomputation across every active supplier. */
export async function recomputeAllSupplierScores(): Promise<number> {
  const rows = await getDb().select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.status, 'active'));
  for (const row of rows) await recomputeSupplierScore(row.id);
  log.info('nightly supplier score recomputation complete', { suppliers: rows.length });
  return rows.length;
}

async function marketForSupplier(supplierId: string) {
  const rows = await getSql()<{ market_id: string }[]>`
    SELECT c.market_id FROM suppliers s JOIN cities c ON c.id = s.city_id WHERE s.id = ${supplierId}
  `;
  return marketConfig.byId(rows[0]!.market_id);
}
