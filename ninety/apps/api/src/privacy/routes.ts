import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { toIsoUtc } from '@ninety/shared';
import { authenticate, requireRole } from '../auth/guards.js';
import { getDb } from '../db/client.js';
import { dataDeletionRequests, users } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { executeErasure, requestErasure } from './service.js';

/**
 * The erasure path.
 *
 * A person asks for their data to be deleted from the app they already use, in
 * one call, without writing to anybody. An admin executes it and gets a report.
 * Both halves exist because a right that can only be exercised by email is a
 * right most people never exercise.
 */
export async function registerPrivacyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/account/deletion-request', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const body = z.object({ reason: z.string().trim().max(500).nullish() }).parse(req.body ?? {});
      const actor = req.ctx.actor!;
      const created = await requestErasure({
        userId: actor.userId,
        requestedBy: actor.userId,
        reason: body.reason ?? null,
      });
      // No promise of a deadline the operations team has not agreed to. What it
      // says is true: it is recorded, and a human will act on it.
      return reply.code(202).send({ id: created.id, status: created.status });
    },
  });

  app.get('/v1/admin/deletion-requests', { preHandler: [authenticate, requireRole('admin')] }, async (_req, reply) => {
    const rows = await getDb()
      .select({
        id: dataDeletionRequests.id,
        userId: dataDeletionRequests.userId,
        status: dataDeletionRequests.status,
        reason: dataDeletionRequests.reason,
        createdAt: dataDeletionRequests.createdAt,
        completedAt: dataDeletionRequests.completedAt,
        report: dataDeletionRequests.report,
        role: users.role,
      })
      .from(dataDeletionRequests)
      .leftJoin(users, eq(users.id, dataDeletionRequests.userId))
      .orderBy(desc(dataDeletionRequests.createdAt))
      .limit(200);

    return reply.send({
      requests: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        role: row.role,
        status: row.status,
        reason: row.reason,
        createdAt: toIsoUtc(row.createdAt),
        completedAt: row.completedAt === null ? null : toIsoUtc(row.completedAt),
        report: row.report,
      })),
    });
  });

  app.post(
    '/v1/admin/deletion-requests/:id/execute',
    { preHandler: [authenticate, requireRole('admin')] },
    async (req, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const actor = req.ctx.actor!;
      const report = await executeErasure(params.id, actor.userId);
      return reply.send(report);
    },
  );

  /** An admin may raise one on someone's behalf — a request that arrived by phone. */
  app.post('/v1/admin/deletion-requests', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const body = z
      .object({ userId: z.string().uuid(), reason: z.string().trim().max(500).nullish() })
      .parse(req.body);
    const target = (await getDb().select().from(users).where(eq(users.id, body.userId)).limit(1))[0];
    if (target === undefined) throw new AppError('not_found', 'error.not_found');
    const created = await requestErasure({
      userId: body.userId,
      requestedBy: req.ctx.actor!.userId,
      reason: body.reason ?? null,
    });
    return reply.code(202).send(created);
  });
}
