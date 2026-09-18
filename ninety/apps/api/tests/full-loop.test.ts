import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authenticate, bearer, buildTestServer, clearRateLimits, freshClientAddress, SEED_PHONES, type TestSession } from './helpers.js';

/**
 * The loop, end to end.
 *
 * A buyer posts a request, it fans out, yards quote, the buyer sees anonymised
 * offers, accepts one, the card is authorised, a courier is dispatched, the part
 * is delivered, the buyer confirms and the money is captured.
 *
 * This is the test that says the product works. Everything else tests a part.
 */
describe('the whole loop', () => {
  let app: FastifyInstance;
  let buyer: TestSession;
  let admin: TestSession;
  const suppliers: TestSession[] = [];

  beforeAll(async () => {
    app = await buildTestServer();
    await clearRateLimits();
    buyer = await authenticate(app, { phone: SEED_PHONES.buyer(1), role: 'buyer', locale: 'en-AE' });
    admin = await authenticate(app, { phone: SEED_PHONES.admin, role: 'admin', locale: 'en-AE' });
    for (let i = 1; i <= 6; i++) {
      suppliers.push(await authenticate(app, { phone: SEED_PHONES.supplier(i), role: 'supplier', locale: 'en-AE' }));
    }
  }, 120_000);

  afterAll(async () => {
    await app.close();
    const { closeDb } = await import('../src/db/client.js');
    const { closeRedis } = await import('../src/core/redis.js');
    const { stopMarketWatcher } = await import('../src/market/watcher.js');
    const { stopTimerWorkers } = await import('../src/timers/worker.js');
    await stopTimerWorkers();
    await stopMarketWatcher();
    await closeDb();
    await closeRedis();
  });

  async function categoryId(code: string): Promise<string> {
    const { getSql } = await import('../src/db/client.js');
    const rows = await getSql()<{ id: string }[]>`SELECT id FROM part_categories WHERE code = ${code}`;
    return rows[0]!.id;
  }

  // Each test posts a genuinely different job. Without this they collide with
  // the duplicate detection, which is correct behaviour being tripped by an
  // unrealistic test — a workshop does not post the identical request five times.
  let jobCounter = 0;

  async function postRequest(overrides: Record<string, unknown> = {}) {
    jobCounter += 1;
    return app.inject({
      method: 'POST',
      url: '/v1/requests',
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: {
        vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
        partCategoryId: await categoryId('lighting.tail_lamp.rear_right'),
        partDescription: `Rear right tail lamp, lens cracked (job ${jobCounter})`,
        conditionAccepted: ['used', 'refurbished'],
        quantity: 1,
        // A map pin in Al Quoz, Dubai. Never a typed address.
        deliveryLocation: { lat: 25.1499, lng: 55.2416 },
        deliveryAddress: { note: 'Workshop bay 3' },
        submit: true,
        ...overrides,
      },
    });
  }

  /** Wait for a request to reach one of the given states. */
  async function waitForStatus(requestId: string, states: readonly string[], timeoutMs = 30_000): Promise<string> {
    const { getSql } = await import('../src/db/client.js');
    const deadline = Date.now() + timeoutMs;
    let last = '';
    while (Date.now() < deadline) {
      const rows = await getSql()<{ status: string }[]>`SELECT status FROM requests WHERE id = ${requestId}`;
      last = rows[0]?.status ?? '';
      if (states.includes(last)) return last;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`request stayed in ${last}, never reached ${states.join(' or ')}`);
  }

  /** Wait for the matching worker to move a request out of MATCHING. */
  async function waitForFanout(requestId: string, timeoutMs = 20_000): Promise<number> {
    const { getSql } = await import('../src/db/client.js');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const rows = await getSql()<{ status: string; n: string }[]>`
        SELECT r.status, (SELECT count(*) FROM request_fanouts WHERE request_id = r.id)::text AS n
          FROM requests r WHERE r.id = ${requestId}
      `;
      if (rows[0] && rows[0].status !== 'MATCHING') return Number(rows[0].n);
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('request never left MATCHING');
  }

  it('creates a request with correct PostGIS geography and a human reference', async () => {
    const res = await postRequest();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.reference).toMatch(/^REQ-[0-9A-Z]{6}$/);

    const { getSql } = await import('../src/db/client.js');
    const rows = await getSql()<{ lat: number; lng: number; srid: number; type: string }[]>`
      SELECT ST_Y(delivery_location::geometry) AS lat,
             ST_X(delivery_location::geometry) AS lng,
             ST_SRID(delivery_location::geometry) AS srid,
             GeometryType(delivery_location::geometry) AS type
        FROM requests WHERE id = ${body.id}
    `;
    expect(rows[0]!.srid).toBe(4326);
    expect(rows[0]!.type).toBe('POINT');
    expect(rows[0]!.lat).toBeCloseTo(25.1499, 4);
    expect(rows[0]!.lng).toBeCloseTo(55.2416, 4);
  });

  it('fans out to multiple relevant yards and records why each was chosen', async () => {
    const created = (await postRequest()).json();
    const fanouts = await waitForFanout(created.id);
    // Breadth, not a cap. Fan-out size is what produces offers inside 15 minutes.
    expect(fanouts).toBeGreaterThanOrEqual(2);

    const decisions = await app.inject({
      method: 'GET',
      url: `/v1/admin/requests/${created.id}/match-decisions`,
      headers: bearer(admin),
    });
    expect(decisions.statusCode).toBe(200);
    const body = decisions.json();
    expect(body.decisions.length).toBeGreaterThan(0);
    for (const d of body.decisions) {
      // Every component, for every candidate, selected or not.
      expect(d.components).toHaveProperty('stockProfileMatch');
      expect(d.components).toHaveProperty('proximity');
      expect(d.components).toHaveProperty('supplierScore');
      expect(d.components).toHaveProperty('availability');
      expect(d.reason).toMatch(/selected|excluded/);
    }
    // And the exclusions are recorded too — those are the rows someone needs
    // when a yard asks why they did not see a job.
    expect(body.decisions.some((d: { selected: boolean }) => d.selected)).toBe(true);
  });

  it('sends the supplier terminal a countdown as an absolute timestamp, never a duration', async () => {
    const created = (await postRequest()).json();
    await waitForFanout(created.id);

    for (const supplier of suppliers) {
      const res = await app.inject({ method: 'GET', url: '/v1/supplier/requests', headers: bearer(supplier) });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.serverTime).toMatch(/Z$/);
      const job = body.requests.find((r: { requestId: string }) => r.requestId === created.id);
      if (job === undefined) continue;
      // Absolute UTC. A tablet with a wrong clock must not be able to argue
      // about the fifteen minutes.
      expect(job.responseDeadline).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(JSON.stringify(job)).not.toMatch(/secondsRemaining|minutesRemaining|"remaining"/);
      // And nothing identifying the buyer.
      const payload = JSON.stringify(job);
      expect(payload).not.toContain('Al Quoz Auto Body Works');
      expect(payload).not.toContain('Workshop bay 3');
      expect(payload).not.toContain(SEED_PHONES.buyer(1));
      return;
    }
    throw new Error('no supplier received the fan-out');
  });

  it('runs the full loop: quote, anonymised offers, accept, dispatch, deliver, capture', async () => {
    const created = (await postRequest()).json();
    await waitForFanout(created.id);

    // Which yards actually received it.
    const { getSql } = await import('../src/db/client.js');
    const recipients = await getSql()<{ supplier_id: string; user_id: string }[]>`
      SELECT f.supplier_id, s.user_id FROM request_fanouts f JOIN suppliers s ON s.id = f.supplier_id
       WHERE f.request_id = ${created.id}
    `;
    expect(recipients.length).toBeGreaterThanOrEqual(2);

    const sessionsByUser = new Map(suppliers.map((s) => [s.userId, s]));
    const quoting = recipients.map((r) => sessionsByUser.get(r.user_id)).filter((s): s is TestSession => s !== undefined);
    expect(quoting.length).toBeGreaterThanOrEqual(2);

    const prices = [42_000, 33_500, 61_000];
    for (const [i, supplier] of quoting.slice(0, 3).entries()) {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/supplier/requests/${created.id}/offer`,
        headers: { ...bearer(supplier), ...freshClientAddress() },
        payload: {
          price: String(prices[i]! / 100),
          condition: i === 2 ? 'refurbished' : 'used',
          warrantyDays: [90, 30, 180][i],
          readyInMin: [10, 25, 5][i],
          notes: 'Tested working, minor scratch on the lens',
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      // The yard is told what it will actually be paid, not a percentage.
      expect(res.json().estimatedPayoutCents).toBeLessThan(prices[i]!);
    }

    // The response window closes and the request moves to selection. The state
    // machine permits acceptance only from COLLECTING_OFFERS, as specified.
    await waitForStatus(created.id, ['COLLECTING_OFFERS']);

    // The buyer's view, default price-ascending.
    const offersRes = await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/offers`, headers: bearer(buyer) });
    expect(offersRes.statusCode).toBe(200);
    const offersBody = offersRes.json();
    expect(offersBody.offers.length).toBeGreaterThanOrEqual(2);
    const priceOrder = offersBody.offers.map((o: { priceCents: number }) => o.priceCents);
    expect([...priceOrder].sort((a: number, b: number) => a - b)).toEqual(priceOrder);

    // The leak test, against the whole payload.
    const yardRows = await getSql()<{ business_name: string; phone: string; lat: number; lng: number }[]>`
      SELECT s.business_name, u.phone, ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng
        FROM suppliers s JOIN users u ON u.id = s.user_id
       WHERE s.id = ANY(${recipients.map((r) => r.supplier_id)})
    `;
    const payload = offersRes.body;
    for (const yard of yardRows) {
      expect(payload, 'buyer payload contains a yard name').not.toContain(yard.business_name);
      expect(payload, 'buyer payload contains a yard phone').not.toContain(yard.phone);
      expect(payload, 'buyer payload contains a yard latitude').not.toContain(String(yard.lat).slice(0, 7));
    }
    for (const key of ['supplierId', 'supplier_id', 'businessName', 'bearing', 'direction']) {
      expect(payload).not.toContain(`"${key}"`);
    }

    // Accept the cheapest.
    const cheapest = offersBody.offers[0];
    const accept = await app.inject({
      method: 'POST',
      url: `/v1/offers/${cheapest.id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_ok_visa' },
    });
    expect(accept.statusCode, accept.body).toBe(201);
    const order = accept.json();
    expect(order.status).toBe('authorised');
    // Authorised, not charged.
    const breakdown = order.breakdown;
    expect(breakdown.totalCents).toBe(
      breakdown.partCents + breakdown.deliveryCents + breakdown.buyerFeeCents + breakdown.taxCents,
    );

    // A courier was dispatched. Give the async dispatch a moment to land.
    const deliveryId = await waitFor(async () => {
      const rows = await getSql()<{ id: string; provider: string; status: string; parcel_class: string }[]>`
        SELECT id, provider, status, parcel_class FROM deliveries WHERE order_id = ${order.orderId} ORDER BY attempt DESC
      `;
      return rows[0]?.id ?? null;
    }, 20_000);
    expect(deliveryId).toBeTruthy();

    // Buyer tracking leaks no pickup location.
    const tracking = await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/tracking`, headers: bearer(buyer) });
    expect(tracking.statusCode).toBe(200);
    const trackingBody = tracking.body;
    for (const yard of yardRows) {
      expect(trackingBody).not.toContain(yard.business_name);
      expect(trackingBody).not.toContain(String(yard.lat).slice(0, 7));
      expect(trackingBody).not.toContain(String(yard.lng).slice(0, 7));
    }
    for (const key of ['pickup', 'pickupLocation', 'providerRef', 'driverLocation', 'lat', 'lng']) {
      expect(trackingBody, `tracking payload contains "${key}"`).not.toContain(`"${key}"`);
    }

    // Courier collects, then delivers.
    const providerRow = await getSql()<{ provider: string; provider_ref: string }[]>`
      SELECT provider, provider_ref FROM deliveries WHERE id = ${deliveryId}
    `;
    const collect = await app.inject({
      method: 'POST',
      url: `/v1/couriers/${providerRow[0]!.provider}/callback`,
      payload: { deliveryRef: providerRow[0]!.provider_ref, event: 'collected' },
    });
    expect(collect.statusCode).toBe(204);

    const deliver = await app.inject({
      method: 'POST',
      url: `/v1/couriers/${providerRow[0]!.provider}/callback`,
      payload: {
        deliveryRef: providerRow[0]!.provider_ref,
        event: 'delivered',
        proofUrl: 'https://proof.test/abc',
        actualCostCents: 2100,
      },
    });
    expect(deliver.statusCode).toBe(204);

    // Buyer confirms — and only now is the card captured.
    const beforeCapture = await getSql()<{ status: string }[]>`SELECT status FROM orders WHERE id = ${order.orderId}`;
    expect(beforeCapture[0]!.status).toBe('authorised');

    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/orders/${order.orderId}/confirm-receipt`,
      headers: bearer(buyer),
    });
    expect(confirm.statusCode, confirm.body).toBe(200);

    const afterCapture = await getSql()<{ status: string }[]>`SELECT status FROM orders WHERE id = ${order.orderId}`;
    expect(afterCapture[0]!.status).toBe('captured');

    const paymentRows = await getSql()<{ intent: string; status: string }[]>`
      SELECT intent, status FROM payments WHERE order_id = ${order.orderId} ORDER BY created_at
    `;
    expect(paymentRows.map((p) => p.intent)).toEqual(['authorisation', 'capture']);

    // The payout is QUEUED from the operating account — never held as a balance.
    const payout = await getSql()<{ status: string; amount_cents: number }[]>`
      SELECT status, amount_cents FROM payout_queue WHERE order_id = ${order.orderId}
    `;
    expect(payout).toHaveLength(1);
    expect(['queued', 'blocked_kyc']).toContain(payout[0]!.status);

    // And the request closed as fulfilled — a row in the demand dataset.
    const finalRequest = await getSql()<{ status: string; outcome: string }[]>`
      SELECT status, outcome FROM requests WHERE id = ${created.id}
    `;
    expect(finalRequest[0]!.outcome).toBe('fulfilled');
  }, 120_000);

  it('records a demand miss when nobody stocks the part, and tells the buyer honestly', async () => {
    // A vehicle no seeded yard breaks.
    const created = (
      await postRequest({
        vehicle: { kind: 'manual', make: 'Trabant', model: '601', year: 1988 },
        partDescription: 'Rear light cluster for a Trabant 601',
      })
    ).json();

    const { getSql } = await import('../src/db/client.js');
    const outcome = await waitFor(async () => {
      const rows = await getSql()<{ status: string; outcome: string | null }[]>`
        SELECT status, outcome FROM requests WHERE id = ${created.id}
      `;
      return rows[0]?.outcome ?? null;
    }, 20_000);

    // Either nobody matched at all, or nobody had it — both are honest outcomes
    // and both are logged. A request must never silently hang.
    expect(['no_supply', 'no_offers', null]).toContain(outcome);
    if (outcome !== null) {
      const miss = await getSql()<{ miss_kind: string; part_description: string; vehicle_make: string | null }[]>`
        SELECT miss_kind, part_description, vehicle_make FROM demand_misses WHERE request_id = ${created.id}
      `;
      expect(miss).toHaveLength(1);
      expect(miss[0]!.part_description).toContain('Trabant');
      // The most valuable data this business produces.
      expect(['no_supply', 'no_offers']).toContain(miss[0]!.miss_kind);
    }
  }, 60_000);

  it('warns about a duplicate rather than silently fanning out twice', async () => {
    const first = await postRequest({ partDescription: 'Duplicate detection probe' });
    expect(first.statusCode).toBe(201);
    const second = await postRequest({ partDescription: 'Duplicate detection probe' });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.messageKey).toBe('error.duplicate_request');
    expect(second.json().error.details.existingReference).toBeTruthy();

    // And the buyer can post it again deliberately once warned.
    const third = await postRequest({ partDescription: 'Duplicate detection probe', acknowledgeDuplicate: true });
    expect(third.statusCode).toBe(201);
  });

  it('returns the buyer to the offer list when their card is declined', async () => {
    const created = (await postRequest({ partDescription: 'Declined card probe' })).json();
    await waitForFanout(created.id);

    const { getSql } = await import('../src/db/client.js');
    const recipients = await getSql()<{ user_id: string }[]>`
      SELECT s.user_id FROM request_fanouts f JOIN suppliers s ON s.id = f.supplier_id WHERE f.request_id = ${created.id}
    `;
    const sessionsByUser = new Map(suppliers.map((s) => [s.userId, s]));
    const quoting = recipients.map((r) => sessionsByUser.get(r.user_id)).filter((s): s is TestSession => s !== undefined);
    expect(quoting.length).toBeGreaterThanOrEqual(2);

    for (const [i, supplier] of quoting.slice(0, 2).entries()) {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/supplier/requests/${created.id}/offer`,
        headers: { ...bearer(supplier), ...freshClientAddress() },
        payload: { price: String(400 + i * 50), condition: 'used', warrantyDays: 30, readyInMin: 15 },
      });
      expect(res.statusCode, res.body).toBe(201);
    }

    await waitForStatus(created.id, ['COLLECTING_OFFERS']);
    const offers = (await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/offers`, headers: bearer(buyer) })).json();
    const decline = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[0].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_decline_visa' },
    });
    expect(decline.statusCode).toBe(402);
    // The request is NOT closed. Fifteen minutes of supplier effort is not
    // thrown away because a card was declined.
    expect(decline.json().requestStatus).toBe('COLLECTING_OFFERS');

    const retry = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[1].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_ok_visa' },
    });
    expect(retry.statusCode, retry.body).toBe(201);
  }, 90_000);
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
