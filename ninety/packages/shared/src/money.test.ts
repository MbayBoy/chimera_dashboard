import { describe, expect, it } from 'vitest';
import { applyRate, assertCents, formatMoney, MoneyError, roundToCents, sumCents, taxOn } from './money.js';

describe('money is integer minor units, always', () => {
  it('refuses a non-integer amount', () => {
    expect(() => assertCents(1450.5)).toThrow(MoneyError);
    expect(() => assertCents(Number.NaN)).toThrow(MoneyError);
    expect(() => assertCents(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });

  it('refuses an amount beyond safe integer range', () => {
    expect(() => assertCents(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });

  it('rounds half away from zero, in one place only', () => {
    expect(roundToCents(0.5)).toBe(1);
    expect(roundToCents(1.5)).toBe(2);
    expect(roundToCents(2.5)).toBe(3);
    expect(roundToCents(-0.5)).toBe(-1);
    expect(roundToCents(-1.5)).toBe(-2);
  });

  it('applies a rate to an amount without ever producing a fraction', () => {
    expect(applyRate(42_000, 0.11)).toBe(4620);
    expect(applyRate(33_333, 0.11)).toBe(3667);
    expect(Number.isInteger(applyRate(1, 0.11))).toBe(true);
  });

  it('computes exclusive and inclusive tax consistently', () => {
    const base = 10_000;
    expect(taxOn(base, 0.2, false)).toBe(2000);
    // Inclusive: the tax is already inside the base.
    expect(taxOn(12_000, 0.2, true)).toBe(2000);
  });

  it('sums without drift over many values', () => {
    const values = Array.from({ length: 10_000 }, (_, i) => i + 1);
    expect(sumCents(values)).toBe((10_000 * 10_001) / 2);
  });

  it('formats through Intl with the market currency, never a hardcoded symbol', () => {
    // A market-neutral currency code, because a test is not a place to assert a
    // launch market's symbol either.
    const formatted = formatMoney(42_050, 'XTS', 'en-GB');
    expect(formatted).toContain('420.50');
    expect(() => formatMoney(42_050.5, 'XTS', 'en-GB')).toThrow(MoneyError);
  });

  it('never loses or creates a cent across a full order breakdown', () => {
    // The specific failure this guards: fee rounding in the order service and tax
    // rounding in a formatter, each independently reasonable, together losing a
    // cent per order. At 15,000 orders a month that is a week of reconciliation.
    let mismatches = 0;
    for (let i = 0; i < 10_000; i++) {
      const part = 1_000 + ((i * 7919) % 900_000);
      const delivery = 500 + ((i * 104_729) % 12_000);
      const buyerFee = applyRate(part, 0.037);
      const tax = applyRate(part + delivery + buyerFee, 0.071);
      const total = sumCents([part, delivery, buyerFee, tax]);
      if (total !== part + delivery + buyerFee + tax) mismatches += 1;
      if (!Number.isInteger(total)) mismatches += 1;
    }
    expect(mismatches).toBe(0);
  });
});
