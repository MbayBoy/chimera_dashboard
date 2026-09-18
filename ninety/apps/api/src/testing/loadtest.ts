import '../load-env.js';
import { performance } from 'node:perf_hooks';
import { closeDb, getSql } from '../db/client.js';
import { closeRedis, getRedis } from '../core/redis.js';
import { key } from '../core/keys.js';
import { log } from '../core/logger.js';
import { loadTerminalPhone, seedLoadTerminals } from './seed-load.js';

/**
 * Load test.
 *
 * Phase 07 asks for 500 concurrent requests fanning out, 200 terminals on a
 * WebSocket, no dropped timers, no deadline fired late, and p50/p95/p99 for
 * request creation and offer submission.
 *
 * Two things this deliberately does NOT do, because both would make the result
 * a lie:
 *
 *  - It does not issue the requests sequentially and call the total "concurrency".
 *    They go out in waves against one server, contending for the same pool.
 *  - It does not seed offers directly into the database. Offers go through the
 *    real endpoint, so the row locks, the state machine and the score writes are
 *    all under contention too.
 *
 * Run it against a server that is already running:
 *
 *   pnpm --filter @ninety/api loadtest -- --requests 500 --terminals 200
 */

interface Options {
  readonly apiBase: string;
  readonly requests: number;
  readonly terminals: number;
  readonly marketCode: string;
}

function parseOptions(argv: readonly string[]): Options {
  const value = (flag: string, fallback: string) => {
    const index = argv.indexOf(`--${flag}`);
    return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1]! : fallback;
  };
  return {
    apiBase: value('api', process.env.LOADTEST_API ?? 'http://localhost:3000'),
    requests: Number(value('requests', '500')),
    terminals: Number(value('terminals', '200')),
    marketCode: value('market', 'AE'),
  };
}

interface Timing {
  readonly ms: number;
  readonly ok: boolean;
  readonly status: number;
  /** Kept for failures only: a percentile with no reason attached is not a result. */
  readonly detail?: string;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index]!);
}

function report(name: string, timings: readonly Timing[]): void {
  const ok = timings.filter((t) => t.ok);
  const durations = ok.map((t) => t.ms);
  const failures = timings.length - ok.length;
  console.log(
    [
      `  ${name.padEnd(22)}`,
      `n=${String(timings.length).padStart(5)}`,
      `ok=${String(ok.length).padStart(5)}`,
      `failed=${String(failures).padStart(4)}`,
      `p50=${String(percentile(durations, 50)).padStart(5)}ms`,
      `p95=${String(percentile(durations, 95)).padStart(5)}ms`,
      `p99=${String(percentile(durations, 99)).padStart(5)}ms`,
      `max=${String(Math.round(Math.max(0, ...durations))).padStart(5)}ms`,
    ].join('  '),
  );
  if (failures > 0) {
    const byStatus = new Map<number, number>();
    for (const t of timings.filter((x) => !x.ok)) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
    console.log(`    failures by status: ${[...byStatus].map(([s, n]) => `${s}×${n}`).join(', ')}`);
    const reasons = new Set(timings.filter((x) => !x.ok && x.detail !== undefined).map((x) => x.detail!));
    for (const reason of [...reasons].slice(0, 3)) console.log(`    reason: ${reason}`);
  }
}

async function timed(fn: () => Promise<Response>): Promise<Timing> {
  const started = performance.now();
  try {
    const response = await fn();
    // Drain the body, or the socket is held and the next measurement is wrong.
    const body = await response.text();
    return {
      ms: performance.now() - started,
      ok: response.ok,
      status: response.status,
      detail: response.ok ? undefined : body.slice(0, 200),
    };
  } catch {
    return { ms: performance.now() - started, ok: false, status: 0 };
  }
}

async function authenticate(options: Options, phone: string, role: string): Promise<string> {
  const request = await fetch(`${options.apiBase}/v1/auth/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': randomIp() },
    body: JSON.stringify({ marketCode: options.marketCode, phone }),
  });
  const { devCode } = (await request.json()) as { devCode?: string };
  if (devCode === undefined) throw new Error(`no dev OTP for ${phone}; set OTP_ECHO_IN_RESPONSE=true`);
  const verify = await fetch(`${options.apiBase}/v1/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': randomIp() },
    body: JSON.stringify({ marketCode: options.marketCode, phone, code: devCode, role }),
  });
  const body = (await verify.json()) as { accessToken?: string };
  if (body.accessToken === undefined) throw new Error(`could not authenticate ${role} ${phone}`);
  return body.accessToken;
}

