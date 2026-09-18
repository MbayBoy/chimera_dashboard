import { describe, expect, it } from 'vitest';
import type { MarketConfig } from '@ninety/shared';
import { computeOrderBreakdown, deliveryChargeForBuyer, reconciles } from './pricing.js';

/**
 * Money reconciliation.
 *
 * The rates below are arbitrary test values, not any market's. A test is not a
 * place to write a launch market's commission rate either — the point of the
 * guard is that the number lives in one table.
 */
function market(overrides: Partial<MarketConfig> = {}): MarketConfig {
  return {
    id: 'm1',
    code: 'XX',
    name: 'Test Market',
    currency: 'XTS',
    currencyMinorUnitExponent: 2,
    locales: ['en-XX'],
    localeDefault: 'en-XX',
    rtl: false,
    timezone: 'UTC',
    vehicleIdentifier: { type: 'vin', regex: null },
    paymentProvider: 'stub',
    courierProviders: [],
    tax: { rate: 0.071, label: 'Tax', inclusive: false },
    sla: { responseMin: 15, offersMin: 30, deliveryMin: 90, deliveryPeakMin: 180 },
    fees: { commissionRate: 0.093, buyerFeeRate: 0.037, deliveryMarkupRate: 0.25 },
    addressModel: 'hybrid',
    businessCalendar: { weekendDays: [6, 0], holidays: [] },
    isLive: true,
    ...overrides,
  };
}

describe('order breakdown', () => {
  it('produces integers for every component', () => {
    const b = computeOrderBreakdown({ partCents: 42_000, deliveryCents: 2_600, market: market() });
    for (const [name, value] of Object.entries(b)) {
      if (typeof value === 'number') expect(Number.isInteger(value), `${name} is not an integer`).toBe(true);
    }
  });

  it('reconciles exactly across 10,000 randomised orders, with no rounding drift', () => {
    // The failure this catches: each rounding step independently reasonable,
    // together losing a cent per order.
    const m = market();
    let drift = 0;
    let checked = 0;
    for (let i = 0; i < 10_000; i++) {
      const partCents = 500 + ((i * 7919) % 1_200_000);
      const deliveryCents = 300 + ((i * 104_729) % 9_000);
      const b = computeOrderBreakdown({ partCents, deliveryCents, market: m });
      if (!reconciles(b, false)) drift += 1;
      if (b.totalCents !== b.partCents + b.deliveryCents + b.buyerFeeCents + b.taxCents) drift += 1;
      if (b.supplierPayoutCents + b.commissionCents !== b.partCents) drift += 1;
      checked += 1;
    }
    expect(checked).toBe(10_000);
    expect(drift).toBe(0);
  });

  it('reconciles under an inclusive-tax market too', () => {
    const m = market({ tax: { rate: 0.05, label: 'Tax', inclusive: true } });
    for (let i = 0; i < 2_000; i++) {
      const b = computeOrderBreakdown({ partCents: 1_000 + i * 37, deliveryCents: 500 + i, market: m });
      expect(reconciles(b, true)).toBe(true);
      // Inclusive: the tax is inside the total rather than added to it.
      expect(b.totalCents).toBe(b.partCents + b.deliveryCents + b.buyerFeeCents);
      expect(b.taxCents).toBeGreaterThan(0);
    }
  });

  it('honours the commission-free launch period without breaking the payout identity', () => {
    const b = computeOrderBreakdown({ partCents: 50_000, deliveryCents: 3_000, market: market(), commissionFree: true });
    expect(b.commissionCents).toBe(0);
    expect(b.supplierPayoutCents).toBe(b.partCents);
    expect(reconciles(b, false)).toBe(true);
  });

  it('gives the buyer free delivery without unbalancing the total', () => {
    const b = computeOrderBreakdown({ partCents: 50_000, deliveryCents: 0, market: market() });
    expect(b.deliveryCents).toBe(0);
    expect(reconciles(b, false)).toBe(true);
  });

  it('takes every rate from market configuration rather than a constant', () => {
    const cheap = computeOrderBreakdown({ partCents: 100_000, deliveryCents: 0, market: market() });
    const dear = computeOrderBreakdown({
      partCents: 100_000,
      deliveryCents: 0,
      market: market({ fees: { commissionRate: 0.2, buyerFeeRate: 0.1, deliveryMarkupRate: 0.25 } }),
    });
    expect(dear.commissionCents).toBeGreaterThan(cheap.commissionCents);
    expect(dear.buyerFeeCents).toBeGreaterThan(cheap.buyerFeeCents);
  });

  it('marks up the courier cost for the buyer, and can waive it', () => {
    const m = market();
    expect(deliveryChargeForBuyer(2_000, m)).toBe(2_500);
    // Free first orders are an adoption incentive, not a rounding case.
    expect(deliveryChargeForBuyer(2_000, m, true)).toBe(0);
  });

  it('refuses a non-integer input rather than rounding it quietly', () => {
    expect(() => computeOrderBreakdown({ partCents: 420.5, deliveryCents: 0, market: market() })).toThrow();
  });
});
