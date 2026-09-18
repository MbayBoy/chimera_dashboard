import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Drizzle and raw postgres-js share one client, and Drizzle rewrites the
 * timestamp serialiser when it initialises. This is the regression test for
 * that interaction: it failed as "The string argument must be of type string —
 * received an instance of Date", from a query that had nothing to do with
 * Drizzle, only after an unrelated Drizzle query had run first.
 */
describe('timestamps survive a Drizzle query on the shared client', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://ninety@localhost:5432/ninety_test';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    process.env.REDIS_NAMESPACE = 'ninety-test';
    process.env.JWT_SECRET = 'test-access-secret-not-used-anywhere-else';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-used-anywhere-else';
  });

  afterAll(async () => {
    const { closeDb } = await import('./client.js');
    await closeDb();
  });

  it('accepts a Date in a raw template both before and after Drizzle initialises', async () => {
    const { getSql, getDb } = await import('./client.js');
    const sql = getSql();

    const before = await sql<{ t: Date }[]>`SELECT ${new Date('2026-03-01T09:15:00Z')}::timestamptz AS t`;
    expect(before[0]!.t.toISOString()).toBe('2026-03-01T09:15:00.000Z');

    // Initialising Drizzle is what used to break the client for raw templates.
    const { markets } = await import('./schema.js');
    await getDb().select({ code: markets.code }).from(markets).limit(1);

    const after = await sql<{ t: Date }[]>`SELECT ${new Date('2026-03-01T09:15:00Z')}::timestamptz AS t`;
    expect(after[0]!.t.toISOString()).toBe('2026-03-01T09:15:00.000Z');
  });

  it('still lets Drizzle round-trip its own timestamps', async () => {
    const { getDb } = await import('./client.js');
    const { markets } = await import('./schema.js');
    const rows = await getDb().select({ createdAt: markets.createdAt }).from(markets).limit(1);
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
  });
});