/**
 * A nonce built from a fixed syllable set.
 *
 * Neither a digit run nor a letter run: random digits eventually look like a
 * phone number to the contact scrubber, and random letters eventually contain a
 * messaging-app handle. Both rejections are the scrubber working correctly, and
 * neither is a load-test result.
 */
const SYLLABLES = ['ka', 'ro', 'mi', 'ta', 'ne', 'su', 'lo', 've', 'du', 'pa', 'zi', 'fe'] as const;

function nonce(): string {
  return Array.from({ length: 4 }, () => SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)]!).join('');
}

/**
 * The index in the same syllable alphabet.
 *
 * Base-26 letters looked safe and was not: the 158th request came out as "fb",
 * which the contact scrubber correctly reads as a Facebook handle and rejects.
 */
function syllables(n: number): string {
  let out = '';
  let value = n;
  do {
    out = SYLLABLES[value % SYLLABLES.length]! + out;
    value = Math.floor(value / SYLLABLES.length);
  } while (value > 0);
  return out;
}

/** Rate limits are per caller; a load test is one machine pretending to be many. */
function randomIp(): string {
  return `198.51.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

interface Terminal {
  readonly token: string;
  readonly socket: WebSocket;
  pings: number;
}

/**
 * Two hundred terminals, each on its own WebSocket, each authenticated as its
 * own yard. Counting the pings they receive is the only honest way to know the
 * fan-out actually reached a screen rather than only a database row.
 */
async function openTerminals(options: Options): Promise<Terminal[]> {
  const wsBase = options.apiBase.replace(/^http/, 'ws');
  const terminals: Terminal[] = [];
  const batch = 25;
  for (let i = 0; i < options.terminals; i += batch) {
    const slice = await Promise.all(
      Array.from({ length: Math.min(batch, options.terminals - i) }, async (_unused, j) => {
        const token = await authenticate(options, loadTerminalPhone(i + j), 'supplier');
        const socket = new WebSocket(`${wsBase}/v1/supplier/stream?token=${encodeURIComponent(token)}`);
        const terminal: Terminal = { token, socket, pings: 0 };
        socket.addEventListener('message', (event: MessageEvent) => {
          const text = typeof event.data === 'string' ? event.data : '';
          if (text.includes('"new_request"')) terminal.pings += 1;
        });
        await new Promise<void>((resolve, reject) => {
          socket.addEventListener('open', () => { resolve(); });
          socket.addEventListener('error', () => { reject(new Error('socket refused')); });
        });
        return terminal;
      }),
    );
    terminals.push(...slice);
  }
  return terminals;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  console.log(`\nNINETY load test — ${options.requests} concurrent requests, ${options.terminals} terminals\n`);

  await seedLoadTerminals(options.terminals, options.marketCode, (s) => { console.log(`  ${s}`); });

  const buyerToken = await authenticate(options, '+9998000001', 'buyer');
  const categories = (await (
    await fetch(`${options.apiBase}/v1/part-categories`, { headers: { authorization: `Bearer ${buyerToken}` } })
  ).json()) as { categories: { id: string; code: string }[] };
  const category = categories.categories.find((c) => c.code.startsWith('lighting.tail_lamp'))!;

  console.log(`connecting ${options.terminals} terminals…`);
  const terminals = await openTerminals(options);
  console.log(`  ${terminals.length} terminals on a socket`);

  const cleared = await clearPingBudgets();
  console.log(`  cleared ${cleared} hourly ping budgets`);

  const before = await queueDepth();
  // Everything measured below is scoped to this run. A previous run's rows in
  // the same database would otherwise be averaged into the percentiles.
  const runStartedAt = new Date();

  console.log('creating requests…');
  const started = Date.now();
  const creations = await Promise.all(
    Array.from({ length: options.requests }, (_, i) =>
      timed(() =>
        fetch(`${options.apiBase}/v1/requests`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${buyerToken}`,
            'x-forwarded-for': randomIp(),
          },
          body: JSON.stringify({
            vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
            partCategoryId: category.id,
            // Unique per request: duplicate detection is doing its job and would
            // otherwise reject 499 of these, which would measure nothing.
            // Letters only, no digits. A random digit run long enough to look
            // like a phone number is rejected by the contact scrubber — which is
            // the scrubber working, not a load-test result.
            partDescription: `Load test job ${syllables(i)} ${nonce()}`,
            conditionAccepted: ['used', 'refurbished'],
            quantity: 1,
            deliveryLocation: { lat: 25.1499 + (Math.random() - 0.5) * 0.08, lng: 55.2416 + (Math.random() - 0.5) * 0.08 },
            deliveryAddress: {},
            submit: true,
          }),
        }),
      ),
    ),
  );
  const creationWallMs = Date.now() - started;

  console.log('waiting for the fan-out queue to drain…');
  const drained = await waitForQueue(before, 120_000);

  console.log('submitting offers from the terminals…');
  const offers = await submitOffers(options, terminals);

  console.log('waiting for the response-window timers to fire…');
  const settled = await waitForDeadlines(runStartedAt, 600_000);
  const lateness = await timerLateness(runStartedAt);

  const timers = await timerHealth(runStartedAt);
  const pings = terminals.reduce((n, t) => n + t.pings, 0);

  console.log('\nresults\n');
  report('request creation', creations);
  report('offer submission', offers);
  console.log(
    `\n  wall clock:        ${creationWallMs}ms for ${options.requests} requests ` +
      `(${Math.round((options.requests / creationWallMs) * 1000)}/s)`,
  );
  console.log(`  fan-out drained:   ${drained ? 'yes' : 'NO — the queue did not empty in 120s'}`);
  console.log(`  requests fanned:   ${timers.fannedOut}`);
  console.log(`  suppliers pinged:  ${timers.fanouts}`);
  console.log(`  socket pings seen: ${pings}`);
  console.log(`  timers settled:    ${settled ? 'yes' : 'NO — requests still open past their deadline'}`);
  console.log(`  timer fires:       ${lateness.fired}`);
  console.log(
    `  timer lateness:    p50=${lateness.p50}ms  p95=${lateness.p95}ms  max=${lateness.max}ms ` +
      `(tolerance ${LATE_TOLERANCE_MS}ms)`,
  );
  console.log(`  fired late:        ${lateness.late}`);
  console.log(`  stuck in MATCHING: ${timers.stuckMatching}`);
  console.log(`  deadlines late:    ${timers.lateDeadlines}`);
  console.log(`  no deadline set:   ${timers.missingDeadline}`);

  const passed =
    drained &&
    timers.stuckMatching === 0 &&
    timers.lateDeadlines === 0 &&
    timers.missingDeadline === 0 &&
    settled &&
    lateness.late === 0 &&
    creations.filter((c) => !c.ok).length === 0 &&
    offers.filter((o) => !o.ok).length === 0;

  console.log(`\n  ${passed ? 'PASS' : 'FAIL'} — no dropped timers, no deadline fired late\n`);

  for (const t of terminals) t.socket.close();
  await closeDb();
  await closeRedis();
  process.exit(passed ? 0 : 1);
}

