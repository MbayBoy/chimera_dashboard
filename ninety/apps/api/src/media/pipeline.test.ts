import { beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { describeMetadata, ingestMedia } from './pipeline.js';
import { setMediaStore, type MediaStore, type StoredObject } from './store.js';
import { makeGpsTaggedJpeg } from './__fixtures__/make-fixture.mjs';

/**
 * EXIF stripping.
 *
 * Supplier photographs are the single largest anonymity leak in this product: a
 * photo of a shelf carries the yard's coordinates. This is the test that says
 * the stripper runs, and it asserts against what came out rather than against
 * what the code claims to do.
 */
describe('media pipeline strips every trace of where a photo was taken', () => {
  const stored = new Map<string, Buffer>();

  beforeAll(() => {
    process.env.MEDIA_DRIVER = 'local';
    process.env.MEDIA_PUBLIC_BASE_URL = 'http://media.test';
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://ninety@localhost:5432/ninety_test';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-access-secret-not-used-anywhere-else';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-used-anywhere-else';

    // In-memory store: this test is about the pixels, not about the disk.
    const memory: MediaStore = {
      async put(body, _contentType, extension): Promise<StoredObject> {
        const key = `${stored.size}.${extension}`;
        stored.set(key, body);
        return { key, url: `http://media.test/${key}`, bytes: body.byteLength };
      },
      async get(key) {
        return stored.get(key)!;
      },
      async delete(key) {
        stored.delete(key);
      },
      urlFor(key) {
        return `http://media.test/${key}`;
      },
    };
    setMediaStore(memory);
  });

  it('the fixture genuinely carries GPS before ingest — otherwise this test proves nothing', async () => {
    const jpeg = await makeGpsTaggedJpeg();
    const before = await sharp(jpeg).metadata();
    expect(before.exif).toBeDefined();
    expect(before.exif!.byteLength).toBeGreaterThan(0);
    expect(describeMetadata(before)).toContain('exif');
    expect(describeMetadata(before)).toContain('exif.gps');
    // And the coordinates are really in there, as bytes.
    expect(before.exif!.includes(Buffer.from('NINETY-FIXTURE-CAMERA', 'latin1'))).toBe(true);
  });

  it('removes EXIF, GPS and the camera make from an ingested photo', async () => {
    const jpeg = await makeGpsTaggedJpeg();
    const result = await ingestMedia(jpeg, { contentType: 'image/jpeg', declaredFilename: 'al-sajaa-shelf-3.jpg' });

    expect(result.strippedGps).toBe(true);
    expect(result.strippedMetadataKeys).toContain('exif.gps');

    const output = stored.get(result.key)!;
    const after = await sharp(output).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    expect(describeMetadata(after)).toEqual([]);

    // Belt and braces: the identifying bytes are not anywhere in the output file,
    // not merely absent from the metadata sharp chooses to report.
    expect(output.includes(Buffer.from('NINETY-FIXTURE-CAMERA', 'latin1'))).toBe(false);
    expect(output.includes(Buffer.from('Exif\0\0', 'latin1'))).toBe(false);
    expect(output.includes(Buffer.from('GPS', 'latin1'))).toBe(false);
  });

  it('never preserves the original filename in the storage key', async () => {
    // `al-sajaa-yard-shelf-3.jpg` identifies a supplier as effectively as the
    // EXIF that was just removed from it.
    const jpeg = await makeGpsTaggedJpeg();
    const result = await ingestMedia(jpeg, { contentType: 'image/jpeg', declaredFilename: 'al-sajaa-yard-shelf-3.jpg' });
    expect(result.key).not.toContain('sajaa');
    expect(result.key).not.toContain('yard');
    expect(result.url).not.toContain('sajaa');
  });

  it('strips the same way on the buyer path as on the supplier path', async () => {
    // The supplier's photo is the one that leaks, and it is also the one most
    // often forgotten — the stripper is on ingest, so there is one path.
    const jpeg = await makeGpsTaggedJpeg();
    const first = await ingestMedia(jpeg, { contentType: 'image/jpeg' });
    const second = await ingestMedia(jpeg, { contentType: 'image/jpeg' });
    for (const result of [first, second]) {
      const meta = await sharp(stored.get(result.key)!).metadata();
      expect(meta.exif).toBeUndefined();
    }
    expect(first.key).not.toBe(second.key);
  });

  it('normalises orientation rather than carrying an EXIF rotation flag', async () => {
    const rotated = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#333' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await ingestMedia(rotated, { contentType: 'image/jpeg' });
    const meta = await sharp(stored.get(result.key)!).metadata();
    // Orientation 6 means "rotate 90°": applied to the pixels, so the stored
    // image is portrait and carries no flag for a client to misinterpret.
    expect(meta.orientation).toBeUndefined();
    expect(meta.height).toBeGreaterThan(meta.width!);
  });

  it('downscales an oversized photo so a yard connection can carry it', async () => {
    const huge = await sharp({ create: { width: 6000, height: 4000, channels: 3, background: '#777' } }).jpeg().toBuffer();
    const result = await ingestMedia(huge, { contentType: 'image/jpeg' });
    expect(result.width).toBeLessThanOrEqual(2048);
    expect(result.height).toBeLessThanOrEqual(2048);
  });

  it('rejects a file that is not an image or a short video', async () => {
    await expect(ingestMedia(Buffer.from('#!/bin/sh\nrm -rf /'), { contentType: 'application/x-sh' })).rejects.toThrow();
    await expect(ingestMedia(Buffer.from('not really a jpeg'), { contentType: 'image/jpeg' })).rejects.toThrow();
  });

  it('rejects a photo larger than the limit', async () => {
    const oversized = Buffer.alloc(13 * 1024 * 1024, 1);
    await expect(ingestMedia(oversized, { contentType: 'image/jpeg' })).rejects.toThrow();
  });
});
