import type { MatchComponents, SupplierScoreComponents } from './types.js';

/**
 * Matching weights, expressed in hundredths so that no decimal literal in this
 * file can ever be confused with a tax or commission rate. They must sum to 100.
 *
 *   0.35 stock profile match + 0.25 proximity + 0.25 supplier score + 0.15 availability
 */
export const MATCH_WEIGHTS = {
  stockProfileMatch: 35,
  proximity: 25,
  supplierScoreNorm: 25,
  availability: 15,
} as const;

export const MATCH_WEIGHT_TOTAL =
  MATCH_WEIGHTS.stockProfileMatch +
  MATCH_WEIGHTS.proximity +
  MATCH_WEIGHTS.supplierScoreNorm +
  MATCH_WEIGHTS.availability;

/**
 * Inclusion thresholds, in hundredths for the same reason the weights are.
 *
 * Tier 1 is deliberately low: breadth is what produces offers inside fifteen
 * minutes, and a fan-out capped or filtered "for efficiency" reduces fill rate,
 * which is the number the whole business depends on.
 */
export const TIER1_SCORE_THRESHOLD = 30 / 100;

/** Tier 2 drops the stock-profile weight entirely and extends the radius by half. */
export const TIER2_RADIUS_MULTIPLIER = 1.5;
export const TIER2_SCORE_THRESHOLD = 15 / 100;

export interface MatchInput {
  readonly supplierId: string;
  readonly stockProfileMatch: number;
  readonly proximity: number;
  readonly supplierScoreNorm: number;
  readonly availability: number;
  readonly distanceKm: number;
}

/**
 * Compute a supplier's match score for a request, and report every component.
 *
 * The components are returned rather than logged here because the caller
 * persists them: "I need to debug matching decisions without reading code" is an
 * operational requirement that recurs weekly, forever.
 */
export function scoreSupplier(input: MatchInput, opts: { dropStockProfile: boolean; threshold: number }): MatchComponents {
  const w = opts.dropStockProfile
    ? { ...MATCH_WEIGHTS, stockProfileMatch: 0 }
    : MATCH_WEIGHTS;
  const weightTotal = w.stockProfileMatch + w.proximity + w.supplierScoreNorm + w.availability;

  const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
  const stock = clamp01(input.stockProfileMatch);
  const prox = clamp01(input.proximity);
  const perf = clamp01(input.supplierScoreNorm);
  const avail = clamp01(input.availability);

  const weighted =
    w.stockProfileMatch * stock + w.proximity * prox + w.supplierScoreNorm * perf + w.availability * avail;
  const total = weightTotal === 0 ? 0 : weighted / weightTotal;

  const selected = total >= opts.threshold;
  const reason = selected
    ? `selected: total ${total.toFixed(3)} >= threshold ${opts.threshold}`
    : `excluded: total ${total.toFixed(3)} < threshold ${opts.threshold}`;

  return {
    supplierId: input.supplierId,
    stockProfileMatch: stock,
    proximity: prox,
    supplierScoreNorm: perf,
    availability: avail,
    total,
    distanceKm: input.distanceKm,
    selected,
    reason,
  };
}

/** Proximity component: 1 at the door, 0 at the edge of the supplier's radius. */
export function proximityScore(distanceKm: number, maxRadiusKm: number): number {
  if (maxRadiusKm <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - distanceKm / maxRadiusKm));
}

/**
 * The supplier score.
 *
 *   score = 3.0
 *         + 1.0 × response_rate_30d
 *         + 0.5 × (1 − normalised_median_response_time)
 *         + 0.5 × fulfilment_rate_30d
 *         − 2.0 × dispute_rate_30d          clamped to [0, 5]
 *
 * It is surfaced prominently on the terminal because a score nobody sees changes
 * nobody's behaviour, and the whole supply-side incentive rests on a yard
 * understanding that answering faster earns more.
 */
export const SUPPLIER_SCORE_BASE = 3.0;
export const SUPPLIER_SCORE_MAX = 5.0;
export const SUPPLIER_SCORE_MIN = 0.0;

export function computeSupplierScore(c: SupplierScoreComponents): number {
  const raw =
    SUPPLIER_SCORE_BASE +
    1.0 * clamp01(c.responseRate30d) +
    0.5 * (1 - clamp01(c.normalisedMedianResponseTime)) +
    0.5 * clamp01(c.fulfilmentRate30d) -
    2.0 * clamp01(c.disputeRate30d);
  return Number(Math.min(SUPPLIER_SCORE_MAX, Math.max(SUPPLIER_SCORE_MIN, raw)).toFixed(2));
}

/** Normalise a score onto 0–1 for use as a matching component. */
export function normaliseSupplierScore(score: number): number {
  return clamp01((score - SUPPLIER_SCORE_MIN) / (SUPPLIER_SCORE_MAX - SUPPLIER_SCORE_MIN));
}

/**
 * Normalise a median response time onto 0–1, where 0 is instant and 1 is at or
 * beyond the response window. Expressed against the market's own window so a
 * market with a different SLA does not need a different formula.
 */
export function normaliseMedianResponseTime(medianSeconds: number | null, responseWindowSeconds: number): number {
  if (medianSeconds === null || responseWindowSeconds <= 0) return 1;
  return clamp01(medianSeconds / responseWindowSeconds);
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Score deltas written to supplier_score_events, for an auditable history.
 *
 * Expressed in hundredths of a score point, for the same reason the matching
 * weights are: a bare decimal in application code is indistinguishable from a
 * tax or commission rate to the guard that keeps market values out of the
 * codebase, and the guard is worth more than the convenience.
 *
 * Note `unreachable` is deliberately zero. A yard whose terminal was demonstrably
 * offline at fan-out — a flat tablet, a metal roof, a load-shedding slot — has not
 * failed to respond, and penalising a yard for an outage is the fastest way to
 * lose the yards it took three months to sign.
 */
export const SCORE_EVENT_DELTA_HUNDREDTHS = {
  responded_fast: 5,
  responded: 2,
  no_response: -5,
  declined: 0,
  fulfilled: 10,
  cancelled_after_win: -25,
  disputed: -50,
  unreachable: 0,
} as const;

export type ScoreEvent = keyof typeof SCORE_EVENT_DELTA_HUNDREDTHS;

/** The delta in score points, for writing to supplier_score_events.delta. */
export function scoreEventDelta(event: ScoreEvent): number {
  return SCORE_EVENT_DELTA_HUNDREDTHS[event] / 100;
}
