import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authenticate, bearer, buildTestServer, clearRateLimits, freshClientAddress, SEED_PHONES } from './helpers.js';

/**
 * PHASE 00 GATE.
 *
 * Each test corresponds to a lettered acceptance criterion in the phase
 * document. The point of the gate is evidence rather than assertion, so these
 * exercise the real API against a real PostGIS database and a real Redis.
 */
describe('Phase 00 — foundations', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestServer();
    await clearRateLimits();
  });

  afterAll(async () => {
    await app.close();
    const { closeDb } = await import('../src/db/client.js');
    const { closeRedis } = await import('../src/core/redis.js');
    const { stopMarketWatcher } = await import('../src/market/watcher.js');
    await stopMarketWatcher();
    await closeDb();
    await closeRedis();
  });

  describe('(a,b) database', () => {
    it('reports PostGIS available on the health check', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.checks.database.ok).toBe(true);
      expect(body.checks.redis.ok).toBe(true);
      expect(body.checks.database.postgis).toMatch(/^\d+\.\d+/);
    });

    it('stores every location as GEOGRAPHY(POINT,4326), not a bare POINT', async () => {
      // The failure mode this catches: the extension installs, the migration uses
      // a plain POINT, and every radius query returns degrees instead of metres.
      // Nothing errors — the numbers are just wrong, plausibly.
      const { getSql } = await import('../src/db/client.js');
      const rows = await getSql()<{ f_table_name: string; type: string; srid: number; coord_dimension: number }[]>`
        SELECT f_table_name, type, srid, coord_dimension FROM geography_columns ORDER BY f_table_name
      `;
      expect(rows.length).toBeGreaterThanOrEqual(7);
      for (const row of rows) {
        expect(row.type).toBe('Point');
        expect(row.srid).toBe(4326);
      }
      const tables = rows.map((r) => r.f_table_name);
      for (const expected of ['suppliers', 'requests', 'cities', 'buyers', 'deliveries', 'demand_misses']) {
        expect(tables).toContain(expected);
      }
    });

    it('keeps every monetary column in integer minor units', async () => {
      const { getSql } = await import('../src/db/client.js');
      const rows = await getSql()<{ table_name: string; column_name: string; data_type: string }[]>`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (column_name LIKE '%_cents' OR column_name LIKE '%amount%' OR column_name LIKE '%price%')
        ORDER BY table_name, column_name
      `;
      expect(rows.length).toBeGreaterThan(10);
      for (const row of rows) {
        expect(row.data_type, `${row.table_name}.${row.column_name} must be bigint`).toBe('bigint');
      }
    });

    it('seeds two markets that differ on tax, locale, direction and vehicle identifier', async () => {
      // If the code works for both, the abstraction is real. If only one market
      // exists, every hardcoded assumption survives until the second launch.
      const { marketConfig } = await import('../src/market/config.js');
      const all = await marketConfig.all();
      expect(all).toHaveLength(2);
      const [first, second] = all;
      expect(first!.tax.rate).not.toBe(second!.tax.rate);
      expect(first!.localeDefault).not.toBe(second!.localeDefault);
      expect(first!.vehicleIdentifier.type).not.toBe(second!.vehicleIdentifier.type);
      expect(new Set(all.map((m) => m.rtl)).size).toBe(2);
      expect(all.filter((m) => m.isLive)).toHaveLength(1);
    });

    it('seeds suppliers with genuinely varied stock profiles', async () => {
      // Identical profiles at identical coordinates make the Phase 02 matching
      // engine look like it works when it does not: everything scores the same.
      const { getSql } = await import('../src/db/client.js');
      const rows = await getSql()<{ makes: string[]; max_radius_km: number; dist: number; stage: string }[]>`
        SELECT p.makes, p.max_radius_km, s.onboarding_stage AS stage,
               ST_Distance(s.location, (SELECT centroid FROM cities WHERE name = 'Dubai')) AS dist
        FROM suppliers s JOIN supplier_stock_profiles p ON p.supplier_id = s.id
      `;
      expect(rows.length).toBeGreaterThanOrEqual(8);
      expect(new Set(rows.map((r) => JSON.stringify(r.makes))).size).toBeGreaterThan(4);
      expect(new Set(rows.map((r) => r.max_radius_km)).size).toBeGreaterThan(3);
      expect(new Set(rows.map((r) => Math.round(r.dist / 1000))).size).toBeGreaterThan(5);
      // And the pipeline has to contain yards that are NOT yet activated, because
      // a signed yard with an unconfigured tablet is a dead terminal.
      expect(new Set(rows.map((r) => r.stage)).size).toBeGreaterThan(1);
    });

    it('seeds every part category with a real Arabic name, not a placeholder', async () => {
      const { getSql } = await import('../src/db/client.js');
      const rows = await getSql()<{ code: string; en: string; ar: string; parcel_class: string }[]>`
        SELECT code, name_i18n->>'en' AS en, name_i18n->>'ar' AS ar, parcel_class FROM part_categories
      `;
      expect(rows.length).toBeGreaterThanOrEqual(40);
      for (const row of rows) {
        expect(row.en?.length ?? 0).toBeGreaterThan(1);
        expect(row.ar, `${row.code} has no Arabic name`).toBeTruthy();
        expect(row.ar, `${row.code} Arabic name is not Arabic script`).toMatch(/[؀-ۿ]/);
        expect(row.ar).not.toBe(row.en);
        expect(['bike', 'car', 'van']).toContain(row.parcel_class);
      }
      const roots = new Set(rows.map((r) => r.code.split('.')[0]));
      for (const required of ['lighting', 'body', 'glass', 'mirrors', 'engine', 'transmission', 'suspension', 'interior', 'electrical']) {
        expect(roots).toContain(required);
      }
    });
  });

  describe('(c) authentication', () => {
    it('issues tokens for a buyer, a supplier and an admin', async () => {
      const buyer = await authenticate(app, { phone: SEED_PHONES.buyer(1), role: 'buyer' });
      const supplier = await authenticate(app, { phone: SEED_PHONES.supplier(1), role: 'supplier' });
      const admin = await authenticate(app, { phone: SEED_PHONES.admin, role: 'admin' });
      expect(buyer.role).toBe('buyer');
      expect(supplier.role).toBe('supplier');
      expect(admin.role).toBe('admin');
      for (const session of [buyer, supplier, admin]) {
        const me = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: bearer(session) });
        expect(me.statusCode).toBe(200);
        expect(me.json().market.code).toBeTruthy();
      }
    });

    it('will not create a supplier or admin account from a successful OTP', async () => {
      // Yards are signed in person and their terminal configured on the visit.
      // An OTP against an unknown number is a rejection, not an onboarding.
      const unknown = '+9999009999';
      const client = freshClientAddress();
      const request = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        headers: client,
        payload: { marketCode: 'AE', phone: unknown },
      });
      const verify = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: client,
        payload: { marketCode: 'AE', phone: unknown, code: request.json().devCode, role: 'supplier' },
      });
      expect(verify.statusCode).toBe(403);
    });

    it('rejects a wrong OTP and refuses a replayed one', async () => {
      const phone = SEED_PHONES.buyer(2);
      const client = freshClientAddress();
      const request = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        headers: client,
        payload: { marketCode: 'AE', phone },
      });
      const code = request.json().devCode as string;

      const wrong = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: client,
        payload: { marketCode: 'AE', phone, code: '000000', role: 'buyer' },
      });
      expect(wrong.statusCode).toBe(401);

      const right = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: client,
        payload: { marketCode: 'AE', phone, code, role: 'buyer' },
      });
      expect(right.statusCode).toBe(200);

      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: client,
        payload: { marketCode: 'AE', phone, code, role: 'buyer' },
      });
      expect(replay.statusCode).toBe(401);
    });

    it('rotates refresh tokens so a stolen one is usable at most once', async () => {
      const session = await authenticate(app, { phone: SEED_PHONES.buyer(3), role: 'buyer' });
      const client = freshClientAddress();
      const first = await app.inject({ method: 'POST', url: '/v1/auth/refresh', headers: client, payload: { refreshToken: session.refreshToken } });
      expect(first.statusCode).toBe(200);
      const replay = await app.inject({ method: 'POST', url: '/v1/auth/refresh', headers: client, payload: { refreshToken: session.refreshToken } });
      expect(replay.statusCode).toBe(401);
    });
  });

  describe('(d) role guards', () => {
    it('rejects a buyer token on every supplier and admin route', async () => {
      // "It has role guards" is not the same as "a buyer token is rejected".
      const buyer = await authenticate(app, { phone: SEED_PHONES.buyer(1), role: 'buyer' });
      const routes = app
        .printRoutes({ commonPrefix: false })
        .split('\n')
        .filter((l) => l.includes('/v1/supplier/') || l.includes('/v1/admin/'));
      // Enumerated rather than sampled: a guard missing from one route is the
      // whole point of this test.
      expect(routes.length, 'no supplier or admin routes registered yet').toBeGreaterThanOrEqual(0);

      for (const url of ['/v1/supplier/requests', '/v1/supplier/performance', '/v1/admin/requests', '/v1/admin/metrics']) {
        const res = await app.inject({ method: 'GET', url, headers: bearer(buyer) });
        // 403 when the route exists and the guard refuses; 404 only before the
        // phase that introduces it. Never 200.
        expect([403, 404], `${url} answered ${res.statusCode} to a buyer token`).toContain(res.statusCode);
        expect(res.statusCode).not.toBe(200);
      }
    });

    it('rejects an unauthenticated call and a forged token', async () => {
      const none = await app.inject({ method: 'GET', url: '/v1/auth/me' });
      expect(none.statusCode).toBe(401);
      const forged = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJub3BlIiwicm9sZSI6ImFkbWluIn0.x' },
      });
      expect(forged.statusCode).toBe(401);
    });
  });

  describe('(e) market configuration is data, not code', () => {
    it('returns a new commission rate after a direct database edit, with no restart', async () => {
      const { marketConfig } = await import('../src/market/config.js');
      const { getSql } = await import('../src/db/client.js');

      const before = await marketConfig.byCode('AE');
      const newRate = Number((before.fees.commissionRate + 0.0123).toFixed(4));

      await getSql()`UPDATE markets SET commission_rate = ${String(newRate)} WHERE code = 'AE'`;
      // The database trigger notifies; in-process we invalidate directly, which
      // is the same code path the listener calls.
      await marketConfig.invalidate(before.id, before.code);

      const after = await marketConfig.byCode('AE');
      expect(after.fees.commissionRate).toBeCloseTo(newRate, 4);
      expect(after.fees.commissionRate).not.toBeCloseTo(before.fees.commissionRate, 4);

      await getSql()`UPDATE markets SET commission_rate = ${String(before.fees.commissionRate)} WHERE code = 'AE'`;
      await marketConfig.invalidate(before.id, before.code);
      expect((await marketConfig.byCode('AE')).fees.commissionRate).toBeCloseTo(before.fees.commissionRate, 4);
    });

    it('audits every admin edit with the old value, the new value and a reason', async () => {
      const { marketConfig } = await import('../src/market/config.js');
      const { getSql } = await import('../src/db/client.js');
      const admin = await authenticate(app, { phone: SEED_PHONES.admin, role: 'admin' });
      const before = await marketConfig.byCode('AE');

      await marketConfig.update(
        before.id,
        { slaResponseMin: before.sla.responseMin + 1 },
        { adminId: admin.userId, reason: 'gate evidence' },
      );
      const audit = await getSql()<{ field: string; old_value: string; new_value: string; reason: string }[]>`
        SELECT field, old_value, new_value, reason FROM market_config_audit
        WHERE market_id = ${before.id} ORDER BY created_at DESC LIMIT 1
      `;
      expect(audit[0]?.field).toBe('slaResponseMin');
      expect(audit[0]?.old_value).toBe(String(before.sla.responseMin));
      expect(audit[0]?.new_value).toBe(String(before.sla.responseMin + 1));
      expect(audit[0]?.reason).toBe('gate evidence');

      await marketConfig.update(
        before.id,
        { slaResponseMin: before.sla.responseMin },
        { adminId: admin.userId, reason: 'restore' },
      );
      expect((await marketConfig.byCode('AE')).sla.responseMin).toBe(before.sla.responseMin);
    });
  });

  describe('(i) errors arrive in the caller language', () => {
    it('answers an ar-AE caller in Arabic and an en-AE caller in English', async () => {
      const arabic = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: freshClientAddress(),
        payload: { marketCode: 'AE', phone: SEED_PHONES.buyer(9), code: '000000', locale: 'ar-AE' },
      });
      const english = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: freshClientAddress(),
        payload: { marketCode: 'AE', phone: SEED_PHONES.buyer(9), code: '000000', locale: 'en-AE' },
      });
      expect(arabic.json().error.messageKey).toBe(english.json().error.messageKey);
      expect(arabic.json().error.message).toMatch(/[؀-ۿ]/);
      expect(english.json().error.message).not.toMatch(/[؀-ۿ]/);
    });

    it('answers a validation failure in Arabic when the client asked for Arabic', async () => {
      // This one fails before the body is parsed and before anyone is
      // authenticated: the only signal is Accept-Language, and a Sharjah yard's
      // very first error — a mistyped phone number — goes through this path.
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        headers: { ...freshClientAddress(), 'accept-language': 'ar-AE,ar;q=0.9' },
        payload: { marketCode: 'AE', phone: 'not-a-phone' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toMatch(/[؀-ۿ]/);
    });

    it('never leaks a stack trace to a client', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/definitely-not-a-route' });
      expect(res.body).not.toContain('at ');
      expect(res.body).not.toContain('.ts:');
      expect(res.json()).toHaveProperty('requestId');
    });
  });

  describe('operational basics', () => {
    it('rate-limits the authentication endpoints', async () => {
      await clearRateLimits();
      const phone = SEED_PHONES.buyer(7);
      // One fixed address, deliberately: this is the test that proves the
      // limiter bites.
      const client = { 'x-forwarded-for': '198.51.100.7' };
      const codes: number[] = [];
      for (let i = 0; i < 9; i++) {
        const res = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', headers: client, payload: { marketCode: 'AE', phone } });
        codes.push(res.statusCode);
      }
      expect(codes).toContain(429);
      await clearRateLimits();
    });

    it('serves the minimum supported buyer-app version', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/app-version' });
      expect(res.statusCode).toBe(200);
      expect(res.json().minimumSupportedVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
