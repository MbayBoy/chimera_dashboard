import { and, eq, isNotNull, lte, or } from 'drizzle-orm';
import { RequestState, toIsoUtc } from '@ninety/shared';
import {
  MATCHING_QUEUE,
  TIMER_QUEUE,
  Worker,
  closeTimerQueue,
  getMatchingQueue,
  getTimerQueue,
  scheduleTimer,
  type MatchingPayload,
  type TimerJob,
  type TimerPayload,
} from './queue.js';
import { makeQueueConnection } from '../core/redis.js';
import { getDb, getSql } from '../db/client.js';
import { requests } from '../db/schema.js';
import { log } from '../core/logger.js';
import { key } from '../core/keys.js';
import {
  onOffersDeadline,
  onResponseDeadline,
  onSelectionDeadline,
  onWideningDeadline,
  runMatching,
} from '../matching/hooks.js';

/**
 * Timer workers.
 *
 * Each job re-reads the current state before acting, so firing the same job
 * twice is indistinguishable from firing it once, and a job that arrives after
 * the world has moved on is a logged no-op rather than a corruption.
 *
 * Alongside them runs a 60-second reconciliation sweep. It exists for one
 * reason: a Redis outage loses delayed jobs, and the database still knows every
 * deadline that has passed. The sweep is a safety net, not the mechanism — it
 * reschedules or directly fires what the queue dropped.
 */

let worker: Worker<TimerPayload> | null = null;
let matchingWorker: Worker<MatchingPayload> | null = null;
let sweepHandle: NodeJS.Timeout | null = null;

/**
 * Enqueue matching for a submitted request.
 *
 * A workshop tapping POST on a shop floor gets their reference back immediately;
 * the geo query and the fan-out happen off the request. The job id is derived
 * from the request, so a retried submission cannot fan the same job out twice.
 */
export async function enqueueMatching(requestId: string): Promise<void> {
  await getMatchingQueue().add('match', { requestId }, { jobId: `match:${requestId}` });
}

async function handleTimer(job: TimerJob): Promise<void> {
  const { kind, requestId, dueAt } = job.data;
  const latenessMs = Date.now() - new Date(dueAt).getTime();
  if (latenessMs > 5000) {
    // Measured, not merely tolerated. A deadline firing late is the failure the
    // whole delayed-job design exists to prevent, so it is visible when it happens.
    log.warn('timer fired late', { kind, requestId, latenessMs });
  }

  switch (kind) {
    case 'response-deadline':
      await onResponseDeadline(requestId);
      return;
    case 'widening-deadline':
      await onWideningDeadline(requestId);
      return;
    case 'offers-deadline':
      await onOffersDeadline(requestId);
      return;
    case 'selection-deadline':
      await onSelectionDeadline(requestId);
      return;
    case 'auto-confirm': {
      const { autoConfirmDelivery } = await import('../logistics/service.js');
      await autoConfirmDelivery(requestId);
      return;
    }
    case 'courier-no-driver': {
      const { onNoDriverAssigned } = await import('../logistics/service.js');
      if (job.data.deliveryId !== undefined) await onNoDriverAssigned(job.data.deliveryId);
      return;
    }
    case 'delivery-deadline': {
      const { onDeliveryDeadline } = await import('../logistics/service.js');
      await onDeliveryDeadline(requestId);
      return;
    }
    case 'authorisation-stale': {
      const { onStaleAuthorisation } = await import('../payments/service.js');
      if (job.data.orderId !== undefined) await onStaleAuthorisation(job.data.orderId);
      return;
    }
    default:
      log.warn('unknown timer kind', { kind });
  }
}

export async function startTimerWorkers(): Promise<void> {
  if (worker !== null) return;

  worker = new Worker<TimerPayload>(TIMER_QUEUE, handleTimer, {
    connection: makeQueueConnection(),
    prefix: key('bull'),
    concurrency: 20,
  });
  worker.on('failed', (job, err) => {
    log.error('timer job failed', { jobId: job?.id, kind: job?.data.kind, requestId: job?.data.requestId, err: err.message });
  });

  matchingWorker = new Worker<MatchingPayload>(
    MATCHING_QUEUE,
    async (job) => {
      await runMatching(job.data.requestId);
    },
    { connection: makeQueueConnection(), prefix: key('bull'), concurrency: 20 },
  );
  matchingWorker.on('failed', (job, err) => {
    log.error('matching job failed', { jobId: job?.id, requestId: job?.data.requestId, err: err.message });
  });

  startReconciliationSweep();
  log.info('timer workers started');
}

