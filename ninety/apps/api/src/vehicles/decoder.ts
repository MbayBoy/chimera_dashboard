import { and, eq, sql } from 'drizzle-orm';
import type { MarketConfig } from '@ninety/shared';
import { getDb } from '../db/client.js';
import { vehicles } from '../db/schema.js';
import { normaliseDigits } from '@ninety/shared';

/**
 * Vehicle identification.
 *
 * An interface with a seeded stub behind it. Real VIN decoding is a later
 * integration, and the interface must not change when it is swapped, because the
 * two markets identify vehicles differently: South Africa uses a 17-character
 * VIN, and the UAE uses a chassis number on GCC-spec vehicles, grey imports and
 * re-exports where automated decoding is unreliable.
 *
 * That unreliability is a product decision, not a limitation to apologise for.
 * A scan is a convenience; the system leans on make, model, year and the
 * photograph, and a decode that returns nothing is a normal outcome rather than
 * an error.
 */

export interface VehicleMatch {
  readonly id: string | null;
  readonly make: string;
  readonly model: string;
  readonly variant: string | null;
  readonly year: number;
  readonly bodyType: string | null;
  readonly engineCode: string | null;
  /** How much to trust this. A chassis-number guess is not a VIN decode. */
  readonly confidence: 'high' | 'medium' | 'low';
  readonly source: string;
}

export interface VehicleDecoder {
  decode(identifier: string, market: MarketConfig): Promise<VehicleMatch | null>;
}

/** Normalise an identifier: strip separators, uppercase, convert Arabic digits. */
export function normaliseIdentifier(raw: string): string {
  return normaliseDigits(raw).toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Whether an identifier is plausible for this market.
 *
 * The pattern comes from `markets.vehicle_id_regex`, never from code — the two
 * markets have genuinely different rules and a third will have a third.
 */
export function isPlausibleIdentifier(identifier: string, market: MarketConfig): boolean {
  const pattern = market.vehicleIdentifier.regex;
  if (pattern === null) return identifier.length > 0;
  try {
    return new RegExp(pattern).test(normaliseIdentifier(identifier));
  } catch {
    return false;
  }
}

/**
 * Seeded stub decoder.
 *
 * Deterministically maps an identifier onto a seeded vehicle so the rest of the
 * system can be exercised end to end. It reports `low` confidence for a market
 * whose identifier is a chassis number, which is honest: that is exactly how
 * much a GCC-spec chassis scan is worth.
 */
export class SeededVehicleDecoder implements VehicleDecoder {
  async decode(identifier: string, market: MarketConfig): Promise<VehicleMatch | null> {
    const normalised = normaliseIdentifier(identifier);
    if (!isPlausibleIdentifier(normalised, market)) return null;

    // An exact VIN we already hold beats any inference.
    const exact = await getDb().select().from(vehicles).where(eq(vehicles.vin, normalised)).limit(1);
    if (exact[0]) {
      const v = exact[0];
      return {
        id: v.id,
        make: v.make,
        model: v.model,
        variant: v.variant,
        year: v.year,
        bodyType: v.bodyType,
        engineCode: v.engineCode,
        confidence: 'high',
        source: 'catalogue',
      };
    }

    // Otherwise pick a catalogue vehicle deterministically from the identifier,
    // so the same scan always yields the same suggestion during a demonstration.
    const candidates = await getDb()
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.marketId, market.id)))
      .orderBy(vehicles.make, vehicles.model, vehicles.year);
    if (candidates.length === 0) return null;

    let hash = 0;
    for (const ch of normalised) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const v = candidates[hash % candidates.length]!;

    return {
      id: v.id,
      make: v.make,
      model: v.model,
      variant: v.variant,
      year: v.year,
      bodyType: v.bodyType,
      engineCode: v.engineCode,
      // A chassis number on a grey import tells you much less than a VIN does,
      // and the interface says so rather than pretending otherwise.
      confidence: market.vehicleIdentifier.type === 'vin' ? 'medium' : 'low',
      source: 'stub',
    };
  }
}

let decoder: VehicleDecoder = new SeededVehicleDecoder();
export function getVehicleDecoder(): VehicleDecoder {
  return decoder;
}
export function setVehicleDecoder(next: VehicleDecoder): void {
  decoder = next;
}

/**
 * Resolve a vehicle the buyer typed by hand, creating a catalogue row when it is
 * one we have not seen. Make, model and year are what matching actually uses.
 */
export async function resolveOrCreateVehicle(
  input: { make: string; model: string; year: number; variant?: string | null },
  marketId: string,
): Promise<string> {
  const db = getDb();
  const existing = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(
      and(
        sql`lower(${vehicles.make}) = lower(${input.make})`,
        sql`lower(${vehicles.model}) = lower(${input.model})`,
        eq(vehicles.year, input.year),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(vehicles)
    .values({
      make: input.make,
      model: input.model,
      year: input.year,
      variant: input.variant ?? null,
      marketId,
    })
    .returning({ id: vehicles.id });
  return inserted[0]!.id;
}
