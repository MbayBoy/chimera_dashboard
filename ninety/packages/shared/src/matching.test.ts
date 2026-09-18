import { describe, expect, it } from 'vitest';
import {
  computeSupplierScore,
  MATCH_WEIGHT_TOTAL,
  MATCH_WEIGHTS,
  normaliseMedianResponseTime,
  normaliseSupplierScore,
  proximityScore,
  scoreEventDelta,
  scoreSupplier,
  TIER1_SCORE_THRESHOLD,
  TIER2_SCORE_THRESHOLD,
} from './matching.js';

describe('matching score', () => {
  it('weights sum to a whole, so the total is a real 0–1 score', () => {
    expect(MATCH_WEIGHT_TOTAL).toBe(100);
    expect(MATCH_WEIGHTS.stockProfileMatch).toBeGreaterThan(MATCH_WEIGHTS.availability);
  });

  it('scores a perfect supplier at 1 and a hopeless one at 0', () => {
    const perfect = scoreSupplier(
      { supplierId: 's', stockProfileMatch: 1, proximity: 1, supplierScoreNorm: 1, availability: 1, distanceKm: 0 },
      { dropStockProfile: false, threshold: TIER1_SCORE_THRESHOLD },
    );
    expect(perfect.total).toBeCloseTo(1, 6);
    expect(perfect.selected).toBe(true);

    const hopeless = scoreSupplier(
      { supplierId: 's', stockProfileMatch: 0, proximity: 0, supplierScoreNorm: 0, availability: 0, distanceKm: 99 },
      { dropStockProfile: false, threshold: TIER1_SCORE_THRESHOLD },
    );
    expect(hopeless.total).toBe(0);
    expect(hopeless.selected).toBe(false);
  });

  it('explains every decision in words, because matching is debugged weekly forever', () => {
    const decision = scoreSupplier(
      { supplierId: 's', stockProfileMatch: 0.9, proximity: 0.8, supplierScoreNorm: 0.7, availability: 1, distanceKm: 8 },
      { dropStockProfile: false, threshold: TIER1_SCORE_THRESHOLD },
    );
    expect(decision.reason).toContain('selected');
    expect(decision.reason).toContain(String(TIER1_SCORE_THRESHOLD));
  });

  it('tier 2 drops the stock-profile weight entirely', () => {
    const input = { supplierId: 's', stockProfileMatch: 0, proximity: 0.9, supplierScoreNorm: 0.8, availability: 1, distanceKm: 20 };
    const tier1 = scoreSupplier(input, { dropStockProfile: false, threshold: TIER1_SCORE_THRESHOLD });
    const tier2 = scoreSupplier(input, { dropStockProfile: true, threshold: TIER2_SCORE_THRESHOLD });
    // A yard whose stock profile does not match is excluded in tier 1 and
    // reachable in tier 2 — which is what widening is for.
    expect(tier2.total).toBeGreaterThan(tier1.total);
    expect(tier2.selected).toBe(true);
  });

  it('clamps nonsense inputs rather than propagating them', () => {
    const decision = scoreSupplier(
      { supplierId: 's', stockProfileMatch: 5, proximity: -2, supplierScoreNorm: Number.NaN, availability: 1, distanceKm: 3 },
      { dropStockProfile: false, threshold: TIER1_SCORE_THRESHOLD },
    );
    expect(decision.stockProfileMatch).toBe(1);
    expect(decision.proximity).toBe(0);
    expect(decision.supplierScoreNorm).toBe(0);
    expect(decision.total).toBeLessThanOrEqual(1);
  });

  it('proximity falls from 1 at the door to 0 at the radius edge', () => {
    expect(proximityScore(0, 50)).toBe(1);
    expect(proximityScore(25, 50)).toBeCloseTo(0.5, 6);
    expect(proximityScore(50, 50)).toBe(0);
    expect(proximityScore(80, 50)).toBe(0);
    expect(proximityScore(10, 0)).toBe(0);
  });
});

describe('supplier score', () => {
  it('starts a new yard at the base score', () => {
    expect(
      computeSupplierScore({ responseRate30d: 0, normalisedMedianResponseTime: 1, fulfilmentRate30d: 0, disputeRate30d: 0 }),
    ).toBe(3);
  });

  it('rewards a fast, reliable yard up to the ceiling', () => {
    expect(
      computeSupplierScore({ responseRate30d: 1, normalisedMedianResponseTime: 0, fulfilmentRate30d: 1, disputeRate30d: 0 }),
    ).toBe(5);
  });

  it('punishes disputes hard enough to matter', () => {
    // A scoring model that only ever goes up is decoration. The dispute penalty
    // is the one most often left out because it is hard to trigger in testing.
    const clean = computeSupplierScore({ responseRate30d: 1, normalisedMedianResponseTime: 0, fulfilmentRate30d: 1, disputeRate30d: 0 });
    const disputed = computeSupplierScore({ responseRate30d: 1, normalisedMedianResponseTime: 0, fulfilmentRate30d: 1, disputeRate30d: 0.5 });
    expect(disputed).toBeLessThan(clean);
    expect(clean - disputed).toBeCloseTo(1, 2);
  });

  it('never leaves the 0–5 range', () => {
    const worst = computeSupplierScore({ responseRate30d: 0, normalisedMedianResponseTime: 1, fulfilmentRate30d: 0, disputeRate30d: 1 });
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(5);
  });

  it('normalises a score onto 0–1 for use as a matching component', () => {
    expect(normaliseSupplierScore(0)).toBe(0);
    expect(normaliseSupplierScore(5)).toBe(1);
    expect(normaliseSupplierScore(3)).toBeCloseTo(0.6, 6);
  });

  it('measures response time against the market own window, not a fixed number', () => {
    expect(normaliseMedianResponseTime(null, 900)).toBe(1);
    expect(normaliseMedianResponseTime(0, 900)).toBe(0);
    expect(normaliseMedianResponseTime(450, 900)).toBeCloseTo(0.5, 6);
    expect(normaliseMedianResponseTime(5000, 900)).toBe(1);
  });

  it('does not penalise a yard whose terminal was unreachable', () => {
    // Penalising a yard for a power cut or a flat tablet is the fastest way to
    // lose the yards it took three months to sign.
    expect(scoreEventDelta('unreachable')).toBe(0);
    expect(scoreEventDelta('no_response')).toBeLessThan(0);
    expect(scoreEventDelta('fulfilled')).toBeGreaterThan(0);
    expect(scoreEventDelta('disputed')).toBeLessThan(scoreEventDelta('no_response'));
  });
});
