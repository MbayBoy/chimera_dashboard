import type { FastifyInstance } from 'fastify';
import { pingDb } from '../db/client.js';
import { pingRedis } from '../core/redis.js';
import { env } from '../env.js';

/**
 * Health.
 *
 * Reports the database and Redis honestly, and names the PostGIS version — the
 * one dependency whose absence is invisible until a radius query returns
 * plausible numbers that are wrong.
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/health', async (_req, reply) => {
    const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
    const ok = db.ok && redis.ok;
    return reply.status(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'degraded',
      checks: {
        database: { ok: db.ok, postgis: db.postgis, ...(db.error === undefined ? {} : { error: db.error }) },
        redis: { ok: redis.ok, ...(redis.error === undefined ? {} : { error: redis.error }) },
      },
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  /**
   * The minimum supported buyer-app version.
   *
   * The app blocks below this and prompts to update. Built now rather than
   * later, because the first breaking API change strands exactly the users who
   * cannot be told to update.
   */
  app.get('/v1/app-version', async (_req, reply) =>
    reply.send({ minimumSupportedVersion: env().MIN_BUYER_APP_VERSION }),
  );
}
