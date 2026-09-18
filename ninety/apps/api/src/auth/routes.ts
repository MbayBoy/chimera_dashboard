import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { buyers, users } from '../db/schema.js';
import { marketConfig } from '../market/config.js';
import { requestOtp, verifyOtp } from './otp.js';
import { consumeRefreshToken, issueAccessToken, issueRefreshToken, revokeAllRefreshTokens } from './tokens.js';
import { authenticate } from './guards.js';
import { AppError } from '../core/errors.js';
import { resolveLocale } from '../i18n/index.js';
import { env } from '../env.js';

/**
 * Authentication routes.
 *
 * Phone OTP, because the people this product serves have a phone and may not
 * have an email address, and because a workshop's "account" is a person on a
 * shop floor rather than a corporate identity.
 *
 * Buyers self-register on verification. Suppliers and admins do not: a yard is
 * signed in person, its terminal configured on the visit, and its user record
 * created by the field team — so a supplier login against an unknown phone is a
 * rejection, not a silent account creation.
 */

const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(20)
  .regex(/^\+?[0-9\s().-]+$/, 'phone must be digits with optional separators')
  .transform((v) => v.replace(/[\s().-]/g, ''));

const requestBody = z.object({
  marketCode: z.string().trim().min(2).max(4),
  phone: phoneSchema,
  locale: z.string().trim().min(2).max(10).optional(),
});

const verifyBody = requestBody.extend({
  code: z.string().trim().regex(/^[0-9]{6}$/),
  role: z.enum(['buyer', 'supplier', 'admin']).default('buyer'),
  buyerType: z.enum(['workshop', 'panelbeater', 'consumer', 'fleet']).optional(),
  businessName: z.string().trim().max(200).optional(),
  displayName: z.string().trim().max(200).optional(),
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/otp/request', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    handler: async (req, reply) => {
      const body = requestBody.parse(req.body);
      const market = await marketConfig.byCode(body.marketCode);
      const locale = resolveLocale(body.locale, market.localeDefault);
      req.ctx.locale = locale;
      const result = await requestOtp(market.id, body.phone, locale);
      return reply.status(202).send({
        expiresAt: result.expiresAt.toISOString(),
        ...(result.devCode === undefined ? {} : { devCode: result.devCode }),
      });
    },
  });

  app.post('/v1/auth/otp/verify', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    handler: async (req, reply) => {
      const body = verifyBody.parse(req.body);
      const market = await marketConfig.byCode(body.marketCode);
      const locale = resolveLocale(body.locale, market.localeDefault);
      req.ctx.locale = locale;

      await verifyOtp(market.id, body.phone, body.code);

      const db = getDb();
      const existing = (
        await db
          .select()
          .from(users)
          .where(and(eq(users.marketId, market.id), eq(users.phone, body.phone)))
          .limit(1)
      )[0];

      let user = existing;
      if (!user) {
        if (body.role !== 'buyer') {
          // Yards and staff are created by the field and ops teams, never by a
          // successful OTP against an unknown number.
          throw new AppError('forbidden', 'error.role_not_permitted');
        }
        const inserted = await db
          .insert(users)
          .values({
            marketId: market.id,
            role: 'buyer',
            phone: body.phone,
            locale,
            displayName: body.displayName ?? null,
          })
          .returning();
        user = inserted[0]!;
        await db.insert(buyers).values({
          userId: user.id,
          type: body.buyerType ?? 'workshop',
          businessName: body.businessName ?? null,
        });
      }

      if (!user.isActive || user.deletedAt !== null) throw new AppError('forbidden', 'error.role_not_permitted');
      if (body.role !== user.role) throw new AppError('forbidden', 'error.role_not_permitted');

      const effectiveLocale = resolveLocale(user.locale ?? locale, market.localeDefault);
      const accessToken = await issueAccessToken({
        sub: user.id,
        role: user.role as 'buyer' | 'supplier' | 'admin',
        marketId: user.marketId,
        locale: effectiveLocale,
      });
      const refreshToken = await issueRefreshToken(user.id);

      return reply.status(200).send({
        accessToken,
        refreshToken,
        expiresIn: env().JWT_ACCESS_TTL_SECONDS,
        user: {
          id: user.id,
          role: user.role,
          marketCode: market.code,
          locale: effectiveLocale,
          rtl: market.rtl,
          displayName: user.displayName,
        },
      });
    },
  });

  app.post('/v1/auth/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    handler: async (req, reply) => {
      const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
      const userId = await consumeRefreshToken(body.refreshToken);
      const user = (await getDb().select().from(users).where(eq(users.id, userId)).limit(1))[0];
      if (!user || !user.isActive || user.deletedAt !== null) throw new AppError('unauthenticated', 'error.token_invalid');
      const market = await marketConfig.byId(user.marketId);
      const locale = resolveLocale(user.locale, market.localeDefault);
      return reply.send({
        accessToken: await issueAccessToken({
          sub: user.id,
          role: user.role as 'buyer' | 'supplier' | 'admin',
          marketId: user.marketId,
          locale,
        }),
        refreshToken: await issueRefreshToken(user.id),
        expiresIn: env().JWT_ACCESS_TTL_SECONDS,
      });
    },
  });

  app.post('/v1/auth/logout', { preHandler: authenticate }, async (req, reply) => {
    await revokeAllRefreshTokens(req.ctx.actor!.userId);
    return reply.status(204).send();
  });

  app.get('/v1/auth/me', { preHandler: authenticate }, async (req, reply) => {
    const actor = req.ctx.actor!;
    const market = req.ctx.market!;
    return reply.send({
      id: actor.userId,
      role: actor.role,
      locale: actor.locale,
      market: {
        code: market.code,
        name: market.name,
        currency: market.currency,
        rtl: market.rtl,
        locales: market.locales,
        timezone: market.timezone,
        vehicleIdentifier: market.vehicleIdentifier,
        sla: market.sla,
        addressModel: market.addressModel,
        isLive: market.isLive,
      },
    });
  });
}
