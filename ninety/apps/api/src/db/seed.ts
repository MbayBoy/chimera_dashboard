import '../load-env.js';
import { closeDb, getDb, getSql } from './client.js';
import { supplierPresence, supplierStockProfiles, supplierTablets, users, vehicles } from './schema.js';
import { BUYERS, CITIES, MARKETS, PART_CATEGORIES, SUPPLIERS, VEHICLES } from './seed-data.js';

/**
 * Seed.
 *
 * Idempotent: running it twice leaves the same rows. It seeds both markets even
 * though only one is live, because an abstraction that is never exercised by a
 * second case is not an abstraction.
 */

/**
 * A PostGIS point as a nested SQL fragment.
 *
 * Built with the postgres-js tag rather than Drizzle's, because these statements
 * are raw ones: a Drizzle `sql` object passed into a postgres-js template is sent
 * as a bind parameter and arrives at PostGIS as an object literal.
 */
function pointLiteral(lng: number, lat: number) {
  return getSql()`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** Phone numbers are synthetic and reserved-range, so no real device is reachable. */
function seedPhone(index: number, role: 'buyer' | 'supplier' | 'admin'): string {
  const prefix = role === 'supplier' ? '900' : role === 'buyer' ? '800' : '700';
  return `+999${prefix}${String(index).padStart(4, '0')}`;
}

export async function seed(log: (s: string) => void = console.log): Promise<void> {
  const db = getDb();
  const raw = getSql();

  log('markets');
  for (const m of MARKETS) {
    await raw`
      INSERT INTO markets (
        code, name, currency, currency_minor_unit_exp, locale_default, locales_supported, timezone,
        vehicle_id_type, vehicle_id_regex, payment_provider, courier_providers,
        tax_rate, tax_label, tax_inclusive, commission_rate, buyer_fee_rate, delivery_markup_rate,
        sla_response_min, sla_offers_min, sla_delivery_min, selection_window_min, widening_window_min,
        auto_confirm_hours, financial_retention_years, address_model, weekend_days, is_live
      ) VALUES (
        ${m.code}, ${m.name}, ${m.currency}, ${m.currencyMinorUnitExp}, ${m.localeDefault},
        ${m.localesSupported}, ${m.timezone}, ${m.vehicleIdType}, ${m.vehicleIdRegex},
        ${m.paymentProvider}, ${m.courierProviders}, ${m.taxRate}, ${m.taxLabel}, ${m.taxInclusive},
        ${m.commissionRate}, ${m.buyerFeeRate}, ${m.deliveryMarkupRate},
        ${m.slaResponseMin}, ${m.slaOffersMin}, ${m.slaDeliveryMin}, ${m.selectionWindowMin},
        ${m.wideningWindowMin}, ${m.autoConfirmHours}, ${m.financialRetentionYears},
        ${m.addressModel}, ${m.weekendDays}, ${m.isLive}
      )
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    `;
  }
  const marketIdByCode = new Map<string, string>();
  for (const row of await raw<{ id: string; code: string }[]>`SELECT id, code FROM markets`) {
    marketIdByCode.set(row.code, row.id);
  }

  log('cities');
  for (const c of CITIES) {
    const marketId = marketIdByCode.get(c.marketCode)!;
    await raw`
      INSERT INTO cities (market_id, name, centroid, radius_km, is_live, launch_date)
      VALUES (${marketId}, ${c.name}, ${pointLiteral(c.lng, c.lat)}, ${c.radiusKm}, ${c.isLive}, ${c.launchDate})
      ON CONFLICT (market_id, name) DO UPDATE SET radius_km = EXCLUDED.radius_km, is_live = EXCLUDED.is_live
    `;
  }
  const cityIdByName = new Map<string, string>();
  for (const row of await raw<{ id: string; name: string }[]>`SELECT id, name FROM cities`) {
    cityIdByName.set(row.name, row.id);
  }

  log('part categories');
  const categoryIdByCode = new Map<string, string>();
  for (const [index, c] of PART_CATEGORIES.entries()) {
    const parentId = c.parent === null ? null : (categoryIdByCode.get(c.parent) ?? null);
    const rows = await raw<{ id: string }[]>`
      INSERT INTO part_categories (code, parent_id, name_i18n, parcel_class, high_value, sort_order)
      VALUES (
        ${c.code}, ${parentId}, ${JSON.stringify({ en: c.en, ar: c.ar })}::jsonb,
        ${c.parcelClass}, ${c.highValue ?? false}, ${index}
      )
      ON CONFLICT (code) DO UPDATE SET
        name_i18n = EXCLUDED.name_i18n, parcel_class = EXCLUDED.parcel_class, high_value = EXCLUDED.high_value
      RETURNING id
    `;
    categoryIdByCode.set(c.code, rows[0]!.id);
  }

  log('vehicles');
  const aeMarketId = marketIdByCode.get('AE')!;
  for (const v of VEHICLES) {
    const existing = await raw<{ id: string }[]>`
      SELECT id FROM vehicles WHERE make = ${v.make} AND model = ${v.model} AND year = ${v.year}
        AND coalesce(variant,'') = ${v.variant ?? ''} LIMIT 1
    `;
    if (existing.length === 0) {
      await db.insert(vehicles).values({
        make: v.make,
        model: v.model,
        variant: v.variant,
        year: v.year,
        bodyType: v.bodyType,
        engineCode: v.engineCode,
        marketId: aeMarketId,
      });
    }
  }

  log('suppliers');
  for (const [index, s] of SUPPLIERS.entries()) {
    const phone = seedPhone(index + 1, 'supplier');
    const cityId = cityIdByName.get(s.city)!;
    const existingUser = await raw<{ id: string }[]>`
      SELECT id FROM users WHERE market_id = ${aeMarketId} AND phone = ${phone} LIMIT 1
    `;
    let userId = existingUser[0]?.id;
    if (userId === undefined) {
      const inserted = await db
        .insert(users)
        .values({
          marketId: aeMarketId,
          role: 'supplier',
          phone,
          displayName: s.businessName,
          locale: null,
          kycStatus: s.verified ? 'verified' : 'pending',
        })
        .returning({ id: users.id });
      userId = inserted[0]!.id;
    }

    const existingSupplier = await raw<{ id: string }[]>`SELECT id FROM suppliers WHERE user_id = ${userId} LIMIT 1`;
    let supplierId = existingSupplier[0]?.id;
    if (supplierId === undefined) {
      const rows = await raw<{ id: string }[]>`
        INSERT INTO suppliers (
          user_id, city_id, business_name, location, address, operating_hours, verified, status,
          onboarding_stage, score, response_rate, median_response_s, fulfilment_rate, dispute_rate,
          decline_rate, stock_match_threshold
        ) VALUES (
          ${userId}, ${cityId}, ${s.businessName}, ${pointLiteral(s.lng, s.lat)},
          ${JSON.stringify({ area: s.area, city: s.city })}::jsonb,
          ${JSON.stringify({ mon_thu: ['08:00', '19:00'], fri: ['14:00', '19:00'], sat: ['08:00', '19:00'], sun: ['08:00', '19:00'] })}::jsonb,
          ${s.verified}, ${s.status}, ${s.onboardingStage}, ${s.score}, ${s.responseRate},
          ${s.medianResponseS}, ${s.fulfilmentRate}, '0.0000', '0.0000', '0.000'
        ) RETURNING id
      `;
      supplierId = rows[0]!.id;
    }

    await db
      .insert(supplierStockProfiles)
      .values({
        supplierId,
        makes: s.makes,
        models: s.models,
        yearFrom: s.yearFrom,
        yearTo: s.yearTo,
        partCategories: s.partCategories,
        maxRadiusKm: s.maxRadiusKm,
      })
      .onConflictDoNothing();

    await db
      .insert(supplierPresence)
      .values({ supplierId, online: s.onboardingStage === 'test_request_passed', lastSeenAt: new Date() })
      .onConflictDoNothing();

    if (s.tabletSerial !== null) {
      await db
        .insert(supplierTablets)
        .values({ supplierId, serialNumber: s.tabletSerial, issuedTo: s.businessName, status: 'deployed' })
        .onConflictDoNothing();
    }
  }

  log('buyers');
  for (const [index, b] of BUYERS.entries()) {
    const phone = seedPhone(index + 1, 'buyer');
    const existingUser = await raw<{ id: string }[]>`
      SELECT id FROM users WHERE market_id = ${aeMarketId} AND phone = ${phone} LIMIT 1
    `;
    let userId = existingUser[0]?.id;
    if (userId === undefined) {
      const inserted = await db
        .insert(users)
        .values({ marketId: aeMarketId, role: 'buyer', phone, displayName: b.businessName })
        .returning({ id: users.id });
      userId = inserted[0]!.id;
    }
    const existingBuyer = await raw<{ id: string }[]>`SELECT id FROM buyers WHERE user_id = ${userId} LIMIT 1`;
    if (existingBuyer.length === 0) {
      await raw`
        INSERT INTO buyers (user_id, type, business_name, default_address, default_location)
        VALUES (
          ${userId}, ${b.type}, ${b.businessName},
          ${JSON.stringify({ area: b.area })}::jsonb, ${pointLiteral(b.lng, b.lat)}
        )
      `;
    }
  }

  log('ops admin');
  const adminPhone = seedPhone(1, 'admin');
  const existingAdmin = await raw<{ id: string }[]>`
    SELECT id FROM users WHERE market_id = ${aeMarketId} AND phone = ${adminPhone} LIMIT 1
  `;
  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      marketId: aeMarketId,
      role: 'admin',
      phone: adminPhone,
      displayName: 'NINETY Operations',
      kycStatus: 'verified',
    });
  }

  const counts = await raw<{ table: string; n: string }[]>`
    SELECT 'markets' AS table, count(*)::text AS n FROM markets
    UNION ALL SELECT 'cities', count(*)::text FROM cities
    UNION ALL SELECT 'part_categories', count(*)::text FROM part_categories
    UNION ALL SELECT 'vehicles', count(*)::text FROM vehicles
    UNION ALL SELECT 'suppliers', count(*)::text FROM suppliers
    UNION ALL SELECT 'buyers', count(*)::text FROM buyers
    UNION ALL SELECT 'users', count(*)::text FROM users
    ORDER BY 1
  `;
  for (const c of counts) log(`  ${c.table.padEnd(16)} ${c.n}`);
}

const isEntrypoint = process.argv[1] !== undefined && process.argv[1].endsWith('seed.ts');
if (isEntrypoint) {
  seed()
    .then(async () => {
      console.log('seed complete');
      await closeDb();
    })
    .catch(async (err) => {
      console.error(err);
      await closeDb();
      process.exit(1);
    });
}
