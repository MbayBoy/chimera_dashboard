import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, payments, webhookEvents } from '../db/schema.js';
import { getPaymentProvider, knownPaymentProviders } from './provider.js';
import { log } from '../core/logger.js';
import { AppError } from '../core/errors.js';

/**
 * Payment webhooks.
 *
 * Two properties matter, and both are tested:
 *
 *  1. Signature verification. An unsigned or badly signed payload is rejected
 *     outright — a webhook endpoint that trusts its body is a way to mark any
 *     order paid.
 *  2. Idempotency. Providers replay deliveries routinely, so a replay is a
 *     no-op rather than a double capture or a duplicate row. The provider's own
 *     event id is the key, held under a unique constraint.
 *
 * The raw payload is persisted whatever happens, for reconciliation.
 */
export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  // The signature is computed over the exact bytes, so this route needs the raw
  // body rather than the parsed object.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      if (req.url.startsWith('/v1/webhooks/')) {
        (req as unknown as { rawBody: Buffer }).rawBody = body;
        try {
          done(null, body.length === 0 ? {} : JSON.parse(body.toString('utf8')));
        } catch (err) {
          done(err as Error, undefined);
        }
        return;
      }
      try {
        done(null, body.length === 0 ? {} : JSON.parse(body.toString('utf8')));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post('/v1/webhooks/payments/:provider', {
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const providerName = (req.params as { provider: string }).provider;
      if (!knownPaymentProviders().includes(providerName)) throw new AppError('not_found', 'error.not_found');

      const provider = getPaymentProvider(providerName);
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      const signature =
        (req.headers['stripe-signature'] as string | undefined) ?? (req.headers['x-signature'] as string | undefined);

      let event: { id: string; type: string; data: unknown };
      try {
        event = await provider.verifyWebhook(rawBody, signature);
      } catch (err) {
        log.warn('rejected an unsigned or badly signed webhook', {
          provider: providerName,
          err: err instanceof Error ? err.message : String(err),
        });
        // 400 rather than 401: providers retry a 5xx forever and a 401 looks
        // like a credential problem the provider should page someone about.
        return reply.status(400).send({ error: { code: 'validation_failed', messageKey: 'error.validation_failed' } });
      }

      // The unique constraint IS the idempotency. A replayed delivery inserts
      // nothing and processes nothing.
      const inserted = await getDb()
        .insert(webhookEvents)
        .values({
          provider: providerName,
          eventId: event.id,
          eventType: event.type,
          payload: event.data as never,
        })
        .onConflictDoNothing()
        .returning({ id: webhookEvents.id });

      if (inserted.length === 0) {
        log.info('webhook replay ignored', { provider: providerName, eventId: event.id, type: event.type });
        return reply.status(200).send({ received: true, duplicate: true });
      }

      try {
        await handleEvent(providerName, event);
        await getDb()
          .update(webhookEvents)
          .set({ processedAt: new Date(), result: 'processed' })
          .where(eq(webhookEvents.id, inserted[0]!.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await getDb()
          .update(webhookEvents)
          .set({ processedAt: new Date(), result: `failed: ${message}` })
          .where(eq(webhookEvents.id, inserted[0]!.id));
        log.error('webhook processing failed', { provider: providerName, eventId: event.id, err: message });
      }

      return reply.status(200).send({ received: true, duplicate: false });
    },
  });
}

async function handleEvent(providerName: string, event: { id: string; type: string; data: unknown }): Promise<void> {
  const data = event.data as { id?: string; metadata?: { orderId?: string }; amount?: number; status?: string };
  const orderId = data.metadata?.orderId;
  if (orderId === undefined) {
    log.debug('webhook carried no order reference; recorded only', { type: event.type });
    return;
  }
  const order = (await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) return;

  // Webhooks are a reconciliation channel, not a control channel: the state
  // machine is driven by delivery confirmation, not by a provider's opinion of
  // it. What lands here is recorded so the two can be compared.
  await getDb()
    .insert(payments)
    .values({
      orderId,
      provider: providerName,
      providerRef: data.id ?? event.id,
      intent: intentFor(event.type),
      amountCents: data.amount ?? order.totalCents,
      status: data.status ?? event.type,
      raw: event.data as never,
    })
    .onConflictDoNothing();
}

function intentFor(eventType: string): 'authorisation' | 'capture' | 'void' | 'refund' | 'payout' {
  if (eventType.includes('refund')) return 'refund';
  if (eventType.includes('canceled') || eventType.includes('cancelled')) return 'void';
  if (eventType.includes('succeeded') || eventType.includes('captured')) return 'capture';
  if (eventType.includes('payout') || eventType.includes('transfer')) return 'payout';
  return 'authorisation';
}