/**
 * Every terminal reads its own queue and quotes the first job it has not quoted
 * yet. Real endpoint, so the row locks, the state machine and the score writes
 * are all under the same contention as the creations were.
 */
async function submitOffers(options: Options, terminals: readonly Terminal[]): Promise<Timing[]> {
  const results = await Promise.all(
    terminals.map(async (terminal) => {
      const listed = await fetch(`${options.apiBase}/v1/supplier/requests`, {
        headers: { authorization: `Bearer ${terminal.token}`, 'x-forwarded-for': randomIp() },
      });
      if (!listed.ok) return [] as Timing[];
      const body = (await listed.json()) as { requests: { requestId: string; alreadyOffered: boolean }[] };
      const job = body.requests.find((r) => !r.alreadyOffered);
      if (job === undefined) return [] as Timing[];
      const timing = await timed(() =>
        fetch(`${options.apiBase}/v1/supplier/requests/${job.requestId}/offer`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${terminal.token}`,
            'x-forwarded-for': randomIp(),
          },
          body: JSON.stringify({
            price: String(150 + Math.floor(Math.random() * 400)),
            condition: 'used',
            warrantyDays: 30,
            readyInMin: 45,
          }),
        }),
      );
      return [timing];
    }),
  );
  return results.flat();
}

/**
 * A timer is "late" when the transition it owns landed measurably after the
 * deadline the buyer was shown. A second of scheduler jitter is not a broken
 * promise; ten is, because the buyer is watching a countdown reach zero.
 */
const LATE_TOLERANCE_MS = 3_000;

interface Lateness {
  fired: number;
  late: number;
  p50: number;
  p95: number;
  max: number;
}

/**
 * Measured against the deadline the API itself published, not against the
 * moment the test decided to start counting. That is the only version of "on
 * time" the buyer can see.
 */
async function timerLateness(since: Date): Promise<Lateness> {
  const rows = await getSql()<{ late_ms: string }[]>`
    SELECT extract(epoch FROM (t.created_at - r.response_deadline)) * 1000 AS late_ms
    FROM request_state_transitions t
    JOIN requests r ON r.id = t.request_id
    WHERE t.actor_type = 'timer'
      AND t.from_state = 'AWAITING_OFFERS'
      AND r.response_deadline IS NOT NULL
      AND t.created_at >= ${since}
  `;
  const values = rows.map((r) => Number(r.late_ms)).filter((n) => Number.isFinite(n));
  return {
    fired: values.length,
    late: values.filter((n) => n > LATE_TOLERANCE_MS).length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.round(Math.max(0, ...values)),
  };
}

/**
 * Every request created by this run has left the two states a fan-out deadline
 * governs. COLLECTING_OFFERS is deliberately not one of them: a request sitting
 * there is waiting for the buyer inside the selection window, which is not a
 * timer this test is measuring and not a fault.
 *
 * Scoped to this run, and it waits for the states to be *left* rather than for
 * the deadlines to merely be in the past. Checking "nothing is overdue" passes
 * instantly while every deadline is still in the future, which is how a broken
 * timer would sail through this test.
 */
async function waitForDeadlines(since: Date, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let last = -1;
  while (Date.now() < deadline) {
    const rows = await getSql()<{ n: string }[]>`
      SELECT count(*)::text AS n FROM requests
      WHERE submitted_at >= ${since}
        AND status IN ('AWAITING_OFFERS', 'WIDENING')
    `;
    const open = Number(rows[0]?.n ?? '0');
    if (open === 0) return true;
    if (open !== last) {
      process.stdout.write(`  ${open} still open…\r`);
      last = open;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Suppliers are capped at a fixed number of pings an hour so the product cannot
 * spam a yard into ignoring it. A load test that leaves the counters alone
 * measures that cap and nothing else: the second run of five hundred requests
 * fans out to nobody. Cleared here deliberately, and only here.
 */
async function clearPingBudgets(): Promise<number> {
  const redis = getRedis();
  const keys = await redis.keys(`${key('ping')}:*`);
  if (keys.length > 0) await redis.del(...keys);
  return keys.length;
}

async function queueDepth(): Promise<number> {
  const rows = await getSql()<{ n: string }[]>`SELECT count(*)::text AS n FROM requests WHERE status = 'MATCHING'`;
  return Number(rows[0]?.n ?? '0');
}

async function waitForQueue(_before: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await queueDepth()) === 0) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

interface TimerHealth {
  fannedOut: number;
  fanouts: number;
  stuckMatching: number;
  lateDeadlines: number;
  missingDeadline: number;
}

async function timerHealth(since: Date): Promise<TimerHealth> {
  const rows = await getSql()<
    { fanned: string; fanouts: string; stuck: string; late: string; missing: string }[]
  >`
    SELECT
      (SELECT count(*) FROM requests WHERE status <> 'MATCHING' AND submitted_at >= ${since})::text AS fanned,
      (SELECT count(*) FROM request_fanouts WHERE sent_at >= ${since})::text AS fanouts,
      (SELECT count(*) FROM requests WHERE status = 'MATCHING' AND submitted_at < now() - interval '30 seconds')::text AS stuck,
      -- A deadline that has passed while the request is still in the state that
      -- deadline governs: the exact failure a polling sweep produces under load.
      (SELECT count(*) FROM requests
        WHERE status = 'AWAITING_OFFERS' AND response_deadline < now() - interval '15 seconds')::text AS late,
      (SELECT count(*) FROM requests
        WHERE status = 'AWAITING_OFFERS' AND response_deadline IS NULL)::text AS missing
  `;
  const row = rows[0]!;
  return {
    fannedOut: Number(row.fanned),
    fanouts: Number(row.fanouts),
    stuckMatching: Number(row.stuck),
    lateDeadlines: Number(row.late),
    missingDeadline: Number(row.missing),
  };
}

main().catch(async (err) => {
  log.error('load test failed', { err: err instanceof Error ? err.message : String(err) });
  console.error(err);
  await closeDb();
  await closeRedis();
  process.exit(1);
});
