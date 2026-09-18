import type { FastifyInstance } from 'fastify';
import { execSync } from 'node:child_process';

/**
 * Test harness.
 *
 * Runs against a real PostgreSQL with PostGIS and a real Redis, not against
 * fakes. Matching is a geo query, the clock is a Redis delayed job, and money
 * reconciles through database constraints — none of that is exercised by a mock,
 * and all three are the parts that must not be wrong.
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://ninety@localhost:5432/ninety_test';

export function useTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
  // A namespace of its own, so a test run never reads a development server's
  // cached market configuration — whose UUIDs belong to a different database.
  process.env.REDIS_NAMESPACE = 'ninety-test';
  process.env.JWT_SECRET = 'test-access-secret-not-used-anywhere-else';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-used-anywhere-else';
  process.env.OTP_ECHO_IN_RESPONSE = 'true';
  process.env.MEDIA_DRIVER = 'local';
  process.env.MEDIA_LOCAL_DIR = '.media-test';
  process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'silent';
  process.env.MIN_BUYER_APP_VERSION = '1.0.0';
  // Compress the clock. Deadlines are still absolute timestamps computed from
  // the market's own SLA — only the delay before the job fires is divided, so
  // the 15/30/90 sequence is exercised in seconds rather than in an hour.
  process.env.TIMER_SPEED_FACTOR = process.env.TIMER_SPEED_FACTOR ?? '600';
}

let prepared = false;

/** Reset the test database to a migrated, seeded state. Runs once per file. */
export async function prepareDatabase(): Promise<void> {
  useTestEnvironment();
  if (prepared) return;
  const { resetDatabase } = await import('../src/db/migrate.js');
  const { seed } = await import('../src/db/seed.js');
  await resetDatabase(() => {});
  await seed(() => {});
  const { marketConfig } = await import('../src/market/config.js');
  await marketConfig.invalidateAll();
  prepared = true;
}

export interface TestServerOptions {
  /**
   * Start the timer and matching workers.
   *
   * On by default: the clock is the product, and a test server without it is
   * testing a different system. Turn it off only for tests that drive the
   * transitions by hand.
   */
  readonly workers?: boolean;
}

export async function buildTestServer(options: TestServerOptions = {}): Promise<FastifyInstance> {
  await prepareDatabase();
  const { buildServer } = await import('../src/server.js');
  const app = await buildServer();
  await app.ready();
  if (options.workers !== false) {
    const { startTimerWorkers } = await import('../src/timers/worker.js');
    await startTimerWorkers();
  }
  return app;
}

/** Drain the matching and timer queues so a test can assert on the result. */
export async function drainQueues(timeoutMs = 15_000): Promise<void> {
  const { getTimerQueue } = await import('../src/timers/queue.js');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const counts = await getTimerQueue().getJobCounts('active', 'waiting', 'delayed');
    if ((counts.active ?? 0) === 0 && (counts.waiting ?? 0) === 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

export interface TestSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly role: string;
  readonly locale: string;
}

/** Complete an OTP round trip and return a usable session. */
let ipCounter = 0;

/**
 * A distinct client address per call.
 *
 * Authentication is rate-limited per caller, correctly — but every in-process
 * injection otherwise shares one address, so a test file would throttle itself
 * and report a limiter bug as an auth bug. The limiter is exercised deliberately
 * in its own test, from a fixed address.
 */
export function freshClientAddress(): Record<string, string> {
  ipCounter += 1;
  return { 'x-forwarded-for': `203.0.113.${ipCounter % 250}`, 'x-test-client': String(ipCounter) };
}

export async function authenticate(
  app: FastifyInstance,
  opts: { phone: string; role: 'buyer' | 'supplier' | 'admin'; marketCode?: string; locale?: string },
): Promise<TestSession> {
  const marketCode = opts.marketCode ?? 'AE';
  const client = freshClientAddress();
  const request = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/request',
    headers: client,
    payload: { marketCode, phone: opts.phone, ...(opts.locale === undefined ? {} : { locale: opts.locale }) },
  });
  if (request.statusCode !== 202) {
    throw new Error(`OTP request failed for ${opts.phone}: ${request.statusCode} ${request.body}`);
  }
  const devCode = request.json().devCode as string;
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    headers: client,
    payload: {
      marketCode,
      phone: opts.phone,
      code: devCode,
      role: opts.role,
      ...(opts.locale === undefined ? {} : { locale: opts.locale }),
    },
  });
  if (verify.statusCode !== 200) {
    throw new Error(`authentication failed for ${opts.role}: ${verify.statusCode} ${verify.body}`);
  }
  const body = verify.json();
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    userId: body.user.id,
    role: body.user.role,
    locale: body.user.locale,
  };
}

export function bearer(session: TestSession): Record<string, string> {
  return { authorization: `Bearer ${session.accessToken}` };
}

/** Seeded phone numbers, in the synthetic +999 range so nothing real is reachable. */
export const SEED_PHONES = {
  supplier: (n: number) => `+999900${String(n).padStart(4, '0')}`,
  buyer: (n: number) => `+999800${String(n).padStart(4, '0')}`,
  admin: '+9997000001',
} as const;

/** Rate limits are per-IP and shared across tests in one Redis. Clear between files. */
export async function clearRateLimits(): Promise<void> {
  const { getRedis } = await import('../src/core/redis.js');
  const redis = getRedis();
  const keys = await redis.keys(`${process.env.REDIS_NAMESPACE ?? 'ninety'}:rl:*`);
  if (keys.length > 0) await redis.del(...keys);
}

export function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}
