import sharp from 'sharp';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';
import { getMediaStore, type StoredObject } from './store.js';

/**
 * The media pipeline.
 *
 * Supplier photographs are the single largest anonymity leak in this product. A
 * photo of a shelf carries the yard's GPS coordinates in its EXIF, and a
 * filename or a camera serial number identifies it almost as well.
 *
 * So every image, in both directions, is decoded and re-encoded from pixels.
 * Nothing survives that is not pixels: no EXIF, no XMP, no IPTC, no ICC profile,
 * no thumbnail — and a stripped image cannot regain metadata that was never
 * carried through.
 *
 * Re-encoding rather than deleting the EXIF block matters. A metadata stripper
 * that edits the container leaves the embedded JPEG thumbnail, which is a second
 * copy of the image with its own metadata, and leaves maker-note blocks that
 * tools disagree about. Decoding to a raster and encoding fresh has no such
 * gaps.
 */

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

/** Long edge, in pixels. Large enough to judge a part, small enough for a yard's connection. */
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 82;

export type MediaKind = 'photo' | 'video';

export interface IngestedMedia extends StoredObject {
  readonly kind: MediaKind;
  readonly width: number | null;
  readonly height: number | null;
  /** True when the source carried location metadata. Recorded, never propagated. */
  readonly strippedGps: boolean;
  readonly strippedMetadataKeys: readonly string[];
}

export interface IngestOptions {
  readonly contentType: string;
  readonly declaredFilename?: string;
}

/**
 * Ingest one file: validate, strip, re-encode, store under a random key.
 *
 * Returns what was stripped so the caller can record it. Suppliers whose camera
 * writes GPS into every photo are the norm rather than the exception, and
 * knowing the rate is how we know the stripper is still running.
 */
export async function ingestMedia(body: Buffer, opts: IngestOptions): Promise<IngestedMedia> {
  const contentType = opts.contentType.split(';')[0]!.trim().toLowerCase();

  if (ALLOWED_VIDEO_TYPES.has(contentType)) {
    if (body.byteLength > MAX_VIDEO_BYTES) throw new AppError('validation_failed', 'error.media_too_large');
    // Video is stored as supplied. Re-encoding video in-process would block the
    // event loop for seconds; the transcode-and-strip worker is a Phase 2 item
    // and until it exists video is accepted only from buyers, whose identity the
    // supplier never sees anyway.
    const stored = await getMediaStore().put(body, contentType, extensionFor(contentType));
    return { ...stored, kind: 'video', width: null, height: null, strippedGps: false, strippedMetadataKeys: [] };
  }

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new AppError('validation_failed', 'error.media_type_not_allowed');
  }
  if (body.byteLength > MAX_IMAGE_BYTES) throw new AppError('validation_failed', 'error.media_too_large');

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(body).metadata();
  } catch {
    throw new AppError('validation_failed', 'error.media_type_not_allowed');
  }

  const present = describeMetadata(metadata);
  const hadGps = present.includes('exif.gps');

  // Decode, normalise orientation, downscale, encode fresh. `withMetadata` is
  // deliberately NOT called: its whole purpose is to carry metadata across, and
  // carrying metadata across is the thing this function exists to prevent.
  const pipeline = sharp(body, { failOn: 'none' })
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  // Verify rather than assume. The stripper running is load-bearing for the
  // business model, so it is checked on every upload, not in a test once.
  const after = await sharp(data).metadata();
  const residual = describeMetadata(after);
  if (residual.length > 0) {
    log.error('media metadata survived re-encoding', { residual });
    throw new AppError('internal_error', 'error.internal');
  }

  const stored = await getMediaStore().put(data, 'image/jpeg', 'jpg');
  if (hadGps) {
    log.info('stripped GPS metadata from an upload', { key: stored.key, bytesBefore: body.byteLength, bytesAfter: data.byteLength });
  }
  return {
    ...stored,
    kind: 'photo',
    width: info.width,
    height: info.height,
    strippedGps: hadGps,
    strippedMetadataKeys: present,
  };
}

/** Which metadata blocks an image carries. Used before and after re-encoding. */
export function describeMetadata(metadata: sharp.Metadata): string[] {
  const present: string[] = [];
  if (metadata.exif !== undefined && metadata.exif.byteLength > 0) {
    present.push('exif');
    if (containsGpsIfd(metadata.exif)) present.push('exif.gps');
  }
  if (metadata.xmp !== undefined && metadata.xmp.byteLength > 0) present.push('xmp');
  if (metadata.iptc !== undefined && metadata.iptc.byteLength > 0) present.push('iptc');
  if (metadata.icc !== undefined && metadata.icc.byteLength > 0) present.push('icc');
  if (metadata.orientation !== undefined && metadata.orientation > 1) present.push('orientation');
  return present;
}

/**
 * Detect a GPS IFD inside a raw EXIF block.
 *
 * Walks the TIFF header for tag 0x8825 (the GPS sub-IFD pointer) rather than
 * pattern-matching bytes, so it does not depend on which encoder wrote the file.
 */
function containsGpsIfd(exif: Buffer): boolean {
  try {
    // sharp prefixes the raw EXIF with the "Exif\0\0" marker.
    const start = exif.subarray(0, 6).toString('latin1') === 'Exif\0\0' ? 6 : 0;
    const tiff = exif.subarray(start);
    if (tiff.byteLength < 8) return false;
    const endian = tiff.subarray(0, 2).toString('latin1');
    const little = endian === 'II';
    if (!little && endian !== 'MM') return false;
    const u16 = (o: number) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
    const u32 = (o: number) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));

    const ifd0 = u32(4);
    if (ifd0 + 2 > tiff.byteLength) return false;
    const count = u16(ifd0);
    for (let i = 0; i < count; i++) {
      const entry = ifd0 + 2 + i * 12;
      if (entry + 12 > tiff.byteLength) break;
      if (u16(entry) === 0x8825) return true;
    }
    return false;
  } catch {
    // An EXIF block we cannot parse is treated as if it carried location data:
    // it is re-encoded away regardless, and over-reporting is the safe direction.
    return true;
  }
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'video/webm':
      return 'webm';
    default:
      return 'bin';
  }
}
