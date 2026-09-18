import { customType } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';

export interface LonLat {
  readonly lng: number;
  readonly lat: number;
}

/**
 * PostGIS `GEOGRAPHY(POINT,4326)`.
 *
 * Geography rather than geometry, deliberately: distances come back in metres on
 * the spheroid instead of in degrees. A radius query against a geometry column
 * returns plausible-looking numbers that are wrong, and the wrongness only shows
 * up as a fill rate that will not explain itself.
 *
 * Values are read as GeoJSON and written as WKT, so nothing in application code
 * has to know about EWKB.
 */
export const geographyPoint = customType<{
  data: LonLat;
  driverData: string;
  config: undefined;
}>({
  dataType() {
    return 'geography(Point,4326)';
  },
  fromDriver(value: string): LonLat {
    return parsePoint(value);
  },
  toDriver(value: LonLat): string {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
});

/**
 * Decode whatever PostGIS hands back for a point.
 *
 * A plain `SELECT` of a geography column returns EWKB as a hex string, which is
 * the common case; a query that asked for `ST_AsGeoJSON` returns GeoJSON. Both
 * are handled here so that selecting a location is never a decision a caller has
 * to get right — the alternative is a decoder that works until someone writes an
 * ordinary `select()` and gets a parse error from inside the ORM.
 */
export function parsePoint(value: string): LonLat {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as { coordinates: [number, number] };
    return { lng: parsed.coordinates[0], lat: parsed.coordinates[1] };
  }
  if (trimmed.toUpperCase().startsWith('POINT') || trimmed.toUpperCase().startsWith('SRID=')) {
    const match = /POINT\s*\(\s*(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/i.exec(trimmed);
    if (match === null) throw new Error(`cannot parse point from WKT: ${trimmed.slice(0, 40)}`);
    return { lng: Number(match[1]), lat: Number(match[2]) };
  }
  return parseEwkbPoint(trimmed);
}

/**
 * EWKB point, as a hex string.
 *
 *   byte 0        endianness: 00 big, 01 little
 *   bytes 1-4     geometry type, with 0x20000000 set when an SRID follows
 *   bytes 5-8     SRID, when that flag is set
 *   then          X (lng) and Y (lat), each a float64
 */
function parseEwkbPoint(hex: string): LonLat {
  const buffer = Buffer.from(hex, 'hex');
  if (buffer.length < 21) throw new Error(`EWKB point too short: ${hex.slice(0, 20)}`);
  const littleEndian = buffer.readUInt8(0) === 1;
  const typeWord = littleEndian ? buffer.readUInt32LE(1) : buffer.readUInt32BE(1);
  const hasSrid = (typeWord & 0x20000000) !== 0;
  const geometryType = typeWord & 0xff;
  if (geometryType !== 1) throw new Error(`expected a POINT, got EWKB geometry type ${geometryType}`);
  const offset = hasSrid ? 9 : 5;
  const lng = littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
  const lat = littleEndian ? buffer.readDoubleLE(offset + 8) : buffer.readDoubleBE(offset + 8);
  return { lng, lat };
}

/** A point literal for use inside a raw SQL fragment. */
export function point(p: LonLat): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`;
}

/** Great-circle distance in metres between two geography points. */
export function distanceMeters(a: SQL, b: SQL): SQL {
  return sql`ST_Distance(${a}, ${b})`;
}

export function kmFromMeters(meters: number): number {
  return Math.round((meters / 1000) * 100) / 100;
}
