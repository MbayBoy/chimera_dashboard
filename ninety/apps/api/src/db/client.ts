import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { env } from '../env.js';

/**
 * Data layer: Drizzle over postgres-js.
 *
 * Justification, in one line as the phase asks: PostGIS `GEOGRAPHY(POINT,4326)`
 * is a first-class custom type in Drizzle and its SQL-first model lets the radius
 * queries that drive matching stay readable, where Prisma would need an
 * `Unsupported` escape hatch for every location column plus a query-engine binary.
 *
 * Money note: postgres-js is configured to hand back BIGINT columns as JavaScript
 * numbers after asserting they are safe integers, rather than as strings that
 * invite `parseFloat`. The first float in a money path is a reconciliation
 * problem you chase for a week.
 */

export type Sql = ReturnType<typeof makeSql>;

let sqlClient: Sql | null = null;
let dbClient: ReturnType<typeof drizzle<typeof schema>> | null = null;

function makeSql(url: string, max: number) {
  return postgres(url, {
    max,
    prepare: false,
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (v: number | bigint) => String(v),
        parse: (v: string) => {
          const n = Number(v);
          if (!Number.isSafeInteger(n)) {
            throw new Error(`bigint ${v} exceeds safe integer range; money must stay in integer minor units`);
          }
          return n;
        },
      },
    },
    onnotice: () => {},
  });
}

export function getSql(): Sql {
  if (sqlClient === null) sqlClient = makeSql(env().DATABASE_URL, env().NODE_ENV === 'test' ? 5 : 20);
  return sqlClient;
}

export function getDb() {
  if (dbClient === null) {
    dbClient = drizzle(getSql(), { schema });
    restoreTimestampSerialiser();
  }
  return dbClient;
}

/**
 * Repair the timestamp serialiser after Drizzle has initialised.
 *
 * Drizzle formats values itself and, on construction, replaces postgres-js's
 * serializer for the timestamp OIDs with an identity function so its own
 * pre-formatted strings pass through untouched. That is correct for Drizzle's
 * queries and wrong for everything else: this codebase also issues raw
 * postgres-js templates for the PostGIS work, and a `Date` passed into one of
 * those then reaches the wire protocol as an object and throws.
 *
 * The shared client is a deliberate choice — one pool, one transaction boundary
 * — so the fix belongs here rather than in a rule about which helper may be
 * passed which type. A serializer that handles both shapes satisfies both
 * callers: Drizzle's strings pass through unchanged, and a Date from a raw
 * template becomes the absolute UTC timestamp this system uses everywhere.
 */
function restoreTimestampSerialiser(): void {
  const options = (
    getSql() as unknown as {
      options?: {
        serializers?: Record<number, (x: unknown) => unknown>;
        parsers?: Record<number, (x: unknown) => unknown>;
      };
    }
  ).options;
  if (options === undefined) return;

  // Writing: a Date becomes an absolute UTC timestamp; anything Drizzle has
  // already formatted passes through unchanged.
  if (options.serializers !== undefined) {
    for (const oid of [TIMESTAMP_OID, TIMESTAMPTZ_OID, DATE_OID]) {
      options.serializers[oid] = (x: unknown) => (x instanceof Date ? x.toISOString() : String(x));
    }
  }

  // Reading: only `timestamptz` is restored. Every timestamp column in this
  // schema is `withTimezone: true`, and Drizzle's own mapper accepts a Date for
  // those. `date` columns are deliberately left alone — Drizzle declares them as
  // strings, and handing it a Date there would be the same bug in reverse.
  if (options.parsers !== undefined) {
    options.parsers[TIMESTAMPTZ_OID] = (x: unknown) => (x instanceof Date ? x : new Date(String(x)));
  }
}

const DATE_OID = 1082;
const TIMESTAMP_OID = 1114;
const TIMESTAMPTZ_OID = 1184;

export type Database = ReturnType<typeof getDb>;

export async function closeDb(): Promise<void> {
  if (sqlClient !== null) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
    dbClient = null;
  }
}

/** Health probe used by GET /v1/health. */
export async function pingDb(): Promise<{ ok: boolean; postgis: string | null; error?: string }> {
  try {
    const rows = await getSql()<{ postgis: string }[]>`SELECT postgis_version() AS postgis`;
    return { ok: true, postgis: rows[0]?.postgis ?? null };
  } catch (err) {
    return { ok: false, postgis: null, error: err instanceof Error ? err.message : String(err) };
  }
}
