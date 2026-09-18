import { getSql } from '../db/client.js';

/**
 * The metrics that decide whether this works.
 *
 * Fill rate first, because if it is wrong nothing else matters — a workshop that
 * posts a request and gets silence does not post a second one, and they tell the
 * other workshops.
 *
 * Every figure here is computed from the same rows the ops board shows, so the
 * dashboard and the board cannot disagree about what happened.
 */

export interface MetricsWindow {
  readonly marketId?: string | null;
  readonly cityId?: string | null;
  readonly days: number;
}

export interface MarketplaceHealth {
  readonly requests: number;
  readonly requestsWithOffers: number;
  readonly fillRate: number | null;
  readonly offersPerRequest: number | null;
  readonly medianSupplierResponseSeconds: number | null;
  readonly filledWithinSlaRate: number | null;
  readonly noSupplyCount: number;
  readonly noOffersCount: number;
}

export async function marketplaceHealth(window: MetricsWindow): Promise<MarketplaceHealth> {
  const rows = await getSql()<
    {
      requests: string;
      with_offers: string;
      offers_total: string;
      median_response_s: string | null;
      filled_within_sla: string;
      no_supply: string;
      no_offers: string;
    }[]
  >`
    WITH scope AS (
      SELECT r.* FROM requests r
       WHERE r.created_at > now() - make_interval(days => ${window.days})
         AND r.submitted_at IS NOT NULL
         AND (${window.marketId ?? null}::uuid IS NULL OR r.market_id = ${window.marketId ?? null}::uuid)
         AND (${window.cityId ?? null}::uuid IS NULL OR r.city_id = ${window.cityId ?? null}::uuid)
    )
    SELECT
      count(*)::text AS requests,
      count(*) FILTER (WHERE offer_count > 0)::text AS with_offers,
      coalesce(sum(offer_count), 0)::text AS offers_total,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY o.response_seconds)
         FROM offers o JOIN scope s2 ON s2.id = o.request_id)::text AS median_response_s,
      count(*) FILTER (
        WHERE offer_count > 0
          AND EXISTS (
            SELECT 1 FROM offers o2
             WHERE o2.request_id = scope.id
               AND o2.created_at <= scope.created_at + make_interval(mins => (
                     SELECT sla_offers_min FROM markets WHERE id = scope.market_id))
          )
      )::text AS filled_within_sla,
      count(*) FILTER (WHERE outcome = 'no_supply')::text AS no_supply,
      count(*) FILTER (WHERE outcome = 'no_offers')::text AS no_offers
    FROM scope
  `;
  const row = rows[0]!;
  const requests = Number(row.requests);
  const withOffers = Number(row.with_offers);

  return {
    requests,
    requestsWithOffers: withOffers,
    // Fill rate: requests that received at least one offer. The number the whole
    // business depends on, and the one to look at before any other.
    fillRate: requests === 0 ? null : round(withOffers / requests),
    offersPerRequest: requests === 0 ? null : round(Number(row.offers_total) / requests),
    medianSupplierResponseSeconds: row.median_response_s === null ? null : Math.round(Number(row.median_response_s)),
    filledWithinSlaRate: requests === 0 ? null : round(Number(row.filled_within_sla) / requests),
    noSupplyCount: Number(row.no_supply),
    noOffersCount: Number(row.no_offers),
  };
}

export interface SpeedMetrics {
  readonly requestToFirstOfferSeconds: number | null;
  readonly requestToAcceptSeconds: number | null;
  readonly acceptToCollectedSeconds: number | null;
  readonly collectedToDeliveredSeconds: number | null;
  /** The headline number: share delivered inside the market's own SLA. */
  readonly deliveredWithinSlaRate: number | null;
  readonly deliveredWithinSlaPeak: number | null;
  readonly deliveredWithinSlaOffPeak: number | null;
  readonly deliveries: number;
}

