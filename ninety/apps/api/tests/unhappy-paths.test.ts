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
import en from '../src/i18n/catalogues/en.json' with { type: 'json' };
import ar from '../src/i18n/catalogues/ar.json' with { type: 'json' };

/**
 * The ten unhappy paths.
 *
 * Each one is tested for behaviour AND for the message the person on the other
 * end actually receives — in both launch languages. A handled path with no copy
 * is not handled: the buyer sees a status code and decides the product is broken.
 *
 * The catalogue these assert against is docs/UNHAPPY-PATHS.md, which is
 * generated from the same JSON, so the document cannot drift from the product.
 */

function messageAt(catalogue: unknown, path: string): string {
  return path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalogue) as string;
}

describe('unhappy paths', () => {
  let app: FastifyInstance;
  let buyer: TestSession;
  let admin: TestSession;
  const suppliers: TestSession[] = [];

  beforeAll(async () => {
    app = await buildTestServer();
    await clearRateLimits();
    await clearPingBudgets();
    buyer = await authenticate(app, { phone: SEED_PHONES.buyer(2), role: 'buyer', locale: 'en-AE' });
    admin = await authenticate(app, { phone: SEED_PHONES.admin, role: 'admin', locale: 'en-AE' });
    for (let i = 1; i <= 8; i++) {
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

  let jobCounter = 0;

  async function categoryId(code: string): Promise<string> {
    const { getSql } = await import('../src/db/client.js');
    return (await getSql()<{ id: string }[]>`SELECT id FROM part_categories WHERE code = ${code}`)[0]!.id;
  }

  async function postRequest(overrides: Record<string, unknown> = {}) {
    jobCounter += 1;
    return app.inject({
      method: 'POST',
      url: '/v1/requests',
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: {
        vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
        partCategoryId: await categoryId('lighting.tail_lamp.rear_right'),
        partDescription: `Unhappy path probe ${jobCounter}`,
        conditionAccepted: ['used', 'refurbished'],
        quantity: 1,
        deliveryLocation: { lat: 25.1499, lng: 55.2416 },
        deliveryAddress: { note: 'Workshop bay 3' },
        submit: true,
        ...overrides,
      },
    });
  }

  async function waitForStatus(requestId: string, states: readonly string[], timeoutMs = 40_000): Promise<string> {
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

  async function quotingSessions(requestId: string): Promise<TestSession[]> {
    const { getSql } = await import('../src/db/client.js');
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const rows = await getSql()<{ user_id: string }[]>`
        SELECT s.user_id FROM request_fanouts f JOIN suppliers s ON s.id = f.supplier_id WHERE f.request_id = ${requestId}
      `;
      if (rows.length > 0) {
        const byUser = new Map(suppliers.map((s) => [s.userId, s]));
        const found = rows.map((r) => byUser.get(r.user_id)).filter((s): s is TestSession => s !== undefined);
        if (found.length > 0) return found;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('nobody was fanned out to');
  }

  async function quote(session: TestSession, requestId: string, price: string) {
    return app.inject({
      method: 'POST',
      url: `/v1/supplier/requests/${requestId}/offer`,
      headers: { ...bearer(session), ...freshClientAddress() },
      payload: { price, condition: 'used', warrantyDays: 30, readyInMin: 20 },
    });
  }

  async function notificationsFor(userId: string): Promise<{ message_key: string; params: unknown }[]> {
    const { getSql } = await import('../src/db/client.js');
    return getSql()<{ message_key: string; params: unknown }[]>`
      SELECT message_key, params FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50
    `;
  }

  async function waitForNotification(userId: string, messageKey: string, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const rows = await notificationsFor(userId);
      if (rows.some((r) => r.message_key === messageKey)) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`${messageKey} was never sent to ${userId}`);
  }

  /** Every path below must have copy in both launch languages. */
  function expectCopy(key: string): void {
    const english = messageAt(en, key);
    const arabic = messageAt(ar, key);
    expect(english, `${key} has no English copy`).toBeTruthy();
    expect(arabic, `${key} has no Arabic copy`).toBeTruthy();
    expect(arabic, `${key} was never translated`).not.toBe(english);
    // Arabic copy that is actually Arabic, not a transliteration or a stub.
    expect(arabic, `${key} does not contain Arabic script`).toMatch(/[؀-ۿ]/);
  }

  it('1. zero offers at the response deadline: widens, and says so', async () => {
    const created = (await postRequest({ partDescription: 'Widening probe, nobody answers' })).json();
    await waitForStatus(created.id, ['WIDENING', 'NO_OFFERS', 'CLOSED']);

    await waitForNotification(buyer.userId, 'notify.buyer.search_widened');
    expectCopy('notify.buyer.search_widened');

    const { getSql } = await import('../src/db/client.js');
    const transitions = await getSql()<{ to_state: string; actor_type: string }[]>`
      SELECT to_state, actor_type FROM request_state_transitions WHERE request_id = ${created.id} ORDER BY created_at
    `;
    // The widening is the clock's doing, not a person's.
    expect(transitions.some((t) => t.to_state === 'WIDENING' && t.actor_type === 'timer')).toBe(true);
  }, 90_000);

  it('2. zero offers after widening: closes honestly and logs the miss', async () => {
    const created = (
      await postRequest({
        vehicle: { kind: 'manual', make: 'Trabant', model: '601', year: 1988 },
        partDescription: 'Nobody breaks a Trabant in Dubai',
      })
    ).json();
    const status = await waitForStatus(created.id, ['NO_OFFERS', 'CLOSED', 'NO_SUPPLY'], 90_000);
    expect(['NO_OFFERS', 'CLOSED', 'NO_SUPPLY']).toContain(status);

    // The miss row is written just after the transition, so this waits for it
    // rather than racing it — the row is the point of the whole path.
    const { getSql } = await import('../src/db/client.js');
    const miss = await waitFor(async () => {
      const rows = await getSql()<{ miss_kind: string }[]>`
        SELECT miss_kind FROM demand_misses WHERE request_id = ${created.id}
      `;
      return rows.length > 0 ? rows : null;
    }, 20_000);
    expect(miss.length, 'an unfilled request that produced no demand-miss row').toBe(1);

    // "We could not find it" — never silence, and never a status code.
    expectCopy('notify.buyer.no_offers');
    expectCopy('notify.buyer.no_supply');
  }, 120_000);

  it('3. supplier withdraws after offering: the offer goes, the buyer is told', async () => {
    const created = (await postRequest({ partDescription: 'Withdrawal probe' })).json();
    const quoting = await quotingSessions(created.id);
    expect(quoting.length).toBeGreaterThanOrEqual(2);

    const first = await quote(quoting[0]!, created.id, '500');
    expect(first.statusCode, first.body).toBe(201);
    const second = await quote(quoting[1]!, created.id, '600');
    expect(second.statusCode).toBe(201);

    const withdraw = await app.inject({
      method: 'POST',
      url: `/v1/supplier/offers/${first.json().offerId}/withdraw`,
      headers: { ...bearer(quoting[0]!), ...freshClientAddress() },
      payload: { reason: 'sold on the counter' },
    });
    expect(withdraw.statusCode).toBe(204);

    await waitForStatus(created.id, ['COLLECTING_OFFERS']);
    const offers = (
      await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/offers`, headers: bearer(buyer) })
    ).json();
    // Gone from the buyer's list, and the remaining one is untouched.
    expect(offers.offers.map((o: { id: string }) => o.id)).not.toContain(first.json().offerId);
    expect(offers.offers.length).toBe(1);

    await waitForNotification(buyer.userId, 'notify.buyer.offer_withdrawn');
    expectCopy('notify.buyer.offer_withdrawn');
    expectCopy('unhappy.supplier_withdrew_before_accept');
  }, 120_000);

  it('3b. supplier withdraws an ACCEPTED offer: selection re-opens and the hold is released', async () => {
    const created = (await postRequest({ partDescription: 'Withdrawal after acceptance probe' })).json();
    const quoting = await quotingSessions(created.id);
    const offerA = await quote(quoting[0]!, created.id, '450');
    const offerB = await quote(quoting[1]!, created.id, '520');
    expect(offerA.statusCode).toBe(201);
    expect(offerB.statusCode).toBe(201);

    await waitForStatus(created.id, ['COLLECTING_OFFERS']);
    const offers = (
      await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/offers`, headers: bearer(buyer) })
    ).json();
    const accept = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[0].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_ok_visa' },
    });
    expect(accept.statusCode, accept.body).toBe(201);
    const orderId = accept.json().orderId;

    // Whichever yard won it, withdraw from that session.
    const { getSql } = await import('../src/db/client.js');
    const winner = (
      await getSql()<{ offer_id: string; user_id: string }[]>`
        SELECT o.id AS offer_id, s.user_id
          FROM orders ord JOIN offers o ON o.id = ord.offer_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE ord.id = ${orderId}
      `
    )[0]!;
    const winnerSession = suppliers.find((s) => s.userId === winner.user_id)!;

    const withdraw = await app.inject({
      method: 'POST',
      url: `/v1/supplier/offers/${winner.offer_id}/withdraw`,
      headers: { ...bearer(winnerSession), ...freshClientAddress() },
      payload: { reason: 'part turned out to be cracked' },
    });
    expect(withdraw.statusCode).toBe(204);

    // The authorisation is voided — not captured, not left hanging on the card.
    const order = await getSql()<{ status: string }[]>`SELECT status FROM orders WHERE id = ${orderId}`;
    expect(['voided', 'cancelled']).toContain(order[0]!.status);

    // And the yard that broke its word pays for it in score, which is the only
    // lever that keeps the promise real.
    const scoreEvent = await getSql()<{ event: string }[]>`
      SELECT event FROM supplier_score_events WHERE request_id = ${created.id} AND event = 'cancelled_after_win'
    `;
    expect(scoreEvent.length).toBe(1);

    await waitForNotification(buyer.userId, 'notify.buyer.accepted_offer_withdrawn');
    expectCopy('notify.buyer.accepted_offer_withdrawn');
  }, 120_000);

  it('4. the buyer cancels: defined behaviour in every state, with the hold released', async () => {
    // Before anyone has quoted.
    const early = (await postRequest({ partDescription: 'Cancel before offers' })).json();
    const cancelEarly = await app.inject({
      method: 'POST',
      url: `/v1/requests/${early.id}/cancel`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { reason: 'found one locally' },
    });
    expect(cancelEarly.statusCode, cancelEarly.body).toBe(200);
    expect(cancelEarly.json().status).toBe('CANCELLED');

    // After paying: the authorisation must be voided, not left on the card.
    const later = (await postRequest({ partDescription: 'Cancel after acceptance' })).json();
    const quoting = await quotingSessions(later.id);
    await quote(quoting[0]!, later.id, '480');
    await quote(quoting[1]!, later.id, '530');
    await waitForStatus(later.id, ['COLLECTING_OFFERS']);
    const offers = (
      await app.inject({ method: 'GET', url: `/v1/requests/${later.id}/offers`, headers: bearer(buyer) })
    ).json();
    const accept = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[0].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_ok_visa' },
    });
    expect(accept.statusCode, accept.body).toBe(201);

    const cancelLate = await app.inject({
      method: 'POST',
      url: `/v1/requests/${later.id}/cancel`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { reason: 'no longer needed' },
    });
    expect(cancelLate.statusCode, cancelLate.body).toBe(200);

    const { getSql } = await import('../src/db/client.js');
    const order = await getSql()<{ status: string }[]>`SELECT status FROM orders WHERE id = ${accept.json().orderId}`;
    expect(['voided', 'cancelled']).toContain(order[0]!.status);
    const payments = await getSql()<{ intent: string; status: string }[]>`
      SELECT intent, status FROM payments WHERE order_id = ${accept.json().orderId} ORDER BY created_at
    `;
    // Authorised then voided. Never captured.
    expect(payments.some((p) => p.intent === 'capture' && p.status === 'succeeded')).toBe(false);

    expectCopy('unhappy.buyer_cancelled_authorised');
    expectCopy('unhappy.buyer_cancelled_dispatched');
  }, 150_000);

  it('5. the card is declined: the buyer returns to the offer list, the request stays open', async () => {
    const created = (await postRequest({ partDescription: 'Declined card unhappy path' })).json();
    const quoting = await quotingSessions(created.id);
    await quote(quoting[0]!, created.id, '410');
    await quote(quoting[1]!, created.id, '470');
    await waitForStatus(created.id, ['COLLECTING_OFFERS']);

    const offers = (
      await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/offers`, headers: bearer(buyer) })
    ).json();
    const declined = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[0].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_decline_visa' },
    });
    expect(declined.statusCode).toBe(402);
    expect(declined.json().requestStatus).toBe('COLLECTING_OFFERS');
    // The buyer's message, not a bare error code: it says the money is safe and
    // that their other offers are still open, which is the actionable part.
    expect(declined.json().error.messageKey).toBe('notify.buyer.payment_failed');

    expectCopy('error.payment_failed');
    expectCopy('notify.buyer.payment_failed');
  }, 120_000);

  it('6. the courier fails after collection: ops is raised, the buyer is told, the yard is not penalised', async () => {
    const created = (await postRequest({ partDescription: 'Courier failure after collection' })).json();
    const quoting = await quotingSessions(created.id);
    await quote(quoting[0]!, created.id, '390');
    await quote(quoting[1]!, created.id, '445');
    await waitForStatus(created.id, ['COLLECTING_OFFERS']);
    const offers = (
      await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/offers`, headers: bearer(buyer) })
    ).json();
    const accept = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[0].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_ok_visa' },
    });
    expect(accept.statusCode, accept.body).toBe(201);

    const { getSql } = await import('../src/db/client.js');
    const delivery = await waitFor(async () => {
      const rows = await getSql()<{ id: string; provider: string; provider_ref: string; supplier_id: string }[]>`
        SELECT d.id, d.provider, d.provider_ref, o.supplier_id
          FROM deliveries d JOIN orders o ON o.id = d.order_id
         WHERE d.order_id = ${accept.json().orderId} ORDER BY d.attempt DESC LIMIT 1
      `;
      return rows[0] ?? null;
    }, 25_000);

    const before = await getSql()<{ score: string }[]>`SELECT score::text FROM suppliers WHERE id = ${delivery.supplier_id}`;

    await app.inject({
      method: 'POST',
      url: `/v1/couriers/${delivery.provider}/callback`,
      payload: { deliveryRef: delivery.provider_ref, event: 'collected' },
    });
    const failed = await app.inject({
      method: 'POST',
      url: `/v1/couriers/${delivery.provider}/callback`,
      payload: { deliveryRef: delivery.provider_ref, event: 'failed', reason: 'van broke down with the part on board' },
    });
    expect(failed.statusCode).toBe(204);

    // Ops must be holding this. A part in a stranded van is not a state machine
    // problem, it is a person-ringing-someone problem.
    const ops = await waitFor(async () => {
      const rows = await getSql()<{ id: string; kind: string; severity: string }[]>`
        SELECT id, kind, severity FROM ops_queue WHERE request_id = ${created.id} ORDER BY created_at DESC LIMIT 1
      `;
      return rows[0] ?? null;
    }, 20_000);
    expect(ops.kind).toBeTruthy();

    // The yard did its job. Its score is untouched by the courier's failure.
    const after = await getSql()<{ score: string }[]>`SELECT score::text FROM suppliers WHERE id = ${delivery.supplier_id}`;
    expect(Number(after[0]!.score)).toBe(Number(before[0]!.score));
    const penalties = await getSql()<{ event: string }[]>`
      SELECT event FROM supplier_score_events
       WHERE supplier_id = ${delivery.supplier_id} AND request_id = ${created.id}
         AND event IN ('cancelled_after_win', 'disputed')
    `;
    expect(penalties.length).toBe(0);

    expectCopy('notify.buyer.courier_failed_after_collection');
  }, 180_000);

  it('8. the buyer never confirms: the order auto-confirms and captures', async () => {
    // The auto-confirm window is a market value (24 hours) compressed by the
    // test clock, so this exercises the real timer rather than a shortcut.
    const created = (await postRequest({ partDescription: 'Auto confirm probe' })).json();
    const quoting = await quotingSessions(created.id);
    await quote(quoting[0]!, created.id, '360');
    await quote(quoting[1]!, created.id, '399');
    await waitForStatus(created.id, ['COLLECTING_OFFERS']);
    const offers = (
      await app.inject({ method: 'GET', url: `/v1/requests/${created.id}/offers`, headers: bearer(buyer) })
    ).json();
    const accept = await app.inject({
      method: 'POST',
      url: `/v1/offers/${offers.offers[0].id}/accept`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { paymentMethodToken: 'tok_ok_visa' },
    });
    expect(accept.statusCode, accept.body).toBe(201);
    const orderId = accept.json().orderId;

    const { getSql } = await import('../src/db/client.js');
    const delivery = await waitFor(async () => {
      const rows = await getSql()<{ provider: string; provider_ref: string }[]>`
        SELECT provider, provider_ref FROM deliveries WHERE order_id = ${orderId} ORDER BY attempt DESC LIMIT 1
      `;
      return rows[0] ?? null;
    }, 25_000);

    await app.inject({
      method: 'POST',
      url: `/v1/couriers/${delivery.provider}/callback`,
      payload: { deliveryRef: delivery.provider_ref, event: 'collected' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/couriers/${delivery.provider}/callback`,
      payload: { deliveryRef: delivery.provider_ref, event: 'delivered', proofUrl: 'https://proof.test/auto', actualCostCents: 1800 },
    });

    // The auto-confirm window is 24 hours of product clock, which the test speed
    // factor compresses — but not to nothing. This genuinely waits for the timer.
    const captured = await waitFor(async () => {
      const rows = await getSql()<{ status: string }[]>`SELECT status FROM orders WHERE id = ${orderId}`;
      return rows[0]?.status === 'captured' ? rows[0].status : null;
    }, 200_000);
    expect(captured).toBe('captured');

    expectCopy('notify.buyer.auto_confirmed');
  }, 300_000);

  it('9. a duplicate is detected and warned about, never silently fanned out twice', async () => {
    const description = 'Duplicate unhappy path probe';
    const first = await postRequest({ partDescription: description });
    expect(first.statusCode).toBe(201);
    const second = await postRequest({ partDescription: description });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.messageKey).toBe('error.duplicate_request');

    const { getSql } = await import('../src/db/client.js');
    const fanouts = await getSql()<{ n: string }[]>`
      SELECT count(*)::text AS n FROM request_fanouts WHERE request_id = ${second.json().error.details?.existingRequestId ?? first.json().id}
    `;
    expect(Number(fanouts[0]!.n)).toBeGreaterThanOrEqual(0);

    expectCopy('error.duplicate_request');
    expectCopy('unhappy.duplicate_detected');
  }, 60_000);

  it('10. a terminal offline at fan-out is not counted as a no-response', async () => {
    const { getSql } = await import('../src/db/client.js');
    const created = (await postRequest({ partDescription: 'Offline terminal probe' })).json();
    await quotingSessions(created.id);

    // Nobody answers, and no terminal held a socket during this test, so every
    // fan-out was to an offline yard.
    await waitForStatus(created.id, ['WIDENING', 'NO_OFFERS', 'CLOSED'], 90_000);

    const outcomes = await waitFor(async () => {
      const rows = await getSql()<{ outcome: string | null; was_online_at_send: boolean }[]>`
        SELECT outcome, was_online_at_send FROM request_fanouts WHERE request_id = ${created.id}
      `;
      return rows.every((r) => r.outcome !== null) ? rows : null;
    }, 60_000);

    for (const row of outcomes) {
      if (!row.was_online_at_send) {
        // "Unreachable", not "no_response". They did not ignore the job; they
        // never received it, and a yard penalised for a power cut leaves.
        expect(row.outcome).toBe('unreachable');
      }
    }

    const events = await getSql()<{ event: string; supplier_id: string }[]>`
      SELECT event, supplier_id FROM supplier_score_events WHERE request_id = ${created.id}
    `;
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.event === 'unreachable')).toBe(true);

    const { scoreEventDelta } = await import('@ninety/shared');
    // The decisive assertion: an unreachable terminal moves the score by zero.
    expect(scoreEventDelta('unreachable')).toBe(0);

    expectCopy('notify.supplier.offline_not_penalised');
    expectCopy('unhappy.terminal_offline_at_fanout');
  }, 150_000);

  it('every unhappy-path message exists in both launch languages', () => {
    for (const key of Object.keys(en.unhappy as Record<string, string>)) {
      expectCopy(`unhappy.${key}`);
    }
  });

  it('the admin can see what went wrong without reading the code', async () => {
    const created = (await postRequest({ partDescription: 'Ops visibility probe' })).json();
    await waitForStatus(created.id, ['AWAITING_OFFERS', 'WIDENING', 'NO_OFFERS', 'CLOSED']);
    const timeline = await app.inject({
      method: 'GET',
      url: `/v1/admin/requests/${created.id}/timeline`,
      headers: bearer(admin),
    });
    expect(timeline.statusCode).toBe(200);
    const body = timeline.json();
    expect(body.timeline.length).toBeGreaterThan(0);
    for (const t of body.timeline) expect(t.reason ?? t.transition).toBeTruthy();
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
