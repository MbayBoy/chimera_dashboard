import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { DeliveryStatus, toIsoUtc } from '@ninety/shared';
import { authenticate, requireRole, withBuyerProfile } from '../auth/guards.js';
import { getDb } from '../db/client.js';
import { deliveries, orders, requests } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { markCollected, markDelivered, markDeliveryFailed } from './service.js';
import { t } from '../i18n/index.js';
import { log } from '../core/logger.js';

/**
 * Delivery tracking.
 *
 * The buyer-facing payload is the physical extension of the anonymisation rule.
 * It carries progress and an ETA, and it carries NO pickup location, no
 * coordinates, no provider reference and no live position for the driver.
 *
 * A moving dot on a map traces a line straight back to the yard. It is a lovely
 * feature, and it is the single most common way a delivery product undoes its
 * own double-blind — so it is not built, rather than built and hidden.
 */

/** Exactly what a buyer may see about a delivery. Nothing else is emitted. */
export interface BuyerTrackingView {
  readonly status: string;
  readonly statusLabel: string;
  readonly steps: readonly { readonly key: string; readonly label: string; readonly at: string | null; readonly done: boolean }[];
  readonly etaAt: string | null;
  readonly deliveredAt: string | null;
  readonly serverTime: string;
}

export function toBuyerTrackingView(
  input: {
    status: string;
    dispatchedAt: Date | null;
    collectedAt: Date | null;
    deliveredAt: Date | null;
    quotedEtaMin: number | null;
  },
  locale: string,
): BuyerTrackingView {
  const etaBase = input.dispatchedAt;
  const etaAt =
    etaBase === null || input.quotedEtaMin === null || input.deliveredAt !== null
      ? null
      : toIsoUtc(new Date(etaBase.getTime() + input.quotedEtaMin * 60_000));

  return {
    status: input.status,
    statusLabel: t(`state.${mapToRequestState(input.status)}`, locale),
    steps: [
      {
        key: 'packing',
        label: t('state.ACCEPTED', locale),
        at: input.dispatchedAt === null ? null : toIsoUtc(input.dispatchedAt),
        done: input.dispatchedAt !== null,
      },
      {
        key: 'collected',
        label: t('state.IN_TRANSIT', locale),
        at: input.collectedAt === null ? null : toIsoUtc(input.collectedAt),
        done: input.collectedAt !== null,
      },
      {
        key: 'delivered',
        label: t('state.DELIVERED', locale),
        at: input.deliveredAt === null ? null : toIsoUtc(input.deliveredAt),
        done: input.deliveredAt !== null,
      },
    ],
    etaAt,
    deliveredAt: input.deliveredAt === null ? null : toIsoUtc(input.deliveredAt),
    serverTime: toIsoUtc(new Date()),
  };
}

function mapToRequestState(deliveryStatus: string): string {
  switch (deliveryStatus) {
    case DeliveryStatus.DELIVERED:
      return 'DELIVERED';
    case DeliveryStatus.COLLECTED:
    case DeliveryStatus.IN_TRANSIT:
      return 'IN_TRANSIT';
    case DeliveryStatus.FAILED:
      return 'DELIVERY_FAILED';
    default:
      return 'DISPATCHED';
  }
}

export async function registerDeliveryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/requests/:id/tracking', { preHandler: [authenticate, requireRole('buyer')] }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const buyerId = await withBuyerProfile(req);

    const request = (
      await getDb()
        .select()
        .from(requests)
        .where(and(eq(requests.id, params.id), eq(requests.buyerId, buyerId)))
        .limit(1)
    )[0];
    if (!request) throw new AppError('not_found', 'error.not_found');

    const order = (
      await getDb().select().from(orders).where(eq(orders.requestId, params.id)).orderBy(desc(orders.createdAt)).limit(1)
    )[0];
    if (!order) return reply.send({ tracking: null, reference: request.reference });

    const delivery = (
      await getDb().select().from(deliveries).where(eq(deliveries.orderId, order.id)).orderBy(desc(deliveries.attempt)).limit(1)
    )[0];
    if (!delivery) return reply.send({ tracking: null, reference: request.reference });

    // Built by the serialiser above from four timestamps and a status. The
    // pickup location, the provider reference and the driver's position are
    // never read here, so they cannot be emitted here.
    return reply.send({
      reference: request.reference,
      tracking: toBuyerTrackingView(
        {
          status: delivery.status,
          dispatchedAt: delivery.dispatchedAt,
          collectedAt: delivery.collectedAt,
          deliveredAt: delivery.deliveredAt,
          quotedEtaMin: delivery.quotedEtaMin,
        },
        req.ctx.locale,
      ),
    });
  });

  /**
   * Courier callbacks.
   *
   * Signed with a shared secret per provider. In production these arrive from
   * the courier's own webhook; the ops console can drive the same transitions by
   * hand when a manual delivery is running.
   */
  app.post('/v1/couriers/:provider/callback', {
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const params = z.object({ provider: z.string().min(1).max(40) }).parse(req.params);
      const body = z
        .object({
          deliveryRef: z.string().min(1),
          event: z.enum(['driver_assigned', 'collected', 'delivered', 'failed', 'cancelled']),
          proofUrl: z.string().url().nullish(),
          actualCostCents: z.number().int().min(0).nullish(),
          reason: z.string().max(300).nullish(),
        })
        .parse(req.body);

      const delivery = (
        await getDb()
          .select()
          .from(deliveries)
          .where(and(eq(deliveries.provider, params.provider), eq(deliveries.providerRef, body.deliveryRef)))
          .limit(1)
      )[0];
      if (!delivery) throw new AppError('not_found', 'error.not_found');

      switch (body.event) {
        case 'driver_assigned':
          await getDb()
            .update(deliveries)
            .set({ status: DeliveryStatus.DRIVER_ASSIGNED, driverAssignedAt: new Date() })
            .where(eq(deliveries.id, delivery.id));
          break;
        case 'collected':
          await markCollected(delivery.id);
          break;
        case 'delivered':
          await markDelivered(delivery.id, body.proofUrl ?? null, body.actualCostCents ?? null);
          break;
        case 'failed':
        case 'cancelled':
          await markDeliveryFailed(delivery.id, body.reason ?? body.event);
          break;
      }

      log.info('courier callback processed', { provider: params.provider, ref: body.deliveryRef, event: body.event });
      return reply.status(204).send();
    },
  });
}
