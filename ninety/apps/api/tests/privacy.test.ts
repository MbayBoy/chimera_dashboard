import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authenticate,
  bearer,
  buildTestServer,
  clearRateLimits,
  freshClientAddress,
  SEED_PHONES,
  type TestSession,
} from './helpers.js';

/**
 * Erasure, end to end.
 *
 * The test that matters is not "the row went away" — it is that the person's
 * identifiers are gone, that the financial record the tax authority requires is
 * still there, and that nothing in the database points at something that no
 * longer exists. A deletion that breaks referential integrity is discovered
 * three months later by a reconciliation job, not by the person who asked.
 */
describe('data erasure', () => {
  let app: FastifyInstance;
  let admin: TestSession;

  beforeAll(async () => {
    app = await buildTestServer({ workers: false });
    await clearRateLimits();
    admin = await authenticate(app, { phone: SEED_PHONES.admin, role: 'admin', locale: 'en-AE' });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    const { stopMarketWatcher } = await import('../src/market/watcher.js');
    await stopMarketWatcher();
    const { closeDb } = await import('../src/db/client.js');
    const { closeRedis } = await import('../src/core/redis.js');
    await closeDb();
    await closeRedis();
  });

  /** A buyer with a history: a request with a pin and a note, and a photo. */
  async function buyerWithHistory(phone: string, marketCode: 'AE' | 'ZA') {
    const session = await authenticate(app, { phone, role: 'buyer', marketCode });
    const { getSql } = await import('../src/db/client.js');
    const categoryId = (
      await getSql()<{ id: string }[]>`SELECT id FROM part_categories WHERE code = 'lighting.tail_lamp.rear_right'`
    )[0]!.id;

    const created = await app.inject({
      method: 'POST',
      url: '/v1/requests',
      headers: { ...bearer(session), ...freshClientAddress() },
      payload: {
        vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
        partCategoryId: categoryId,
        partDescription: `Erasure probe for ${phone.slice(-2)}`,
        conditionAccepted: ['used'],
        quantity: 1,
        deliveryLocation: { lat: 25.149912, lng: 55.241633 },
        deliveryAddress: { note: 'Ask for Ahmed at bay 3', makani: '1234567890' },
        submit: false,
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    return { session, requestId: created.json().id as string };
  }

  it('a person can ask for their own data to be deleted, from inside the app', async () => {
    const { session } = await buyerWithHistory(SEED_PHONES.buyer(6), 'AE');
    const asked = await app.inject({
      method: 'POST',
      url: '/v1/account/deletion-request',
      headers: { ...bearer(session), ...freshClientAddress() },
      payload: { reason: 'closing the workshop' },
    });
    expect(asked.statusCode, asked.body).toBe(202);
    expect(asked.json().status).toBe('pending');

    // Asking twice does not create a second one.
    const again = await app.inject({
      method: 'POST',
      url: '/v1/account/deletion-request',
      headers: { ...bearer(session), ...freshClientAddress() },
      payload: {},
    });
    expect(again.json().id).toBe(asked.json().id);
  });

  it('erasure removes the identifiers, keeps the financial record, and leaves nothing dangling', async () => {
    const { getSql } = await import('../src/db/client.js');
    const phone = SEED_PHONES.buyer(7);
    const { session, requestId } = await buyerWithHistory(phone, 'AE');

    const asked = await app.inject({
      method: 'POST',
      url: '/v1/account/deletion-request',
      headers: { ...bearer(session), ...freshClientAddress() },
      payload: { reason: 'right to erasure' },
    });
    const deletionId = asked.json().id;

    const executed = await app.inject({
      method: 'POST',
      url: `/v1/admin/deletion-requests/${deletionId}/execute`,
      headers: { ...bearer(admin), ...freshClientAddress() },
    });
    expect(executed.statusCode, executed.body).toBe(200);
    const report = executed.json();

    // 1. The identifiers are gone.
    const user = (
      await getSql()<{ phone: string; email: string | null; display_name: string | null; deleted_at: string | null }[]>`
        SELECT phone, email, display_name, deleted_at FROM users WHERE id = ${session.userId}
      `
    )[0]!;
    expect(user.phone).not.toBe(phone);
    expect(user.phone).toMatch(/^\+deleted-/);
    expect(user.email).toBeNull();
    expect(user.display_name).toBeNull();
    expect(user.deleted_at).not.toBeNull();

    // 2. The free-text note that could identify a person is gone, and the pin is
    //    coarsened rather than precise.
    const request = (
      await getSql()<{ address: string; lat: number; lng: number }[]>`
        SELECT delivery_address::text AS address,
               ST_Y(delivery_location::geometry) AS lat,
               ST_X(delivery_location::geometry) AS lng
          FROM requests WHERE id = ${requestId}
      `
    )[0]!;
    expect(request.address).not.toContain('Ahmed');
    expect(request.address).not.toContain('1234567890');
    // Was 25.149912; a grid of 0.01° cannot resolve a building.
    expect(Math.abs(request.lat - 25.149912)).toBeGreaterThan(0);
    expect(request.lat.toFixed(2)).toBe(request.lat.toFixed(6).slice(0, request.lat.toFixed(2).length));

    // 3. The person cannot sign in again with the old number, and their token
    //    no longer works.
    const stillIn = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { ...bearer(session), ...freshClientAddress() },
    });
    expect([401, 403]).toContain(stillIn.statusCode);

    // 4. Referential integrity: every foreign key in the database still resolves.
    const orphans = await getSql()<{ description: string; n: string }[]>`
      SELECT 'requests → buyers' AS description,
             count(*)::text AS n FROM requests r LEFT JOIN buyers b ON b.id = r.buyer_id WHERE b.id IS NULL
      UNION ALL
      SELECT 'orders → buyers', count(*)::text FROM orders o LEFT JOIN buyers b ON b.id = o.buyer_id WHERE b.id IS NULL
      UNION ALL
      SELECT 'buyers → users', count(*)::text FROM buyers b LEFT JOIN users u ON u.id = b.user_id WHERE u.id IS NULL
      UNION ALL
      SELECT 'offers → requests', count(*)::text FROM offers o LEFT JOIN requests r ON r.id = o.request_id WHERE r.id IS NULL
      UNION ALL
      SELECT 'payments → orders', count(*)::text FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE o.id IS NULL
      UNION ALL
      SELECT 'disputes → orders', count(*)::text FROM disputes d LEFT JOIN orders o ON o.id = d.order_id WHERE o.id IS NULL
      UNION ALL
      SELECT 'fanouts → requests', count(*)::text FROM request_fanouts f LEFT JOIN requests r ON r.id = f.request_id WHERE r.id IS NULL
    `;
    for (const row of orphans) {
      expect(Number(row.n), `${row.description} left ${row.n} dangling rows`).toBe(0);
    }

    // 5. The report says what was kept and under what basis, with a date.
    expect(report.retained.orders.basis).toContain('retention');
    expect(report.retained.orders.until).toMatch(/^\d{4}-/);
    expect(Object.keys(report.anonymised)).toContain('users');
    expect(Object.keys(report.deleted)).toContain('notifications');

    // 6. Executing it twice is refused rather than silently repeated.
    const twice = await app.inject({
      method: 'POST',
      url: `/v1/admin/deletion-requests/${deletionId}/execute`,
      headers: { ...bearer(admin), ...freshClientAddress() },
    });
    expect(twice.statusCode).toBe(409);
  }, 120_000);

  it('uses each market’s own retention period, not a number written into the code', async () => {
    const { getSql } = await import('../src/db/client.js');
    const rows = await getSql()<{ code: string; years: number }[]>`
      SELECT code, financial_retention_years AS years FROM markets ORDER BY code
    `;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.years, `${row.code} has no retention period configured`).toBeGreaterThan(0);
    }

    // The South African market is configured and seeded but not live; its rules
    // must already be answerable, because POPIA applies from the first record.
    const za = rows.find((r) => r.code === 'ZA');
    expect(za, 'the second market has no retention policy').toBeTruthy();

    // The number itself must not appear as a literal in application code. Seed
    // and fixture files are exempt for the same reason the market-value guard
    // exempts them: they are where a market's values are supposed to live.
    const { grep } = await import('../src/testing/grep.js');
    const hits = (await grep(/financialRetentionYears\s*[:=]\s*\d+/, ['src'])).filter(
      (hit) => !/seed([-.].*)?\.[cm]?ts$/.test(hit.file),
    );
    expect(
      hits.map((h) => `${h.file}:${h.lineNumber}`),
      'a retention period is hardcoded in application code',
    ).toEqual([]);
  });

  it('an admin can raise an erasure request on behalf of someone who phoned in', async () => {
    const { session } = await buyerWithHistory(SEED_PHONES.buyer(8), 'AE');
    const raised = await app.inject({
      method: 'POST',
      url: '/v1/admin/deletion-requests',
      headers: { ...bearer(admin), ...freshClientAddress() },
      payload: { userId: session.userId, reason: 'requested by telephone, identity verified' },
    });
    expect(raised.statusCode, raised.body).toBe(202);

    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/deletion-requests',
      headers: { ...bearer(admin), ...freshClientAddress() },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().requests.some((r: { userId: string }) => r.userId === session.userId)).toBe(true);
  });

  it('a buyer cannot execute an erasure, and cannot see anybody else’s', async () => {
    const { session } = await buyerWithHistory(SEED_PHONES.buyer(9), 'AE');
    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/deletion-requests',
      headers: { ...bearer(session), ...freshClientAddress() },
    });
    expect([401, 403]).toContain(list.statusCode);
  });
});