export async function speedMetrics(window: MetricsWindow): Promise<SpeedMetrics> {
  const rows = await getSql()<
    {
      first_offer_s: string | null;
      accept_s: string | null;
      collect_s: string | null;
      deliver_s: string | null;
      total: string;
      within_sla: string;
      peak_total: string;
      peak_within: string;
      offpeak_total: string;
      offpeak_within: string;
    }[]
  >`
    WITH scope AS (
      SELECT r.id, r.market_id, r.created_at, r.accepted_at, r.delivered_at,
             m.sla_delivery_min,
             (SELECT min(o.created_at) FROM offers o WHERE o.request_id = r.id) AS first_offer_at
        FROM requests r JOIN markets m ON m.id = r.market_id
       WHERE r.created_at > now() - make_interval(days => ${window.days})
         AND (${window.marketId ?? null}::uuid IS NULL OR r.market_id = ${window.marketId ?? null}::uuid)
         AND (${window.cityId ?? null}::uuid IS NULL OR r.city_id = ${window.cityId ?? null}::uuid)
    ),
    d AS (
      SELECT o.request_id, dl.dispatched_at, dl.collected_at, dl.delivered_at, dl.was_peak,
             s.accepted_at, s.sla_delivery_min
        FROM deliveries dl
        JOIN orders o ON o.id = dl.order_id
        JOIN scope s ON s.id = o.request_id
       WHERE dl.delivered_at IS NOT NULL
    )
    SELECT
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_offer_at - created_at)))
         FROM scope WHERE first_offer_at IS NOT NULL)::text AS first_offer_s,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (accepted_at - created_at)))
         FROM scope WHERE accepted_at IS NOT NULL)::text AS accept_s,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (collected_at - accepted_at)))
         FROM d WHERE collected_at IS NOT NULL)::text AS collect_s,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (delivered_at - collected_at)))
         FROM d WHERE collected_at IS NOT NULL)::text AS deliver_s,
      (SELECT count(*) FROM d)::text AS total,
      (SELECT count(*) FROM d
        WHERE delivered_at <= accepted_at + make_interval(mins => sla_delivery_min))::text AS within_sla,
      (SELECT count(*) FROM d WHERE was_peak)::text AS peak_total,
      (SELECT count(*) FROM d WHERE was_peak
         AND delivered_at <= accepted_at + make_interval(mins => sla_delivery_min))::text AS peak_within,
      (SELECT count(*) FROM d WHERE NOT was_peak)::text AS offpeak_total,
      (SELECT count(*) FROM d WHERE NOT was_peak
         AND delivered_at <= accepted_at + make_interval(mins => sla_delivery_min))::text AS offpeak_within
  `;
  const row = rows[0]!;
  const total = Number(row.total);
  const peakTotal = Number(row.peak_total);
  const offPeakTotal = Number(row.offpeak_total);

  return {
    requestToFirstOfferSeconds: nullableRound(row.first_offer_s),
    requestToAcceptSeconds: nullableRound(row.accept_s),
    acceptToCollectedSeconds: nullableRound(row.collect_s),
    collectedToDeliveredSeconds: nullableRound(row.deliver_s),
    deliveredWithinSlaRate: total === 0 ? null : round(Number(row.within_sla) / total),
    // Split, because the public promise is "typically 90 minutes, up to 3 hours
    // in peak traffic" and we need to know which one we actually delivered.
    deliveredWithinSlaPeak: peakTotal === 0 ? null : round(Number(row.peak_within) / peakTotal),
    deliveredWithinSlaOffPeak: offPeakTotal === 0 ? null : round(Number(row.offpeak_within) / offPeakTotal),
    deliveries: total,
  };
}

export interface CommercialMetrics {
  readonly gmvCents: number;
  readonly revenueCents: number;
  readonly realisedTakeRate: number | null;
  readonly contributionPerOrderCents: number | null;
  readonly courierCostCents: number;
  readonly courierChargeCents: number;
  readonly orders: number;
  readonly repeatBuyerRate: number | null;
}

