/**
 * Money. Integer minor units only.
 *
 * Standing rule from the specification: "Money in integer minor units. Never
 * floats — not in the database, the API, or the client."
 *
 * Every monetary value in this system is a `Cents` — an integer number of the
 * currency's smallest unit (fils for AED, cents for ZAR). There is exactly one
 * rounding policy and exactly one place that applies it, because rounding
 * applied in two independently-reasonable places is how a cent per order goes
 * missing.
 */

/** An integer number of minor currency units. Never a float, never a string. */
export type Cents = number;

export class MoneyError extends Error {}

/** Guard: throws unless the value is a safe, finite integer. */
export function assertCents(value: number, label = 'amount'): Cents {
  if (!Number.isFinite(value)) throw new MoneyError(`${label} is not finite`);
  if (!Number.isInteger(value)) throw new MoneyError(`${label} is not an integer minor unit: ${value}`);
  if (!Number.isSafeInteger(value)) throw new MoneyError(`${label} exceeds safe integer range: ${value}`);
  return value;
}

/**
 * THE rounding policy. Half away from zero ("round half up" for positives).
 *
 * Chosen over banker's rounding for one reason: it is the rounding a supplier
 * or a buyer performs in their head when they check our arithmetic, and a
 * marketplace argues about cents far more often than it sums a million of them.
 * It is applied here and nowhere else.
 */
export function roundToCents(exact: number): Cents {
  if (!Number.isFinite(exact)) throw new MoneyError(`cannot round non-finite value: ${exact}`);
  const rounded = exact < 0 ? -Math.round(-exact) : Math.round(exact);
  return assertCents(rounded, 'rounded amount');
}

/**
 * Apply a rate (e.g. a commission or fee rate) to an amount in minor units.
 * The rate arrives from market configuration — never from a literal in code.
 */
export function applyRate(amount: Cents, rate: number): Cents {
  assertCents(amount, 'base amount');
  if (!Number.isFinite(rate) || rate < 0) throw new MoneyError(`invalid rate: ${rate}`);
  return roundToCents(amount * rate);
}

/** Sum a list of minor-unit amounts, asserting each. */
export function sumCents(amounts: readonly Cents[]): Cents {
  let total = 0;
  for (const a of amounts) total += assertCents(a, 'summand');
  return assertCents(total, 'sum');
}

/**
 * Tax on a set of taxable components.
 *
 * `inclusive` markets quote prices with tax already inside; `exclusive` markets
 * add it on top. Which one applies is market configuration, resolved by the
 * caller — this function only does the arithmetic it is told to do.
 */
export function taxOn(taxableBase: Cents, rate: number, inclusive: boolean): Cents {
  assertCents(taxableBase, 'taxable base');
  if (inclusive) {
    // base already contains the tax: tax = base - base/(1+rate)
    return roundToCents(taxableBase - taxableBase / (1 + rate));
  }
  return applyRate(taxableBase, rate);
}

/**
 * Format for display. Delegates entirely to Intl with the caller's locale and
 * the market's currency — never hand-formatted, never a hardcoded symbol.
 */
export function formatMoney(amount: Cents, currency: string, locale: string, minorUnitExponent = 2): string {
  assertCents(amount, 'display amount');
  const major = amount / Math.pow(10, minorUnitExponent);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnitExponent,
    maximumFractionDigits: minorUnitExponent,
  }).format(major);
}
