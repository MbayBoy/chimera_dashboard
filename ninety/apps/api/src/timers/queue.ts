import { Queue, Worker, type Job, type JobsOptions } from 'bullmq';
import { makeQueueConnection } from '../core/redis.js';
import { key } from '../core/keys.js';
import { log } from '../core/logger.js';

/**
 * The clock.
 *
 * Every deadline in this product is a Redis delayed job, scheduled the moment
 * the state is entered, carrying the request id and the state it expects to
 * find. On fire the job re-reads the current state and no-ops if the request has
 * moved on — which makes it idempotent and restart-safe for free.
 *
 * It is NOT a cron sweep over the requests table. A sweep passes every
 * functional test and falls behind exactly when traffic is highest, which is
 * when suppliers lose jobs they answered in time and stop trusting the platform.
 * The 15/30/90 promise is the product; this is how it survives load.
 *
 * A 60-second reconciliation sweep runs alongside as a safety net for jobs lost
 * to a Redis outage. Belt and braces, deliberately.
 */

export const TIMER_QUEUE = 'timers';

export type TimerKind =
  | 'response-deadline'
  | 'offers-deadline'
  | 'widening-deadline'
  | 'selection-deadline'
  | 'delivery-deadline'
  | 'auto-confirm'
  | 'courier-no-driver'
  | 'authorisation-stale';

export interface TimerPayload {
  readonly kind: TimerKind;
  readonly requestId: string;
  readonly orderId?: string;
  readonly deliveryId?: string;
  /** The state this job expects to act on. Anything else is a no-op. */
  readonly expectedStates: readonly string[];
  /** When it was meant to fire, for lateness measurement. */
  readonly dueAt: string;
}

let queue: Queue<TimerPayload> | null = null;

export function getTimerQueue(): Queue<TimerPayload> {
  if (queue === null) {
    queue = new Queue<TimerPayload>(TIMER_QUEUE, {
      connection: makeQueueConnection(),
      prefix: key('bull'),
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86_400 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    });
  }
  return queue;
}

/**
 * Schedule a deadline.
 *
 * The job id is derived from the kind and the request, so scheduling the same
 * deadline twice replaces rather than duplicates it — an admin extending a
 * window does not leave the original job armed behind it.
 */
export async function scheduleTimer(payload: TimerPayload, fireAt: Date): Promise<string> {
  const jobId = timerJobId(payload);
  // No speed factor here. The compression lives in core/clock.ts, applied to
  // the deadline itself, so the timer fires at the moment the API published
  // rather than at some private multiple of it.
  const delayMs = Math.max(0, fireAt.getTime() - Date.now());

  const q = getTimerQueue();
  // Remove any existing job with this id first: BullMQ keeps the original delay
  // when a job id already exists, which would silently ignore a rescheduled
  // deadline — the exact failure an admin extending a window would hit.
  await q.remove(jobId).catch(() => {});
  await q.add(payload.kind, payload, { jobId, delay: Math.round(delayMs) } satisfies JobsOptions);

  log.debug('timer scheduled', { jobId, kind: payload.kind, requestId: payload.requestId, fireAt: fireAt.toISOString(), delayMs });
  return jobId;
}

export async function cancelTimer(payload: Pick<TimerPayload, 'kind' | 'requestId'>): Promise<void> {
  await getTimerQueue()
    .remove(timerJobId(payload as TimerPayload))
    .catch(() => {});
}

export function timerJobId(payload: Pick<TimerPayload, 'kind' | 'requestId' | 'orderId' | 'deliveryId'>): string {
  const scope = payload.deliveryId ?? payload.orderId ?? payload.requestId;
  return `${payload.kind}:${scope}`;
}

/**
 * The matching queue.
 *
 * Separate from the timer queue so a backlog of deadlines cannot delay a new
 * request's fan-out, and vice versa — the two have very different shapes: one is
 * a steady trickle of scheduled work, the other is bursty and latency-critical.
 */
export const MATCHING_QUEUE = 'matching';

export interface MatchingPayload {
  readonly requestId: string;
  /**
   * Tier 1 is the fan-out at submission; tier 2 is the widening at T+15.
   *
   * Widening runs on this queue rather than inside the timer job on purpose. A
   * timer job's only obligation is to honour the deadline — transition the
   * request and arm the next one. Doing the tier-2 geo query and several
   * hundred fan-out rows inline holds a timer worker for as long as that takes,
   * and every other deadline due in the same second waits behind it.
   */
  readonly tier?: 1 | 2;
}

let matchingQueue: Queue<MatchingPayload> | null = null;

export function getMatchingQueue(): Queue<MatchingPayload> {
  if (matchingQueue === null) {
    matchingQueue = new Queue<MatchingPayload>(MATCHING_QUEUE, {
      connection: makeQueueConnection(),
      prefix: key('bull'),
      defaultJobOptions: {
        removeOnComplete: { age: 600, count: 2000 },
        removeOnFail: { age: 86_400 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    });
  }
  return matchingQueue;
}

export async function closeTimerQueue(): Promise<void> {
  if (queue !== null) {
    await queue.close();
    queue = null;
  }
  if (matchingQueue !== null) {
    await matchingQueue.close();
    matchingQueue = null;
  }
}

export type TimerJob = Job<TimerPayload>;
export { Worker };
