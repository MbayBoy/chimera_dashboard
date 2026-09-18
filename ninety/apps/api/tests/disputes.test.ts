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
 * Disputes, end to end.
 *
 * Raised by a buyer, evidence attached, resolved by an admin with a partial
 * refund, and the yard's score moves as a result. Plus the rule that makes the
 * process worth anything: neither side can resolve a dispute they are part of.
 */
describe('disputes', () => {
  let app: FastifyInstance;
  let buyer: TestSession;
  let admin: TestSession;
  const suppliers: TestSession[] = [];

  beforeAll(async () => {
    app = await buildTestServer();
    await clearRateLimits();
    buyer = await authenticate(app, { phone: SEED_PHONES.buyer(3), role: 'buyer', locale: 'en-AE' });
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

  /** Drive a request all the way to a delivered order and return the pieces. */
  async function deliveredOrder(): Promise<{
    orderId: string;
    requestId: string;
    supplierId: string;
    supplierSession: TestSession;
    totalCents: number;
  }> {
    counter += 1;
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
          partDescription: `Dispute probe ${counter}`,
          conditionAccepted: ['used'],
          quantity: 1,
          deliveryLocation: { lat: 25.1499, lng: 55.2416 },
          deliveryAddress: {},
          submit: true,
        },
      })
    ).json();

    const recipients = await waitFor(async () => {
      const rows = await getSql()<{ user_id: string }[]>`
        SELECT s.user_id FROM request_fanouts f JOIN suppliers s ON s.id = f.supplier_id WHERE f.request_id = ${created.id}
      `;
      return rows.length > 0 ? rows : null;
    }, 20_000);
    const byUser = new Map(suppliers.map((s) => [s.userId, s]));
    const quoting = recipients.map((r) => byUser.get(r.user_id)).filter((s): s is TestSession => s !== undefined);
    expect(quoting.length).toBeGreaterThanOrEqual(1);

    for (const [i, session] of quoting.slice(0, 2).entries()) {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/supplier/requests/${created.id}/offer`,
        headers: { ...bearer(session), ...freshClientAddress() },
        payload: { price: String(300 + i * 40), condition: 'used', warrantyDays: 30, readyInMin: 15 },
      });
      expect(res.statusCode, res.body).toBe(201);
    }

    await waitFor(async () => {
      const rows = await getSql()<{ status: string }[]>`SELECT status FROM requests WHERE id = ${created.id}`;
      return rows[0]?.status === 'COLLECTING_OFFERS' ? true : null;
    }, 40_000);

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
    const orderId = accept.json().orderId as string;

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
      payload: {
        deliveryRef: delivery.provider_ref,
        event: 'delivered',
        proofUrl: 'https://proof.test/dispute',
        actualCostCents: 1900,
      },
    });

    const order = (
      await getSql()<{ supplier_id: string; total_cents: string; request_id: string }[]>`
        SELECT supplier_id, total_cents::text, request_id FROM orders WHERE id = ${orderId}
      `
    )[0]!;
    const supplierUser = (
      await getSql()<{ user_id: string }[]>`SELECT user_id FROM suppliers WHERE id = ${order.supplier_id}`
    )[0]!;

    return {
      orderId,
      requestId: order.request_id,
      supplierId: order.supplier_id,
      supplierSession: suppliers.find((s) => s.userId === supplierUser.user_id)!,
      totalCents: Number(order.total_cents),
    };
  }

  it('runs a dispute end to end: raised, evidenced, resolved, refunded, and scored', async () => {
    const { getSql } = await import('../src/db/client.js');
    const order = await deliveredOrder();

    const scoreBefore = Number(
      (await getSql()<{ score: string }[]>`SELECT score::text FROM suppliers WHERE id = ${order.supplierId}`)[0]!.score,
    );

    // 1. The buyer raises it. The part arrived broken.
    const raised = await app.inject({
      method: 'POST',
      url: `/v1/orders/${order.orderId}/dispute`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { reason: 'damaged', description: 'Lens cracked across the corner, not as photographed' },
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const disputeId = raised.json().disputeId ?? raised.json().id;
    expect(disputeId).toBeTruthy();

    // The request is visibly under review, not quietly completed.
    const requestStatus = (
      await getSql()<{ status: string }[]>`SELECT status FROM requests WHERE id = ${order.requestId}`
    )[0]!.status;
    expect(requestStatus).toBe('DISPUTED');

    // 2. Evidence, from both sides. A photo with its metadata stripped on the
    //    way in, like every other photo in the product.
    const { makeGpsTaggedJpeg } = await import('../src/media/__fixtures__/make-fixture.mjs');
    const jpeg = await makeGpsTaggedJpeg();
    for (const [who, session] of [
      ['buyer', buyer],
      ['supplier', order.supplierSession],
    ] as const) {
      const form = multipart(jpeg, `${who}.jpg`);
      const evidence = await app.inject({
        method: 'POST',
        url: `/v1/disputes/${disputeId}/evidence`,
        headers: { ...bearer(session), ...freshClientAddress(), 'content-type': form.contentType },
        payload: form.body,
      });
      expect(evidence.statusCode, `${who}: ${evidence.body}`).toBe(201);
    }

    // Evidence goes through the same ingest as every other photo, so the GPS
    // tag that says which yard the part came from does not survive upload.
    const stored = await getSql()<{ storage_key: string }[]>`
      SELECT storage_key FROM dispute_evidence WHERE dispute_id = ${disputeId} LIMIT 1
    `;
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const bytes = await readFile(join(process.env.MEDIA_LOCAL_DIR ?? '.media-test', stored[0]!.storage_key));
    expect(bytes.includes(Buffer.from('GPS')), 'evidence kept its GPS tag').toBe(false);
    const evidenceRows = await getSql()<{ n: string }[]>`
      SELECT count(*)::text AS n FROM dispute_evidence WHERE dispute_id = ${disputeId}
    `;
    expect(Number(evidenceRows[0]!.n)).toBe(2);

    // 3. The admin resolves it with a partial refund.
    const refundCents = Math.round(order.totalCents / 2);
    const resolved = await app.inject({
      method: 'POST',
      url: `/v1/disputes/${disputeId}/resolve`,
      headers: { ...bearer(admin), ...freshClientAddress() },
      payload: {
        outcome: 'upheld_partial_refund',
        resolution: 'Lens damage confirmed from the photographs. Half the part price refunded.',
        refundCents,
      },
    });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json().refundedCents).toBe(refundCents);

    // 4. The money moved, in minor units, and the buyer ends up charged exactly
    //    what the admin decided — whichever instrument got them there. This
    //    dispute was raised instead of confirming receipt, so the card was
    //    authorised and never captured: the resolution captures the reduced
    //    amount rather than capturing in full and refunding half of it back.
    const payments = await getSql()<{ intent: string; amount_cents: string; status: string }[]>`
      SELECT intent, amount_cents::text, status FROM payments WHERE order_id = ${order.orderId} ORDER BY created_at
    `;
    const moved = (intent: string): number =>
      payments.filter((p) => p.intent === intent).reduce((sum, p) => sum + Number(p.amount_cents), 0);
    const netCharged = moved('capture') - moved('refund');
    expect(netCharged).toBe(order.totalCents - refundCents);
    expect(payments.some((p) => p.intent === 'authorisation')).toBe(true);
    // Never more than was authorised, in any branch.
    expect(moved('capture')).toBeLessThanOrEqual(order.totalCents);

    // 5. The score effect. An upheld dispute costs the yard, and the event is
    //    on the record so the yard can see why their score moved.
    const scoreAfter = Number(
      (await getSql()<{ score: string }[]>`SELECT score::text FROM suppliers WHERE id = ${order.supplierId}`)[0]!.score,
    );
    expect(scoreAfter).toBeLessThan(scoreBefore);
    const events = await getSql()<{ event: string }[]>`
      SELECT event FROM supplier_score_events WHERE supplier_id = ${order.supplierId} AND event = 'disputed'
    `;
    expect(events.length).toBeGreaterThanOrEqual(1);

    // And the yard can read it on their own performance screen.
    const history = await app.inject({
      method: 'GET',
      url: '/v1/supplier/score-history',
      headers: bearer(order.supplierSession),
    });
    expect(history.statusCode).toBe(200);
    expect(JSON.stringify(history.json())).toContain('disputed');
  }, 180_000);

  it('a dispute after the buyer has already confirmed is refunded, not re-captured', async () => {
    const { getSql } = await import('../src/db/client.js');
    const order = await deliveredOrder();

    // The buyer confirms first — so the card is captured — and only then finds
    // the fault. This is the branch that produces a real refund.
    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/orders/${order.orderId}/confirm-receipt`,
      headers: bearer(buyer),
    });
    expect(confirm.statusCode, confirm.body).toBe(200);

    const raised = await app.inject({
      method: 'POST',
      url: `/v1/orders/${order.orderId}/dispute`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { reason: 'damaged', description: 'Hairline crack only visible once fitted' },
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const disputeId = raised.json().disputeId ?? raised.json().id;

    const resolved = await app.inject({
      method: 'POST',
      url: `/v1/disputes/${disputeId}/resolve`,
      headers: { ...bearer(admin), ...freshClientAddress() },
      payload: { outcome: 'upheld_refund', resolution: 'Refunded in full; the yard collects the part.' },
    });
    expect(resolved.statusCode, resolved.body).toBe(200);

    const payments = await getSql()<{ intent: string; amount_cents: string }[]>`
      SELECT intent, amount_cents::text FROM payments WHERE order_id = ${order.orderId} ORDER BY created_at
    `;
    const refund = payments.find((p) => p.intent === 'refund');
    expect(refund, 'a captured order was not refunded').toBeTruthy();
    expect(Number(refund!.amount_cents)).toBe(order.totalCents);
  }, 180_000);

  it('a supplier cannot resolve a dispute raised against them', async () => {
    const order = await deliveredOrder();
    const raised = await app.inject({
      method: 'POST',
      url: `/v1/orders/${order.orderId}/dispute`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { reason: 'wrong_part', description: 'Left hand side, not right' },
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const disputeId = raised.json().disputeId ?? raised.json().id;

    // The accused, trying to close it in their own favour.
    const bySupplier = await app.inject({
      method: 'POST',
      url: `/v1/disputes/${disputeId}/resolve`,
      headers: { ...bearer(order.supplierSession), ...freshClientAddress() },
      payload: { outcome: 'rejected', resolution: 'Nothing wrong with it' },
    });
    expect(bySupplier.statusCode).toBe(403);

    // And the complainant, trying to award themselves a refund.
    const byBuyer = await app.inject({
      method: 'POST',
      url: `/v1/disputes/${disputeId}/resolve`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { outcome: 'upheld_refund', resolution: 'Give me my money back' },
    });
    expect(byBuyer.statusCode).toBe(403);

    // Still open, and still nobody's to close but an admin's.
    const { getSql } = await import('../src/db/client.js');
    const row = (await getSql()<{ status: string }[]>`SELECT status FROM disputes WHERE id = ${disputeId}`)[0]!;
    expect(row.status).not.toBe('resolved');
    expect(row.status).not.toBe('rejected');
  }, 180_000);

  it('a rejected dispute costs the yard nothing', async () => {
    const { getSql } = await import('../src/db/client.js');
    const order = await deliveredOrder();
    const before = Number(
      (await getSql()<{ score: string }[]>`SELECT score::text FROM suppliers WHERE id = ${order.supplierId}`)[0]!.score,
    );

    const raised = await app.inject({
      method: 'POST',
      url: `/v1/orders/${order.orderId}/dispute`,
      headers: { ...bearer(buyer), ...freshClientAddress() },
      payload: { reason: 'not_as_described', description: 'Changed my mind about the colour' },
    });
    const disputeId = raised.json().disputeId ?? raised.json().id;

    const resolved = await app.inject({
      method: 'POST',
      url: `/v1/disputes/${disputeId}/resolve`,
      headers: { ...bearer(admin), ...freshClientAddress() },
      payload: { outcome: 'rejected', resolution: 'Part matches the photographs and the description. No fault found.' },
    });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json().refundedCents).toBe(0);

    const after = Number(
      (await getSql()<{ score: string }[]>`SELECT score::text FROM suppliers WHERE id = ${order.supplierId}`)[0]!.score,
    );
    // Being complained about is not the same as being at fault.
    expect(after).toBe(before);
  }, 180_000);

  it('the admin dispute queue shows both sides without leaking either to the other', async () => {
    const list = await app.inject({ method: 'GET', url: '/v1/admin/disputes', headers: bearer(admin) });
    expect(list.statusCode).toBe(200);
    expect(list.json().disputes.length).toBeGreaterThan(0);

    // The buyer's own dispute list must not name the yard.
    const mine = await app.inject({ method: 'GET', url: '/v1/disputes', headers: bearer(buyer) });
    expect(mine.statusCode).toBe(200);
    const { getSql } = await import('../src/db/client.js');
    const yards = await getSql()<{ business_name: string; phone: string }[]>`
      SELECT s.business_name, u.phone FROM suppliers s JOIN users u ON u.id = s.user_id
    `;
    for (const yard of yards) {
      expect(mine.body, 'the buyer dispute list names a yard').not.toContain(yard.business_name);
      expect(mine.body).not.toContain(yard.phone);
    }
  }, 60_000);
});

/** A multipart body, by hand: the evidence endpoint takes a file, like the app sends one. */
function multipart(file: Buffer, filename: string): { body: Buffer; contentType: string } {
  const boundary = `----ninety${Math.random().toString(36).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      'Content-Type: image/jpeg\r\n\r\n',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([head, file, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== null && value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('timed out waiting for a condition');
}