export async function commercialMetrics(window: MetricsWindow): Promise<CommercialMetrics> {
  const rows = await getSql()<
    {
      orders: string;
      gmv: string;
      commission: string;
      buyer_fee: string;
      delivery_charged: string;
      courier_cost: string;
      repeat_buyers: string;
      total_buyers: string;
    }[]
  >`
    WITH scope AS (
      SELECT o.* FROM orders o JOIN requests r ON r.id = o.request_id
       WHERE o.created_at > now() - make_interval(days => ${window.days})
         AND (${window.marketId ?? null}::uuid IS NULL OR r.market_id = ${window.marketId ?? null}::uuid)
         AND (${window.cityId ?? null}::uuid IS NULL OR r.city_id = ${window.cityId ?? null}::uuid)
    )
    SELECT
      count(*)::text AS orders,
      coalesce(sum(part_cents), 0)::text AS gmv,
      coalesce(sum(commission_cents), 0)::text AS commission,
      coalesce(sum(buyer_fee_cents), 0)::text AS buyer_fee,
      coalesce(sum(delivery_cents), 0)::text AS delivery_charged,
      coalesce(sum(courier_cost_cents), 0)::text AS courier_cost,
      (SELECT count(*) FROM (SELECT buyer_id FROM scope GROUP BY buyer_id HAVING count(*) > 1) x)::text AS repeat_buyers,
      (SELECT count(DISTINCT buyer_id) FROM scope)::text AS total_buyers
    FROM scope
  `;
  const row = rows[0]!;
  const orders = Number(row.orders);
  const gmv = Number(row.gmv);
  const revenue = Number(row.commission) + Number(row.buyer_fee) + (Number(row.delivery_charged) - Number(row.courier_cost));
  const totalBuyers = Number(row.total_buyers);

  return {
    gmvCents: gmv,
    revenueCents: revenue,
    realisedTakeRate: gmv === 0 ? null : round(revenue / gmv),
    contributionPerOrderCents: orders === 0 ? null : Math.round(revenue / orders),
    courierCostCents: Number(row.courier_cost),
    courierChargeCents: Number(row.delivery_charged),
    orders,
    repeatBuyerRate: totalBuyers === 0 ? null : round(Number(row.repeat_buyers) / totalBuyers),
  };
}

export interface SupplyMetrics {
  readonly activeSuppliers: number;
  readonly respondingWeekly: number;
  readonly respondingWeeklyRate: number | null;
  readonly scoreDistribution: readonly { readonly band: string; readonly count: number }[];
  readonly pipeline: readonly { readonly stage: string; readonly count: number }[];
  readonly tablets: { readonly deployed: number; readonly activeLast7Days: number; readonly lost: number; readonly broken: number };
}

export async function supplyMetrics(window: MetricsWindow): Promise<SupplyMetrics> {
  const summary = (
    await getSql()<{ active: string; responding: string }[]>`
      SELECT
        (SELECT count(*) FROM suppliers WHERE status = 'active')::text AS active,
        (SELECT count(DISTINCT supplier_id) FROM request_fanouts
          WHERE sent_at > now() - interval '7 days' AND outcome IN ('offered','declined'))::text AS responding
    `
  )[0]!;

  const distribution = await getSql()<{ band: string; n: string }[]>`
    SELECT CASE
             WHEN score >= 4.5 THEN '4.5-5.0'
             WHEN score >= 4.0 THEN '4.0-4.5'
             WHEN score >= 3.5 THEN '3.5-4.0'
             WHEN score >= 3.0 THEN '3.0-3.5'
             ELSE 'below 3.0'
           END AS band,
           count(*)::text AS n
      FROM suppliers WHERE status = 'active'
     GROUP BY 1 ORDER BY 1 DESC
  `;

  // Four stages, and only the last one counts. A signed yard with an
  // unconfigured tablet is a dead terminal: it inflates the supply number while
  // contributing nothing to fill rate.
  const pipeline = await getSql()<{ onboarding_stage: string; n: string }[]>`
    SELECT onboarding_stage, count(*)::text AS n FROM suppliers GROUP BY 1
  `;
  const stageOrder = ['signed', 'tablet_installed', 'profile_configured', 'test_request_passed'];

  const tablets = (
    await getSql()<{ deployed: string; active7: string; lost: string; broken: string }[]>`
      SELECT
        count(*) FILTER (WHERE status = 'deployed')::text AS deployed,
        count(*) FILTER (WHERE last_seen_at > now() - interval '7 days')::text AS active7,
        count(*) FILTER (WHERE status = 'lost')::text AS lost,
        count(*) FILTER (WHERE status = 'broken')::text AS broken
      FROM supplier_tablets
    `
  )[0]!;

  const active = Number(summary.active);
  const responding = Number(summary.responding);
  void window;

  return {
    activeSuppliers: active,
    respondingWeekly: responding,
    respondingWeeklyRate: active === 0 ? null : round(responding / active),
    scoreDistribution: distribution.map((d) => ({ band: d.band, count: Number(d.n) })),
    pipeline: stageOrder.map((stage) => ({
      stage,
      count: Number(pipeline.find((p) => p.onboarding_stage === stage)?.n ?? '0'),
    })),
    tablets: {
      deployed: Number(tablets.deployed),
      activeLast7Days: Number(tablets.active7),
      lost: Number(tablets.lost),
      broken: Number(tablets.broken),
    },
  };
}

