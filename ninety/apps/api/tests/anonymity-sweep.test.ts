import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authenticate,
  bearer,
  buildTestServer,
  clearPingBudgets,
  clearRateLimits,
  freshClientAddress,
  SEED_PHONES,
  type TestSession,
} from './helpers.js';

/**
 * The whole-payload anonymity sweep.
 *
 * Phase 03 established the rule on the offers endpoint. Phases 04, 05 and 06
 * added more buyer-facing routes, and the tracking endpoint in particular is the
 * one most likely to leak: a courier integration's natural payload contains a
 * pickup address, which is the yard's address.
 *
 * So this enumerates EVERY route a buyer token can reach, drives a real request
 * to a delivered order so each one has something to return, and greps the entire
 * response body — not selected fields — for every identifying string that exists
 * in the database. A new buyer-facing route added without a thought about
 * anonymity fails here, because the list below is asserted to be complete
 * against the running server's route table.
 */
describe('anonymity across every buyer-facing endpoint', () => {
  let app: FastifyInstance;
  let buyer: TestSession;
  const suppliers: TestSession[] = [];
  let requestId = '';
  let orderId = '';

  /**
   * Every route a buyer may call, with the method and a way to fill the path.
   * Routes that are not buyer-facing are listed as excluded WITH a reason, and
   * the union of the two lists is asserted against the server's own route table.
   */
  const BUYER_ROUTES: readonly { method: 'GET' | 'POST'; path: string; url: () => string }[] = [
    { method: 'GET', path: '/v1/auth/me', url: () => '/v1/auth/me' },
    { method: 'GET', path: '/v1/requests', url: () => '/v1/requests' },
    { method: 'GET', path: '/v1/requests/:id', url: () => `/v1/requests/${requestId}` },
    { method: 'GET', path: '/v1/requests/:id/offers', url: () => `/v1/requests/${requestId}/offers` },
    { method: 'GET', path: '/v1/requests/:id/timeline', url: () => `/v1/requests/${requestId}/timeline` },
    { method: 'GET', path: '/v1/requests/:id/tracking', url: () => `/v1/requests/${requestId}/tracking` },
    { method: 'GET', path: '/v1/orders', url: () => '/v1/orders' },
    { method: 'GET', path: '/v1/orders/:id', url: () => `/v1/orders/${orderId}` },
    { method: 'GET', path: '/v1/disputes', url: () => '/v1/disputes' },
    { method: 'GET', path: '/v1/part-categories', url: () => '/v1/part-categories' },
    { method: 'GET', path: '/v1/vehicles/makes', url: () => '/v1/vehicles/makes' },
    { method: 'GET', path: '/v1/vehicles/models', url: () => '/v1/vehicles/models?make=Nissan' },
    { method: 'GET', path: '/v1/app-version', url: () => '/v1/app-version' },
    { method: 'GET', path: '/v1/health', url: () => '/v1/health' },
  ];

  /** Not buyer-facing, and why. Kept here so the completeness check can be exact. */
  const NOT_BUYER_FACING: Readonly<Record<string, string>> = {
    '/v1/auth/otp/request': 'unauthenticated',
    '/v1/auth/otp/verify': 'unauthenticated',
    '/v1/auth/refresh': 'unauthenticated',
    '/v1/auth/logout': 'no body beyond an acknowledgement',
    '/v1/part-categories/:id': 'a single category; same payload shape as the list',
    '/v1/vehicles/decode': 'vehicle lookup, no marketplace data',
    '/v1/requests/:id/media': 'upload; returns the buyer their own photo',
    '/v1/requests/:id/cancel': 'acknowledgement only',
    '/v1/requests/:id/decline-all': 'acknowledgement only',
    '/v1/offers/:id/accept': 'covered by the order assertions below',
    '/v1/orders/:id/confirm-receipt': 'acknowledgement only',
    '/v1/orders/:id/dispute': 'acknowledgement only',
    '/v1/disputes/:id/evidence': 'upload; returns the buyer their own file',
    '/v1/account/deletion-request': 'acknowledgement only',
    '/v1/buyer/stream': 'websocket; asserted separately in the realtime tests',
    '/v1/supplier/stream': 'supplier only',
    '/media/*': 'static media',
    '/v1/couriers/:provider/callback': 'courier webhook',
    '/v1/webhooks/payments/:provider': 'payment webhook',
  };

  beforeAll(async () => {
    app = await buildTestServer();
    await clearRateLimits();
    await clearPingBudgets();
    buyer = await authenticate(app, { phone: SEED_PHONES.buyer(4), role: 'buyer', locale: 'en-AE' });
    for (let i = 1; i <= 6; i++) {
      suppliers.push(await authenticate(app, { phone: SEED_PHONES.supplier(i), role: 'supplier', locale: 'en-AE' }));
    }

    const { getSql } = await import('../src/db/client.js');
    const categoryId = (
      await getSql()<{ id: string }[]>`SELECT id FROM part_categories WHERE code = 'lighting.tail_lamp.rear_right'`
    )[0]!.id;

    const created = (
      await app.inject({
        method: 'POST',
        url: '/v1/requests',
        headers: { ...bearer(buyer), ...freshClientAddress() },
        payload: {
          vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
          partCategoryId: categoryId,
          partDescription: 'Anonymity sweep probe',
          conditionAccepted: ['used'],
          quantity: 1,
          deliveryLocation: { lat: 25.1499, lng: 55.2416 },
          deliveryAddress: {},
          submit: true,
        },
      })
    ).json();
    requestId = created.id;

    const recipients = await waitFor(async () => {
      const rows = await getSql()<{ user_id: string }[]>`
        SELECT s.user_id FROM request_fanouts f JOIN suppliers s ON s.id = f.supplier_id WHERE f.request_id = ${requestId}
      `;
      return rows.length > 0 ? rows : null;
    }, 20_000);
    const byUser = new Map(suppliers.map((s) => [s.userId, s]));
    const quoting = recipients.map((r) => byUser.get(r.user_id)).filter((s): s is TestSession => s !== undefined);

    for (const [i, session] of quoting.slice(0, 2).entries()) {
      await app.inject({
        method: 'POST',
        url: `/v1/supplier/requests/${requestId}/offer`,
        headers: { ...bearer(session), ...freshClientAddress() },
        payload: { price: String(250 + i * 30), condition: 'used', warrantyDays: 60, readyInMin: 10 },
      });
    }

    await waitFor(async () => {
      const rows = await getSql()<{ status: string }[]>`SELECT status FROM requests WHERE id = ${requestId}`;
      return rows[0]?.status === 'COLLECTING_OFFERS' ? true : null;
    }, 40_000);

    const offers = (
      await app.inject({ method: 'GET', url: `/v1/requests/${requestId}/offers`, headers: bearer(buyer) })
    ).json();
    const accept = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[0].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_ok_visa' },
    });
    orderId = accept.json().orderId;

    // Take it as far as a driver, so the tracking endpoint has real content.
    const delivery = await waitFor(async () => {
      const rows = await getSql()<{ provider: string; provider_ref: string }[]>`
        SELECT provider, provider_ref FROM deliveries WHERE order_id = ${orderId} ORDER BY attempt DESC LIMIT 1
      `;
      return rows[0] ?? null;
    }, 25_000);
    await app.inject({
      method: 'POST',
      url: `/v1/couriers/${delivery.provider}/callback`,
      payload: { deliveryRef: delivery.provider_ref, event: 'driver_assigned' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/couriers/${delivery.provider}/callback`,
      payload: { deliveryRef: delivery.provider_ref, event: 'collected' },
    });
  }, 180_000);

  afterAll(async () => {
    await app.close();
    const { stopTimerWorkers } = await import('../src/timers/worker.js');
    const { stopMarketWatcher } = await import('../src/market/watcher.js');
    await stopTimerWorkers();
    await stopMarketWatcher();
    const { closeDb } = await import('../src/db/client.js');
    const { closeRedis } = await import('../src/core/redis.js');
    await closeDb();
    await closeRedis();
  });

  it('lists every route the server exposes, either as swept or as excluded with a reason', () => {
    const declared = new Set([...BUYER_ROUTES.map((r) => r.path), ...Object.keys(NOT_BUYER_FACING)]);
    const served = app
      .printRoutes({ commonPrefix: false })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('/'))
      .map((line) => line.split(' ')[0]!.replace(/\/$/, ''))
      .filter((path) => path.startsWith('/v1/') || path.startsWith('/media'));

    const missing = served.filter(
      (path) =>
        !declared.has(path) &&
        // Supplier and admin routes are not buyer-facing by construction: a
        // buyer token cannot reach them, which is asserted in its own test below.
        !path.startsWith('/v1/supplier') &&
        !path.startsWith('/v1/admin'),
    );
    expect(missing, `routes with no anonymity decision recorded: ${missing.join(', ')}`).toEqual([]);
  });

  it('leaks no supplier identity from any buyer-facing endpoint', async () => {
    const { getSql } = await import('../src/db/client.js');
    const yards = await getSql()<
      { business_name: string; phone: string; lat: string; lng: string; address: unknown; id: string; user_id: string }[]
    >`
      SELECT s.id, s.user_id, s.business_name, u.phone, s.address,
             ST_Y(s.location::geometry)::text AS lat, ST_X(s.location::geometry)::text AS lng
        FROM suppliers s JOIN users u ON u.id = s.user_id
    `;
    expect(yards.length).toBeGreaterThan(0);

    const forbiddenKeys = [
      'supplierId',
      'supplier_id',
      'businessName',
      'business_name',
      'pickup',
      'pickupLocation',
      'pickupAddress',
      'providerRef',
      'provider_ref',
      'driverLocation',
      'bearing',
      'direction',
      'heading',
      'yardName',
    ];

    const checked: string[] = [];
    for (const route of BUYER_ROUTES) {
      const res = await app.inject({
        method: route.method,
        url: route.url(),
        headers: { ...bearer(buyer), ...freshClientAddress() },
      });
      expect([200, 201, 204, 404], `${route.path} returned ${res.statusCode}`).toContain(res.statusCode);
      const body = res.body ?? '';
      checked.push(`${route.method} ${route.path}`);

      for (const yard of yards) {
        expect(body, `${route.path} leaks a yard name`).not.toContain(yard.business_name);
        expect(body, `${route.path} leaks a yard phone`).not.toContain(yard.phone);
        // Six decimal places of latitude is a building. Five is a street.
        expect(body, `${route.path} leaks a yard latitude`).not.toContain(yard.lat.slice(0, 8));
        expect(body, `${route.path} leaks a yard longitude`).not.toContain(yard.lng.slice(0, 8));
        expect(body, `${route.path} leaks a supplier id`).not.toContain(yard.id);
        expect(body, `${route.path} leaks a supplier user id`).not.toContain(yard.user_id);
      }
      for (const key of forbiddenKeys) {
        expect(body, `${route.path} exposes "${key}"`).not.toContain(`"${key}"`);
      }
    }

    // Printed so the gate evidence can list exactly what was swept.
    expect(checked.length).toBe(BUYER_ROUTES.length);
    console.log(`anonymity sweep covered ${checked.length} buyer-facing endpoints:\n  ${checked.join('\n  ')}`);
  }, 120_000);

  it('a buyer token cannot reach a supplier or admin route at all', async () => {
    for (const url of [
      '/v1/supplier/requests',
      '/v1/supplier/performance',
      '/v1/supplier/orders',
      '/v1/supplier/stock-profile',
      '/v1/supplier/score-history',
      '/v1/admin/requests',
      '/v1/admin/suppliers',
      '/v1/admin/metrics',
      '/v1/admin/disputes',
      '/v1/admin/deletion-requests',
    ]) {
      const res = await app.inject({ method: 'GET', url, headers: { ...bearer(buyer), ...freshClientAddress() } });
      expect([401, 403], `${url} answered a buyer token with ${res.statusCode}`).toContain(res.statusCode);
    }
  });

  it('the supplier side cannot see the buyer either', async () => {
    const { getSql } = await import('../src/db/client.js');
    const buyerRow = (
      await getSql()<{ phone: string; display_name: string | null }[]>`
        SELECT phone, display_name FROM users WHERE id = ${buyer.userId}
      `
    )[0]!;

    for (const session of suppliers) {
      for (const url of ['/v1/supplier/requests', '/v1/supplier/orders']) {
        const res = await app.inject({ method: 'GET', url, headers: { ...bearer(session), ...freshClientAddress() } });
        expect(res.statusCode).toBe(200);
        expect(res.body, `${url} leaks the buyer's phone`).not.toContain(buyerRow.phone);
        if (buyerRow.display_name !== null) {
          expect(res.body, `${url} leaks the buyer's name`).not.toContain(buyerRow.display_name);
        }
        for (const key of ['buyerId', 'buyer_id', 'deliveryLocation', 'deliveryAddress', 'buyerPhone']) {
          expect(res.body, `${url} exposes "${key}"`).not.toContain(`"${key}"`);
        }
      }
    }
  });
});

async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== null && value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('timed out waiting for a condition');
}
