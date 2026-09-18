import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@ninety/shared';
import { verifyAccessToken } from './tokens.js';
import { getDb } from '../db/client.js';
import { buyers, suppliers, users } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { marketConfig } from '../market/config.js';
import { languageOf, resolveLocale, supportedLanguages } from '../i18n/index.js';

/**
 * Authentication and role guards.
 *
 * `authenticate` establishes who is calling and — the part that matters for this
 * product — resolves their market from their own user record and attaches the
 * typed configuration to the request. Nothing downstream reads a rate, an SLA or
 * a currency from anywhere else.
 *
 * "It has role guards" is not the same as "a buyer token is rejected on a
 * supplier route", which is why that specific case has a test of its own.
 */

function bearerFrom(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = bearerFrom(req);
  if (token === null) throw new AppError('unauthenticated', 'error.unauthenticated');

  const claims = await verifyAccessToken(token);
  const rows = await getDb().select().from(users).where(eq(users.id, claims.sub)).limit(1);
  const user = rows[0];
  if (!user || !user.isActive || user.deletedAt !== null) throw new AppError('unauthenticated', 'error.token_invalid');
  // The role is re-read from the database rather than trusted from the token, so
  // a suspension or a role change takes effect on the next call rather than on
  // the next token expiry.
  const market = await marketConfig.byId(user.marketId);
  req.ctx.actor = {
    userId: user.id,
    role: user.role as UserRole,
    marketId: user.marketId,
    locale: resolveLocale(user.locale, market.localeDefault),
  };
  req.ctx.market = market;

  /*
   * An explicit Accept-Language wins, for this request only.
   *
   * A terminal is shared hardware: the account belongs to the yard, but the
   * person at the counter this afternoon may read English and the one this
   * evening Arabic. The device's language switch has to change what the screen
   * says, and the account's stored locale is still what a push notification
   * uses — that is sent with no request in hand, and belongs to the yard rather
   * than to whoever is standing there.
   */
  req.ctx.locale = preferredLocale(req, req.ctx.actor.locale);
}

/**
 * Honour an explicit, supported Accept-Language over the stored locale.
 *
 * Only an explicit one: a browser sending `en-US,en;q=0.9` by default should not
 * override an Arabic yard's account. The terminal sends the header deliberately
 * when its language toggle is set.
 */
function preferredLocale(req: FastifyRequest, fallback: string): string {
  const header = req.headers['accept-language'];
  if (typeof header !== 'string' || header.trim() === '') return fallback;
  const first = header.split(',')[0]?.trim() ?? '';
  if (first === '' || first === '*') return fallback;
  return supportedLanguages().includes(languageOf(first)) ? first : fallback;
}

/** Optional authentication: attaches an actor when a valid token is present. */
export async function authenticateOptional(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (bearerFrom(req) === null) return;
  await authenticate(req, reply);
}

export function requireRole(...allowed: readonly UserRole[]) {
  return async function guard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const actor = req.ctx.actor;
    if (actor === null) throw new AppError('unauthenticated', 'error.unauthenticated');
    if (!allowed.includes(actor.role)) throw new AppError('forbidden', 'error.role_not_permitted');
  };
}

/** Resolve and cache the supplier profile for a supplier-role caller. */
export async function withSupplierProfile(req: FastifyRequest): Promise<string> {
  const actor = req.ctx.actor;
  if (actor === null) throw new AppError('unauthenticated', 'error.unauthenticated');
  if (actor.supplierId !== undefined) return actor.supplierId;
  const rows = await getDb().select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.userId, actor.userId)).limit(1);
  const id = rows[0]?.id;
  if (id === undefined) throw new AppError('forbidden', 'error.supplier_not_active');
  actor.supplierId = id;
  return id;
}

export async function withBuyerProfile(req: FastifyRequest): Promise<string> {
  const actor = req.ctx.actor;
  if (actor === null) throw new AppError('unauthenticated', 'error.unauthenticated');
  if (actor.buyerId !== undefined) return actor.buyerId;
  const rows = await getDb().select({ id: buyers.id }).from(buyers).where(eq(buyers.userId, actor.userId)).limit(1);
  const id = rows[0]?.id;
  if (id === undefined) throw new AppError('forbidden', 'error.role_not_permitted');
  actor.buyerId = id;
  return id;
}