/**
 * The demand dataset.
 *
 * Every request, filled and unfilled, with part, vehicle, area, time, outcome,
 * offer count and price. Nobody in either market has this, it compounds, and it
 * cannot be copied by launching the same app.
 *
 * This is a product surface, not a debug view: it decides the inventory strategy
 * and it goes in front of investors.
 */
export async function unfilledDemand(window: MetricsWindow, limit = 200) {
  return getSql()<
    {
      part_description: string;
      part_code: string | null;
      vehicle_make: string | null;
      vehicle_model: string | null;
      vehicle_year: number | null;
      misses: string;
      last_seen: Date;
      miss_kind: string;
    }[]
  >`
    SELECT dm.part_description, pc.code AS part_code, dm.vehicle_make, dm.vehicle_model, dm.vehicle_year,
           count(*)::text AS misses, max(dm.occurred_at) AS last_seen,
           mode() WITHIN GROUP (ORDER BY dm.miss_kind) AS miss_kind
      FROM demand_misses dm
      LEFT JOIN part_categories pc ON pc.id = dm.part_category_id
     WHERE dm.occurred_at > now() - make_interval(days => ${window.days})
       AND (${window.marketId ?? null}::uuid IS NULL OR dm.market_id = ${window.marketId ?? null}::uuid)
       AND (${window.cityId ?? null}::uuid IS NULL OR dm.city_id = ${window.cityId ?? null}::uuid)
     GROUP BY 1,2,3,4,5
     ORDER BY count(*) DESC, max(dm.occurred_at) DESC
     LIMIT ${limit}
  `;
}

export async function demandDataset(window: MetricsWindow, limit = 5000) {
  return getSql()<Record<string, unknown>[]>`
    SELECT r.reference, r.created_at, r.status, r.outcome,
           pc.code AS part_category, r.part_description,
           v.make AS vehicle_make, v.model AS vehicle_model, v.year AS vehicle_year,
           c.name AS city, r.fanout_count, r.offer_count,
           (SELECT min(o.price_cents) FROM offers o WHERE o.request_id = r.id) AS lowest_offer_cents,
           (SELECT max(o.price_cents) FROM offers o WHERE o.request_id = r.id) AS highest_offer_cents,
           ord.part_cents AS accepted_price_cents,
           EXTRACT(EPOCH FROM (r.delivered_at - r.accepted_at))::int AS delivery_seconds
      FROM requests r
      LEFT JOIN part_categories pc ON pc.id = r.part_category_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      LEFT JOIN cities c ON c.id = r.city_id
      LEFT JOIN orders ord ON ord.request_id = r.id
     WHERE r.submitted_at IS NOT NULL
       AND r.created_at > now() - make_interval(days => ${window.days})
       AND (${window.marketId ?? null}::uuid IS NULL OR r.market_id = ${window.marketId ?? null}::uuid)
     ORDER BY r.created_at DESC
     LIMIT ${limit}
  `;
}

function round(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function nullableRound(value: string | null): number | null {
  return value === null ? null : Math.round(Number(value));
}
