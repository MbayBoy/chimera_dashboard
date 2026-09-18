import { applyRate, assertCents, roundToCents, sumCents, type Cents, type MarketConfig } from '@ninety/shared';

/**
 * Order arithmetic.
 *
 *   part_cents            = accepted offer price
 *   delivery_cents        = courier charge to the buyer
 *   buyer_fee_cents       = part_cents × market.buyer_fee_rate
 *   tax_cents             = per market rules
 *   total_cents           = part + delivery + buyer_fee + tax     ← the buyer pays
 *   commission_cents      = part_cents × market.commission_rate
 *   supplier_payout_cents = part_cents − commission_cents
 *
 * Every rate comes from market configuration. Rounding happens here and nowhere
 * else: fee rounding in the order service and tax rounding in a formatter, each
 * independently reasonable, together lose a cent per order — and at fifteen
 * thousand orders a month that is a week spent reconciling.
 *
 * The total is computed by summing the components rather than by recomputing it,
 * so it cannot disagree with them. The database enforces the same identity as a
 * CHECK constraint, because a test proves it today and a constraint proves it
 * every day.
 */

export interface OrderBreakdown {
  readonly partCents: Cents;
  readonly deliveryCents: Cents;
  readonly buyerFeeCents: Cents;
  readonly taxCents: Cents;
  readonly totalCents: Cents;
  readonly commissionCents: Cents;
  readonly supplierPayoutCents: Cents;
  readonly currency: string;
}

export interface BreakdownInput {
  readonly partCents: Cents;
  readonly deliveryCents: Cents;
  readonly market: MarketConfig;
  /** Commission-free launch period in a new market — an adoption incentive. */
  readonly commissionFree?: boolean;
  readonly buyerFeeFree?: boolean;
}

export function computeOrderBreakdown(input: BreakdownInput): OrderBreakdown {
  const partCents = assertCents(input.partCents, 'part');
  const deliveryCents = assertCents(input.deliveryCents, 'delivery');
  const { fees, tax, currency } = input.market;

  const buyerFeeCents = input.buyerFeeFree === true ? 0 : applyRate(partCents, fees.buyerFeeRate);

  // Tax applies to what the buyer is charged for: the part, the delivery and the
  // service fee. Whether it is added on top or already inside is market
  // configuration, not an assumption.
  const taxableBase = sumCents([partCents, deliveryCents, buyerFeeCents]);
  const taxCents = tax.inclusive
    ? roundToCents(taxableBase - taxableBase / (1 + tax.rate))
    : applyRate(taxableBase, tax.rate);

  // Summed, never recomputed: the components ARE the total.
  const totalCents = tax.inclusive
    ? sumCents([partCents, deliveryCents, buyerFeeCents])
    : sumCents([partCents, deliveryCents, buyerFeeCents, taxCents]);

  const commissionCents = input.commissionFree === true ? 0 : applyRate(partCents, fees.commissionRate);
  const supplierPayoutCents = assertCents(partCents - commissionCents, 'supplier payout');

  return {
    partCents,
    deliveryCents,
    buyerFeeCents,
    taxCents,
    totalCents,
    commissionCents,
    supplierPayoutCents,
    currency,
  };
}

/**
 * What the buyer is charged for delivery.
 *
 * The courier's price plus the market's markup. Thin per order, meaningful at
 * volume, and it improves as density grows — but only if parcel classing is
 * right, because a gearbox quoted as a small parcel loses money on exactly the
 * high-value orders.
 */
export function deliveryChargeForBuyer(courierCostCents: Cents, market: MarketConfig, freeDelivery = false): Cents {
  if (freeDelivery) return 0;
  return roundToCents(courierCostCents * (1 + market.fees.deliveryMarkupRate));
}

/** Assert an order's components reconcile exactly. Used in tests and at write time. */
export function reconciles(breakdown: OrderBreakdown, taxInclusive: boolean): boolean {
  const componentSum = taxInclusive
    ? breakdown.partCents + breakdown.deliveryCents + breakdown.buyerFeeCents
    : breakdown.partCents + breakdown.deliveryCents + breakdown.buyerFeeCents + breakdown.taxCents;
  return (
    componentSum === breakdown.totalCents &&
    breakdown.supplierPayoutCents === breakdown.partCents - breakdown.commissionCents
  );
}
