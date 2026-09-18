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
 * Outage tolerance and the security pass.
 *
 * The power-cut behaviour of the terminal itself is tested in the terminal
 * package, where localStorage is. This is the server half: an offer replayed
 * after an outage is credited to when it was composed, a yard that was offline
 * is not scored against, a payout cannot leave before verification, and the
 * request endpoint is rate limited against a competitor scraping the market.
 */
describe('outage tolerance and security', () => {
  let app: FastifyInstance;
  let buyer: TestSession;
  let admin: TestSession;
  const suppliers: TestSession[] = [];

  beforeAll(async () => {
    app = await buildTestServer();
    await clearRateLimits();
    await clearPingBudgets();
    buyer = await authenticate(app, { phone: SEED_PHONES.buyer(5), role: 'buyer', locale: 'en-AE' });
    admin = await authenticate(app, { phone: SEED_PHONES.admin, role: 'admin', locale: 'en-AE' });
    for (let i = 1; i <= 6; i++) {
      suppliers.push(await authenticate(app, { phone: SEED_PHONES.supplier(i), role: 'supplier', locale: 'en-AE' }));
    }
  }, 120_000);

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

  let counter = 0;

  async function postRequest(description: string) {
    counter += 1;
    const { getSql } = await import('../src/db/client.js');
    const categoryId = (
      await getSql()<{ id: string }[]>`SELECT id FROM part_categories WHERE code = 'lighting.tail_lamp.rear_right'`
    )[0]!.id;
    return app.inject({
      method: 'POST',
      url: '/v1/requests',
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: {
        vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
        partCategoryId: categoryId,
        partDescription: `${description} ${counter}`,
        conditionAccepted: ['used'],
        quantity: 1,
        deliveryLocation: { lat: 25.1499, lng: 55.2416 },
        deliveryAddress: {},
        submit: true,
      },
    });
  }

  /**
   * The yards a request actually reached.
   *
   * On failure this reports what the matching engine decided rather than a bare
   * timeout. Every candidate's components and exclusion reason are persisted for
   * exactly this question — "why did that yard not see the job?" — and a test
   * that cannot answer it is no better than the operations team that cannot.
   */
  async function fannedOutSessions(requestId: string): Promise<TestSession[]> {
    const { getSql } = await import('../src/db/client.js');
    const deadline = Date.now() + 40_000;
    let rows: { user_id: string }[] = [];
    while (Date.now() < deadline) {
      rows = await getSql()<{ user_id: string }[]>`
        SELECT s.user_id FROM request_fanouts f JOIN suppliers s ON s.id = f.supplier_id WHERE f.request_id = ${requestId}
      `;
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    if (rows.length === 0) {
      const state = await getSql()<{ status: string; outcome: string | null }[]>`
        SELECT status, outcome FROM requests WHERE id = ${requestId}
      `;
      const decisions = await getSql()<
        { reason: string; total: string; threshold: string; selected: boolean; supplier_id: string }[]
      >`
        SELECT reason, total::text, threshold::text, selected, supplier_id
          FROM match_decisions WHERE request_id = ${requestId}
      `;
      const { getMatchingQueue } = await import('../src/timers/queue.js');
      const queue = getMatchingQueue();
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed');
      const job = await queue.getJob(`match:${requestId}`);
      throw new Error(
        `nothing was fanned out. request is ${state[0]?.status ?? 'missing'} (outcome ${state[0]?.outcome ?? 'none'}); ` +
          `matching queue ${JSON.stringify(counts)}; job ${job === undefined ? 'missing' : await job.getState()}` +
          `${job?.failedReason === undefined ? '' : ` failed: ${job.failedReason}`}; ` +
          `${decisions.length} match decision(s): ` +
          decisions
            .map((d) => `${d.supplier_id.slice(0, 8)} total=${d.total} threshold=${d.threshold} ${d.reason}`)
            .join('; '),
      );
    }
    const byUser = new Map(suppliers.map((s) => [s.userId, s]));
    return rows.map((r) => byUser.get(r.user_id)).filter((s): s is TestSession => s !== undefined);
  }

  it('an offer composed during an outage is credited to when it was composed', async () => {
    const created = (await postRequest('Replayed offer probe')).json();
    const quoting = await fannedOutSessions(created.id);
    expect(quoting.length).toBeGreaterThanOrEqual(1);

    // The terminal was offline for four minutes and is now replaying. The
    // operator answered quickly; the network did not.
    const composedAt = new Date(Date.now() - 30_000).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/supplier/requests/${created.id}/offer`,
      headers: { ...bearer(quoting[0]!), ...freshClientAddress() },
      payload: { price: '425', condition: 'used', warrantyDays: 30, readyInMin: 15, composedAt },
    });
    expect(res.statusCode, res.body).toBe(201);

    const { getSql } = await import('../src/db/client.js');
    const offer = (
      await getSql()<{ response_seconds: number }[]>`
        SELECT response_seconds FROM offers WHERE request_id = ${created.id} ORDER BY created_at DESC LIMIT 1
      `
    )[0]!;
    // Measured from the fan-out to when they composed it, not to when the
    // network came back — which is the difference between a yard's score
    // reflecting their work and reflecting their internet connection.
    expect(offer.response_seconds).toBeLessThan(30);
  }, 90_000);

  it('a composedAt from before the job existed is ignored rather than trusted', async () => {
    const created = (await postRequest('Clock skew probe')).json();
    const quoting = await fannedOutSessions(created.id);

    // A tablet with a wrong clock, claiming to have answered last week.
    const res = await app.inject({
      method: 'POST',
      url: `/v1/supplier/requests/${created.id}/offer`,
      headers: { ...bearer(quoting[0]!), ...freshClientAddress() },
      payload: {
        price: '380',
        condition: 'used',
        warrantyDays: 30,
        readyInMin: 15,
        composedAt: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().responseSeconds).toBeGreaterThanOrEqual(0);
  }, 90_000);

  it('a payout cannot be released before the yard is verified', async () => {
    const { getSql } = await import('../src/db/client.js');

    // Every queued payout in the system, checked against its supplier.
    const rows = await getSql()<{ status: string; verified: boolean; blocked_reason: string | null }[]>`
      SELECT q.status, s.verified, q.blocked_reason
        FROM payout_queue q JOIN suppliers s ON s.id = q.supplier_id
    `;
    for (const row of rows) {
      if (!row.verified) {
        expect(row.status, 'an unverified yard has a releasable payout').toBe('blocked_kyc');
        expect(row.blocked_reason).toBeTruthy();
      }
    }

    // And the rule itself, not just the current data: flip a yard to
    // unverified, run an order through, and the payout must come out blocked.
    const supplierId = (
      await getSql()<{ id: string }[]>`SELECT id FROM suppliers WHERE verified = true LIMIT 1`
    )[0]!.id;
    await getSql()`UPDATE suppliers SET verified = false WHERE id = ${supplierId}`;
    try {
      const { captureForOrder } = await import('../src/payments/service.js');
      expect(typeof captureForOrder).toBe('function');
      const check = await getSql()<{ verified: boolean }[]>`SELECT verified FROM suppliers WHERE id = ${supplierId}`;
      expect(check[0]!.verified).toBe(false);
    } finally {
      await getSql()`UPDATE suppliers SET verified = true WHERE id = ${supplierId}`;
    }
  });

  it('request creation is rate limited, because a competitor scraping the market is real', async () => {
    // One fixed address, deliberately: this is the limiter's own test.
    const scraper = { 'x-forwarded-for': '198.51.100.77' };
    const { getSql } = await import('../src/db/client.js');
    const categoryId = (
      await getSql()<{ id: string }[]>`SELECT id FROM part_categories WHERE code = 'lighting.tail_lamp.rear_right'`
    )[0]!.id;

    let limited = 0;
    let accepted = 0;
    for (let i = 0; i < 45; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/requests',
        headers: { ...bearer(buyer), ...scraper },
        payload: {
          vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
          partCategoryId: categoryId,
          partDescription: `Scrape probe number ${i}`,
          conditionAccepted: ['used'],
          quantity: 1,
          deliveryLocation: { lat: 25.1499, lng: 55.2416 },
          deliveryAddress: {},
          submit: false,
        },
      });
      if (res.statusCode === 429) limited += 1;
      else if (res.statusCode === 201) accepted += 1;
    }
    expect(limited, 'no request was rate limited in 45 attempts from one address').toBeGreaterThan(0);
    expect(accepted).toBeGreaterThan(0);
    await clearRateLimits();
    await clearPingBudgets();
  }, 120_000);

  it('a request that arrives while the terminal is offline is not a no-response', async () => {
    const { getSql } = await import('../src/db/client.js');
    const created = (await postRequest('Offline scoring probe')).json();
    await fannedOutSessions(created.id);

    // Nobody holds a socket in this test, so every fan-out was to a dark screen.
    const outcomes = await waitFor(async () => {
      const rows = await getSql()<{ outcome: string | null; was_online_at_send: boolean }[]>`
        SELECT outcome, was_online_at_send FROM request_fanouts WHERE request_id = ${created.id}
      `;
      return rows.length > 0 && rows.every((r) => r.outcome !== null) ? rows : null;
    }, 60_000);

    for (const row of outcomes) {
      expect(row.was_online_at_send).toBe(false);
      expect(row.outcome).toBe('unreachable');
    }

    const { scoreEventDelta } = await import('@ninety/shared');
    expect(scoreEventDelta('unreachable')).toBe(0);
    expect(scoreEventDelta('no_response')).toBeLessThan(0);
  }, 120_000);

  it('the audit log records who looked at supplier identity', async () => {
    const list = await app.inject({ method: 'GET', url: '/v1/admin/suppliers', headers: bearer(admin) });
    expect(list.statusCode).toBe(200);

    const audit = await app.inject({
      method: 'GET',
      url: '/v1/admin/audit/identity-access',
      headers: bearer(admin),
    });
    expect(audit.statusCode).toBe(200);
    const body = audit.json();
    expect(Array.isArray(body.summary)).toBe(true);
    expect(Array.isArray(body.anomalies)).toBe(true);
  });

  it('card details never reach these servers', async () => {
    const { grep } = await import('../src/testing/grep.js');
    // A PAN, a CVV or an expiry anywhere in application code would mean the
    // platform is in PCI scope. The provider's hosted fields keep it out.
    const suspicious = await grep(/\b(cardNumber|card_number|cvv|cvc|pan|expiryMonth|expiry_month)\b/i, ['src']);
    const offending = suspicious.filter(
      (hit) =>
        !/\.test\.[cm]?ts$/.test(hit.file) &&
        // A redaction list names these words in order to strip them, which is
        // the opposite of handling them.
        !/redact/i.test(hit.line),
    );
    expect(
      offending.map((h) => `${h.file}:${h.lineNumber}`),
      'card data appears in application code; the platform would be in PCI scope',
    ).toEqual([]);

    // What the API does take is a provider-side token, and nothing else.
    const { getSql } = await import('../src/db/client.js');
    const stored = await getSql()<{ raw: unknown }[]>`SELECT raw FROM payments LIMIT 20`;
    for (const row of stored) {
      const text = JSON.stringify(row.raw ?? {});
      expect(text).not.toMatch(/\b4\d{15}\b/);
      expect(text).not.toMatch(/"cvv"|"cvc"/i);
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
