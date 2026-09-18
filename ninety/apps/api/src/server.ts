import './load-env.js';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { env } from './env.js';
import { newRequestId } from './core/logger.js';
import { registerErrorHandler } from './http/error-handler.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerHealthRoutes } from './http/health.js';
import { registerRequestRoutes } from './requests/routes.js';
import { registerMediaRoutes } from './media/routes.js';
import { registerVehicleRoutes } from './vehicles/routes.js';
import { registerSupplierRoutes } from './routes/supplier.js';
import { registerBuyerOfferRoutes } from './offers/routes.js';
import { registerOrderRoutes } from './payments/routes.js';
import { registerWebhookRoutes } from './payments/webhooks.js';
import { registerDeliveryRoutes } from './logistics/routes.js';
import { registerDisputeRoutes } from './disputes/routes.js';
import { registerAdminRoutes } from './admin/routes.js';
import { registerRealtimeRoutes } from './realtime/routes.js';
import { getRedis } from './core/redis.js';
import { key } from './core/keys.js';
import './http/context.js';
import { startMarketWatcher } from './market/watcher.js';
import { negotiateLocale } from './i18n/negotiate.js';
import { registerProviders } from './bootstrap/providers.js';

/**
 * The API.
 *
 * One process, one database, six domains. Not microservices: six domains, a
 * small team and transactional consistency between requests, offers, orders and
 * payments. Splitting now would buy distributed-systems problems there is no
 * reason to own, and the clock — which is the product — is easier to keep honest
 * inside one transaction boundary.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
    genReqId: () => newRequestId(),
  });

  // Every request carries a context: its id, its actor, and — once authenticated
  // — the caller's market configuration. Application code never reads a rate or
  // an SLA from anywhere else.
  // Declared without a default value: Fastify 5 forbids sharing one object
  // across requests, and every request assigns its own in the onRequest hook.
  app.decorateRequest('ctx');
  app.addHook('onRequest', async (req) => {
    req.ctx = {
      requestId: String(req.id),
      actor: null,
      market: null,
      // Provisional, from the header. A validation failure is emitted before a
      // body is parsed or a caller is authenticated, and it still has to arrive
      // in the reader's language. Authentication replaces this with the user's
      // own locale.
      locale: negotiateLocale(req.headers['accept-language']),
    };
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    global: false,
    redis: getRedis(),
    nameSpace: `${key('rl')}:`,
    keyGenerator: (req) => req.ctx?.actor?.userId ?? req.ip,
  });
  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 4 } });
  await app.register(websocket, { options: { maxPayload: 1 * 1024 * 1024 } });

  await registerProviders();
  await startMarketWatcher();

  registerErrorHandler(app);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerVehicleRoutes(app);
  await registerRequestRoutes(app);
  await registerMediaRoutes(app);
  await registerBuyerOfferRoutes(app);
  await registerOrderRoutes(app);
  await registerWebhookRoutes(app);
  await registerDeliveryRoutes(app);
  await registerDisputeRoutes(app);
  await registerSupplierRoutes(app);
  await registerAdminRoutes(app);
  await registerRealtimeRoutes(app);

  // Structured access log with the request id on every line.
  app.addHook('onResponse', async (req, reply) => {
    const { log } = await import('./core/logger.js');
    log.info('request', {
      requestId: req.ctx?.requestId,
      method: req.method,
      route: req.routeOptions?.url ?? req.url,
      status: reply.statusCode,
      ms: Math.round(reply.elapsedTime),
      role: req.ctx?.actor?.role ?? null,
    });
  });

  return app;
}

export async function start(): Promise<FastifyInstance> {
  const app = await buildServer();
  await app.listen({ port: env().PORT, host: env().HOST });
  return app;
}
