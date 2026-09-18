import '../load-env.js';
import { closeDb, getSql } from '../db/client.js';
import { closeRedis } from '../core/redis.js';

/**
 * Load-test fixtures.
 *
 * The demo seed has eight yards, which is the right number for a walkthrough and
 * the wrong number for a load test: a fan-out to eight suppliers exercises none
 * of the contention that matters. This creates as many additional active yards
 * as the test asks for, scattered across the live city, all carrying a stock
 * profile that matches the load-test vehicle so the fan-out is wide on purpose.
 *
 * Kept out of the demo seed deliberately. Nobody wants two hundred fictional
 * scrapyards in the console during a market walkthrough.
 *
 *   pnpm --filter @ninety/api seed:load -- --terminals 200
 */

export const LOAD_PHONE_PREFIX = '+99995';

export function loadTerminalPhone(index: number): string {
  return `${LOAD_PHONE_PREFIX}${String(index).padStart(5, '0')}`;
}

/** Deterministic spread, so a re-run produces the same geography as the last. */
function scatter(index: number, count: number): { lat: number; lng: number } {
  const golden = 2.399963229728653;
  const angle = index * golden;
  // sqrt keeps the points area-uniform rather than clustered at the centre.
  const radiusKm = 18 * Math.sqrt((index % count) / count);
  const dLat = (radiusKm * Math.cos(angle)) / 111;
  const dLng = (radiusKm * Math.sin(angle)) / (111 * Math.cos((25.15 * Math.PI) / 180));
  return { lat: 25.15 + dLat, lng: 55.24 + dLng };
}

export async function seedLoadTerminals(
  terminals: number,
  marketCode: string,
  log: (s: string) => void = console.log,
): Promise<number> {
  const sql = getSql();

  const market = (
    await sql<{ id: string }[]>`SELECT id FROM markets WHERE code = ${marketCode} LIMIT 1`
  )[0];
  if (market === undefined) throw new Error(`no market ${marketCode}`);

  const city = (
    await sql<{ id: string }[]>`
      SELECT id FROM cities WHERE market_id = ${market.id} AND is_live = true ORDER BY name LIMIT 1
    `
  )[0];
  if (city === undefined) throw new Error(`no live city in ${marketCode}`);

  const categories = (
    await sql<{ code: string }[]>`SELECT code FROM part_categories WHERE code LIKE '%.%'`
  ).map((r) => r.code);

  let created = 0;
  for (let i = 0; i < terminals; i += 1) {
    const phone = loadTerminalPhone(i);
    const { lat, lng } = scatter(i, terminals);

    const existing = (
      await sql<{ id: string }[]>`
        SELECT id FROM users WHERE market_id = ${market.id} AND phone = ${phone} LIMIT 1
      `
    )[0];

    const userId =
      existing?.id ??
      (
        await sql<{ id: string }[]>`
          INSERT INTO users (market_id, role, phone, display_name, kyc_status)
          VALUES (${market.id}, 'supplier', ${phone}, ${`Load Yard ${i}`}, 'verified')
          RETURNING id
        `
      )[0]!.id;

    const supplier = (
      await sql<{ id: string }[]>`SELECT id FROM suppliers WHERE user_id = ${userId} LIMIT 1`
    )[0];
    if (supplier !== undefined) continue;

    const supplierId = (
      await sql<{ id: string }[]>`
        INSERT INTO suppliers (
          user_id, city_id, business_name, location, address, operating_hours,
          verified, status, onboarding_stage, score, response_rate, median_response_s,
          fulfilment_rate, dispute_rate, decline_rate, stock_match_threshold
        ) VALUES (
          ${userId}, ${city.id}, ${`Load Yard ${i}`},
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${JSON.stringify({ area: 'Load test', city: 'Load test' })}::jsonb,
          ${JSON.stringify({ all: ['00:00', '23:59'] })}::jsonb,
          true, 'active', 'test_request_passed',
          ${(2 + (i % 30) / 10).toFixed(2)}, '0.8000', 240, '0.9000', '0.0000', '0.0000', '0.000'
        ) RETURNING id
      `
    )[0]!.id;

    await sql`
      INSERT INTO supplier_stock_profiles (supplier_id, makes, models, year_from, year_to, part_categories, max_radius_km)
      VALUES (${supplierId}, ${sql.array(['Nissan', 'Toyota'])}, ${sql.array(['Patrol', 'Land Cruiser'])},
              2005, 2024, ${sql.array(categories)}, 50)
      ON CONFLICT (supplier_id) DO NOTHING
    `;
    await sql`
      INSERT INTO supplier_presence (supplier_id, online, last_seen_at)
      VALUES (${supplierId}, false, now()) ON CONFLICT (supplier_id) DO NOTHING
    `;
    created += 1;
  }

  log(`load terminals: ${created} created, ${terminals - created} already present`);
  return created;
}

const invokedDirectly = process.argv[1]?.endsWith('seed-load.ts') === true;
if (invokedDirectly) {
  const flag = (name: string, fallback: string): string => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
  };
  seedLoadTerminals(Number(flag('terminals', '200')), flag('market', 'AE'))
    .then(async () => {
      await closeDb();
      await closeRedis();
    })
    .catch(async (err: unknown) => {
      console.error(err);
      await closeDb();
      await closeRedis();
      process.exit(1);
    });
}
