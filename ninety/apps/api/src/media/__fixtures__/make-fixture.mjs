/**
 * Build a JPEG carrying real GPS EXIF, the way a yard's phone would.
 *
 * Generated rather than committed as a binary, so the fixture is reviewable: you
 * can read exactly which tags it carries instead of trusting a blob.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; }
function entry(tag, type, count, value) { return Buffer.concat([u16(tag), u16(type), u32(count), value]); }
function rational(pairs) { return Buffer.concat(pairs.flatMap(([n, d]) => [u32(n), u32(d)])); }

export function buildExifWithGps() {
  const ifd0Offset = 8;
  const ifd0Size = 2 + 2 * 12 + 4;
  const gpsOffset = ifd0Offset + ifd0Size;
  const gpsSize = 2 + 4 * 12 + 4;
  const dataOffset = gpsOffset + gpsSize;

  // Somewhere in Sharjah Industrial Area — the coordinates a yard's camera writes.
  const lat = rational([[25, 1], [20, 1], [4812, 100]]);
  const lon = rational([[55, 1], [24, 1], [1188, 100]]);
  const latOffset = dataOffset;
  const lonOffset = latOffset + lat.length;
  const makeString = Buffer.from('NINETY-FIXTURE-CAMERA\0', 'latin1');
  const makeOffset = lonOffset + lon.length;

  const gps = Buffer.concat([
    u16(4),
    entry(0x0001, 2, 2, Buffer.from('N\0\0\0', 'latin1')),
    entry(0x0002, 5, 3, u32(latOffset)),
    entry(0x0003, 2, 2, Buffer.from('E\0\0\0', 'latin1')),
    entry(0x0004, 5, 3, u32(lonOffset)),
    u32(0),
  ]);

  const ifd0 = Buffer.concat([
    u16(2),
    entry(0x010f, 2, makeString.length, u32(makeOffset)),
    entry(0x8825, 4, 1, u32(gpsOffset)),
    u32(0),
  ]);

  const tiff = Buffer.concat([Buffer.from('II', 'latin1'), u16(42), u32(ifd0Offset), ifd0, gps, lat, lon, makeString]);
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
}

/** Splice an APP1 EXIF segment into a JPEG immediately after SOI. */
export function injectExif(jpeg, exif) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(exif.length + 2);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), length, exif]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

export async function makeGpsTaggedJpeg() {
  const base = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 90, g: 90, b: 95 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  return injectExif(base, buildExifWithGps());
}

if (process.argv[1]?.endsWith('make-fixture.mjs')) {
  const jpeg = await makeGpsTaggedJpeg();
  const path = join(here, 'gps-tagged.jpg');
  writeFileSync(path, jpeg);
  const meta = await sharp(jpeg).metadata();
  console.log(`wrote ${path} — ${jpeg.length} bytes, exif ${meta.exif?.length ?? 0} bytes, ${meta.width}x${meta.height}`);
}
