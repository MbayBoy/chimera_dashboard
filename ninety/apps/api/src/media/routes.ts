import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { join, normalize } from 'node:path';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { authenticate, requireRole, withBuyerProfile, withSupplierProfile } from '../auth/guards.js';
import { getDb } from '../db/client.js';
import { offers, offerMedia, requests, requestMedia } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { ingestMedia } from './pipeline.js';
import { env } from '../env.js';
import { log } from '../core/logger.js';

/**
 * Media upload.
 *
 * Both directions go through the same ingest, because the path most often
 * forgotten is the supplier's — and the supplier's photo is the one that leaks.
 */
export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/requests/:id/media', {
    preHandler: [authenticate, requireRole('buyer')],
    config: { rateLimit: { max: 40, timeWindow: '5 minutes' } },
    handler: async (req, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const buyerId = await withBuyerProfile(req);
      const owned = (
        await getDb()
          .select({ id: requests.id })
          .from(requests)
          .where(and(eq(requests.id, params.id), eq(requests.buyerId, buyerId)))
          .limit(1)
      )[0];
      if (!owned) throw new AppError('not_found', 'error.not_found');

      const file = await req.file();
      if (file === undefined) throw new AppError('validation_failed', 'error.media_type_not_allowed');
      const body = await file.toBuffer();
      const ingested = await ingestMedia(body, { contentType: file.mimetype, declaredFilename: file.filename });

      const inserted = await getDb()
        .insert(requestMedia)
        .values({
          requestId: params.id,
          url: ingested.url,
          storageKey: ingested.key,
          kind: ingested.kind,
          width: ingested.width,
          height: ingested.height,
          bytes: ingested.bytes,
        })
        .returning({ id: requestMedia.id });

      return reply.status(201).send({
        id: inserted[0]!.id,
        url: ingested.url,
        kind: ingested.kind,
        strippedGps: ingested.strippedGps,
      });
    },
  });

  app.post('/v1/supplier/offers/:id/media', {
    preHandler: [authenticate, requireRole('supplier')],
    config: { rateLimit: { max: 60, timeWindow: '5 minutes' } },
    handler: async (req, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const supplierId = await withSupplierProfile(req);
      const owned = (
        await getDb()
          .select({ id: offers.id })
          .from(offers)
          .where(and(eq(offers.id, params.id), eq(offers.supplierId, supplierId)))
          .limit(1)
      )[0];
      if (!owned) throw new AppError('not_found', 'error.not_found');

      const file = await req.file();
      if (file === undefined) throw new AppError('validation_failed', 'error.media_type_not_allowed');
      const body = await file.toBuffer();
      const ingested = await ingestMedia(body, { contentType: file.mimetype, declaredFilename: file.filename });

      // A photo of a shelf may show the yard's signage. Metadata leaks are
      // handled here; a visual leak needs a human, so high-risk uploads are
      // flagged for review rather than blocked — blocking would cost the offer.
      const leakReviewStatus = ingested.strippedGps ? 'pending' : 'not_required';
      if (ingested.strippedGps) {
        log.info('supplier photo carried location metadata and is queued for visual review', {
          offerId: params.id,
          key: ingested.key,
        });
      }

      const inserted = await getDb()
        .insert(offerMedia)
        .values({
          offerId: params.id,
          url: ingested.url,
          storageKey: ingested.key,
          kind: ingested.kind,
          width: ingested.width,
          height: ingested.height,
          bytes: ingested.bytes,
          leakReviewStatus,
        })
        .returning({ id: offerMedia.id });

      return reply.status(201).send({ id: inserted[0]!.id, url: ingested.url, kind: ingested.kind });
    },
  });

  /**
   * Local-disk media serving, for development only.
   *
   * In every deployed environment media is served from the S3-compatible bucket
   * directly. This route exists so a developer can see the photos without
   * standing up object storage, and it refuses to run anywhere else.
   */
  app.get('/media/*', async (req, reply) => {
    if (env().MEDIA_DRIVER !== 'local') throw new AppError('not_found', 'error.not_found');
    const raw = (req.params as { '*': string })['*'];
    const safe = normalize(raw).replace(/^(\.\.[/\\])+/, '');
    if (safe.includes('..')) throw new AppError('forbidden', 'error.forbidden');
    const path = join(env().MEDIA_LOCAL_DIR, safe);
    return reply.type('image/jpeg').send(createReadStream(path));
  });
}