/**
 * The safety net.
 *
 * Every 60 seconds, find requests whose deadline has passed while they are still
 * in the state that deadline governs, and act. Under normal operation this finds
 * nothing, because the delayed jobs fired on time; after a Redis restart it is
 * the difference between a few late jobs and a silently broken promise.
 */
export function startReconciliationSweep(intervalMs = 60_000): void {
  if (sweepHandle !== null) return;
  sweepHandle = setInterval(() => {
    void reconcileOverdueTimers().catch((err) => {
      log.error('reconciliation sweep failed', { err: err instanceof Error ? err.message : String(err) });
    });
  }, intervalMs);
  sweepHandle.unref?.();
}

export async function reconcileOverdueTimers(now: Date = new Date()): Promise<number> {
  const overdue = await getDb()
    .select({ id: requests.id, status: requests.status })
    .from(requests)
    .where(
      or(
        and(eq(requests.status, RequestState.MATCHING), isNotNull(requests.submittedAt)),
        and(eq(requests.status, RequestState.AWAITING_OFFERS), lte(requests.responseDeadline, now)),
        and(eq(requests.status, RequestState.WIDENING), lte(requests.wideningDeadline, now)),
        and(eq(requests.status, RequestState.COLLECTING_OFFERS), lte(requests.selectionDeadline, now)),
      ),
    )
    .limit(500);

  if (overdue.length === 0) return 0;
  log.warn('reconciliation sweep found overdue requests', { count: overdue.length });

  for (const row of overdue) {
    try {
      switch (row.status as RequestState) {
        case RequestState.MATCHING:
          await runMatching(row.id);
          break;
        case RequestState.AWAITING_OFFERS:
          await onResponseDeadline(row.id);
          break;
        case RequestState.WIDENING:
          await onWideningDeadline(row.id);
          break;
        case RequestState.COLLECTING_OFFERS:
          await onSelectionDeadline(row.id);
          break;
        default:
          break;
      }
    } catch (err) {
      log.error('reconciliation could not advance a request', {
        requestId: row.id,
        status: row.status,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return overdue.length;
}

/**
 * Re-arm delayed jobs for every live request.
 *
 * Run at start-up. A process that restarts must not leave its deadlines
 * unscheduled and depend on the sweep to notice — the sweep is a safety net with
 * a sixty-second granularity, and the promise is measured in minutes.
 */
export async function rearmTimers(): Promise<number> {
  const rows = await getSql()<
    { id: string; status: string; response_deadline: Date | null; offers_deadline: Date | null; widening_deadline: Date | null; selection_deadline: Date | null }[]
  >`
    SELECT id, status, response_deadline, offers_deadline, widening_deadline, selection_deadline
      FROM requests
     WHERE status IN (${RequestState.AWAITING_OFFERS}, ${RequestState.WIDENING}, ${RequestState.COLLECTING_OFFERS})
  `;
  let armed = 0;
  for (const row of rows) {
    if (row.status === RequestState.AWAITING_OFFERS && row.response_deadline !== null) {
      await scheduleTimer(
        { kind: 'response-deadline', requestId: row.id, expectedStates: [RequestState.AWAITING_OFFERS], dueAt: toIsoUtc(row.response_deadline) },
        row.response_deadline,
      );
      armed += 1;
    }
    if (row.status === RequestState.WIDENING && row.widening_deadline !== null) {
      await scheduleTimer(
        { kind: 'widening-deadline', requestId: row.id, expectedStates: [RequestState.WIDENING], dueAt: toIsoUtc(row.widening_deadline) },
        row.widening_deadline,
      );
      armed += 1;
    }
    if (row.status === RequestState.COLLECTING_OFFERS && row.selection_deadline !== null) {
      await scheduleTimer(
        { kind: 'selection-deadline', requestId: row.id, expectedStates: [RequestState.COLLECTING_OFFERS], dueAt: toIsoUtc(row.selection_deadline) },
        row.selection_deadline,
      );
      armed += 1;
    }
  }
  if (armed > 0) log.info('re-armed timers after start-up', { armed });
  return armed;
}

export async function stopTimerWorkers(): Promise<void> {
  if (sweepHandle !== null) {
    clearInterval(sweepHandle);
    sweepHandle = null;
  }
  await worker?.close();
  await matchingWorker?.close();
  worker = null;
  matchingWorker = null;
  await closeTimerQueue();
}

export { getTimerQueue };
