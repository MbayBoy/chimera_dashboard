import { describe, expect, it } from 'vitest';
import { parsePoint } from './geography.js';

/**
 * PostGIS returns a point in whichever shape the query asked for. This decoder
 * handles all of them, because the alternative is a decoder that works until
 * someone writes an ordinary `select()` and gets a JSON parse error from inside
 * the ORM — which is exactly how this was found.
 */
describe('point decoding', () => {
  // Al Quoz, Dubai: the delivery pin used throughout the tests.
  const lng = 55.2416;
  const lat = 25.1499;

  it('decodes little-endian EWKB with an SRID', () => {
    const buffer = Buffer.alloc(25);
    buffer.writeUInt8(1, 0);
    buffer.writeUInt32LE(0x20000001, 1);
    buffer.writeUInt32LE(4326, 5);
    buffer.writeDoubleLE(lng, 9);
    buffer.writeDoubleLE(lat, 17);
    const point = parsePoint(buffer.toString('hex'));
    expect(point.lng).toBeCloseTo(lng, 10);
    expect(point.lat).toBeCloseTo(lat, 10);
  });

  it('decodes big-endian EWKB', () => {
    const buffer = Buffer.alloc(25);
    buffer.writeUInt8(0, 0);
    buffer.writeUInt32BE(0x20000001, 1);
    buffer.writeUInt32BE(4326, 5);
    buffer.writeDoubleBE(lng, 9);
    buffer.writeDoubleBE(lat, 17);
    const point = parsePoint(buffer.toString('hex'));
    expect(point.lng).toBeCloseTo(lng, 10);
    expect(point.lat).toBeCloseTo(lat, 10);
  });

  it('decodes GeoJSON, as returned by ST_AsGeoJSON', () => {
    const point = parsePoint(JSON.stringify({ type: 'Point', coordinates: [lng, lat] }));
    expect(point.lng).toBeCloseTo(lng, 10);
    expect(point.lat).toBeCloseTo(lat, 10);
  });

  it('decodes WKT and EWKT', () => {
    expect(parsePoint(`POINT(${lng} ${lat})`).lat).toBeCloseTo(lat, 10);
    expect(parsePoint(`SRID=4326;POINT(${lng} ${lat})`).lng).toBeCloseTo(lng, 10);
  });

  it('refuses a geometry that is not a point rather than returning nonsense', () => {
    const buffer = Buffer.alloc(25);
    buffer.writeUInt8(1, 0);
    buffer.writeUInt32LE(0x20000002, 1); // LINESTRING
    expect(() => parsePoint(buffer.toString('hex'))).toThrow(/POINT/);
  });
});
