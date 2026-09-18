import { z } from 'zod';

/**
 * Environment.
 *
 * Every variable is declared here with an explicit shape, and the process
 * refuses to start if one is missing or malformed. A service that boots with a
 * half-configured environment fails later, in production, under load.
 *
 * Note what is NOT here: no rate, no currency, no SLA, no locale. Those are
 * market configuration and live in the database, because they change per market
 * and per admin edit, not per deployment.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  /**
   * Namespace for every Redis key this deployment owns: config cache, rate
   * limits, ping budgets and the timer queues. Two deployments sharing one Redis
   * — a test run beside a development server, or two markets pinned to
   * different regions — must not share a cache entry keyed by a UUID that means
   * something different in each database.
   */
  REDIS_NAMESPACE: z.string().min(1).default('ninety'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),

  /** Media. S3-compatible in every deployed environment; local disk for tests. */
  MEDIA_DRIVER: z.enum(['s3', 'local']).default('local'),
  MEDIA_LOCAL_DIR: z.string().default('.media'),
  MEDIA_PUBLIC_BASE_URL: z.string().default('http://localhost:3000/media'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  /** Payments. The provider used is resolved per market from the database. */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  /** Push. Web push for the terminal, native push for the buyer app. */
  FCM_SERVER_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  /**
   * Minimum supported buyer-app version. The app blocks below this and prompts
   * to update — built now because the first breaking API change strands exactly
   * the users who cannot be told to update.
   */
  MIN_BUYER_APP_VERSION: z.string().default('1.0.0'),

  /** In development the OTP is logged rather than sent. Never enable in production. */
  OTP_ECHO_IN_RESPONSE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /** Compresses long waits in tests: 1 means real time. */
  TIMER_SPEED_FACTOR: z.coerce.number().positive().default(1),

  /**
   * Database connections and timer workers, sized together on purpose.
   *
   * Every timer job holds a connection for the length of its work, so a worker
   * concurrency above the pool size buys nothing but queueing inside the pool.
   * Both are here rather than in code because the right numbers depend on the
   * database the deployment actually has, which the code cannot know.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),
  TIMER_CONCURRENCY: z.coerce.number().int().positive().default(20),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`invalid environment:\n${detail}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.OTP_ECHO_IN_RESPONSE) {
    throw new Error('OTP_ECHO_IN_RESPONSE must not be enabled in production');
  }
  return parsed.data;
}

export function env(): Env {
  if (cached === null) cached = loadEnv();
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
