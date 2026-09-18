import type { FastifyRequest } from 'fastify';
import type { MarketConfig, UserRole } from '@ninety/shared';

/**
 * Per-request context.
 *
 * The market is resolved from the caller's own user record and attached here —
 * never read from a global, never inferred from a header a client controls.
 * Application code reaches every rate, SLA and locale through `ctx.market`.
 */
export interface Actor {
  readonly userId: string;
  readonly role: UserRole;
  readonly marketId: string;
  readonly locale: string;
  /** Populated lazily for supplier and buyer routes that need the profile row. */
  supplierId?: string;
  buyerId?: string;
}

export interface RequestContext {
  readonly requestId: string;
  actor: Actor | null;
  market: MarketConfig | null;
  locale: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext;
  }
}

export function requireActor(req: FastifyRequest): Actor {
  if (req.ctx.actor === null) {
    throw Object.assign(new Error('unauthenticated'), { statusCode: 401 });
  }
  return req.ctx.actor;
}

export function requireMarket(req: FastifyRequest): MarketConfig {
  if (req.ctx.market === null) {
    throw Object.assign(new Error('market not resolved'), { statusCode: 500 });
  }
  return req.ctx.market;
}
