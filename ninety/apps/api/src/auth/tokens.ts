import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, isNull } from 'drizzle-orm';
import type { UserRole } from '@ninety/shared';
import { env } from '../env.js';
import { getDb } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';
import { AppError } from '../core/errors.js';

/**
 * Tokens.
 *
 * A short-lived access token carrying the role claim, and a long-lived refresh
 * token that is stored only as a hash so a database leak cannot be replayed as a
 * session. The role claim is what the route guards read; it is signed, so a
 * client cannot promote itself from buyer to admin by editing a payload.
 */

export interface AccessClaims {
  readonly sub: string;
  readonly role: UserRole;
  readonly marketId: string;
  readonly locale: string | null;
}

const ISSUER = 'ninety';
const AUDIENCE = 'ninety-clients';

function secret(which: 'access' | 'refresh'): Uint8Array {
  const value = which === 'access' ? env().JWT_SECRET : env().JWT_REFRESH_SECRET;
  return new TextEncoder().encode(value);
}

export async function issueAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, marketId: claims.marketId, locale: claims.locale })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env().JWT_ACCESS_TTL_SECONDS}s`)
    .sign(secret('access'));
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secret('access'), { issuer: ISSUER, audience: AUDIENCE });
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string' || typeof payload.marketId !== 'string') {
      throw new Error('malformed claims');
    }
    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      marketId: payload.marketId,
      locale: typeof payload.locale === 'string' ? payload.locale : null,
    };
  } catch {
    throw new AppError('unauthenticated', 'error.token_invalid');
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env().JWT_REFRESH_TTL_SECONDS * 1000);
  await getDb().insert(refreshTokens).values({ userId, tokenHash: hashToken(token), expiresAt });
  return token;
}

export async function consumeRefreshToken(token: string): Promise<string> {
  const db = getDb();
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, hashToken(token)), isNull(refreshTokens.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) throw new AppError('unauthenticated', 'error.token_invalid');
  // Rotate: a refresh token is single-use, so a stolen one is usable at most once
  // and the rightful owner's next refresh fails visibly rather than silently.
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
  return row.userId;
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await getDb()
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}
