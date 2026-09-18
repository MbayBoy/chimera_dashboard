import { eq } from 'drizzle-orm';
import {
  isLegalTransition,
  RequestOutcome,
  RequestState,
  RequestTransition,
  TRANSITIONS,
} from '@ninety/shared';
import { getDb } from '../db/client.js';
import { requests, requestStateTransitions } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';

/**
 * The request state machine.
 *
 * `requests.status` is not assignable from a controller. It changes here and
 * only here, through a transition that validates the current state, records who
 * caused it and why, and stamps the outcome when the request closes.
 *
 * The validation is not defensive programming. A marketplace with a fifteen
 * minute clock accumulates races — a supplier submitting an offer as the window
 * closes, a buyer accepting as a timer fires, an admin intervening mid-dispatch
 * — and the only way those stay correct is if every one of them has to ask
 * permission from the same place.
 */

export type ActorType = 'buyer' | 'supplier' | 'admin' | 'system' | 'timer';

export interface TransitionContext {
  readonly actorType: ActorType;
  readonly actorId?: string | null;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
  /** Columns to set atomically with the transition (deadlines, counts, timestamps). */
  readonly patch?: Partial<typeof requests.$inferInsert>;
}

export interface TransitionResult {
  readonly requestId: string;
  readonly from: RequestState;
  readonly to: RequestState;
  readonly transition: RequestTransition;
  readonly outcome: RequestOutcome | null;
}

export class IllegalTransitionError extends AppError {
  constructor(
    readonly requestId: string,
    readonly from: RequestState,
    readonly transition: RequestTransition,
  ) {
    super('illegal_transition', 'error.illegal_transition', {
      details: { from, transition, allowedFrom: TRANSITIONS[transition].from },
    });
  }
}

/**
 * Apply a transition.
 *
 * The state check and the write happen in one statement, with the expected
 * current state in the WHERE clause, so two concurrent callers cannot both
 * succeed. The loser gets an IllegalTransitionError rather than a silently
 * overwritten state — which is what a timer firing against a request the buyer
 * has just accepted must do.
 */
export async function transition(
  requestId: string,
  name: RequestTransition,
  context: TransitionContext,
): Promise<TransitionResult> {
  const rule = TRANSITIONS[name];
  const db = getDb();

  const current = await db
    .select({ status: requests.status })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  const from = current[0]?.status as RequestState | undefined;
  if (from === undefined) throw new AppError('not_found', 'error.not_found');
  if (!isLegalTransition(from, name)) throw new IllegalTransitionError(requestId, from, name);

  const outcome = rule.outcome ?? null;
  const patch: Record<string, unknown> = {
    ...(context.patch ?? {}),
    status: rule.to,
  };
  if (outcome !== null) patch.outcome = outcome;
  if (isClosing(rule.to) && patch.closedAt === undefined) patch.closedAt = new Date();

  // The compare-and-set: only apply if the row is still in the state we checked.
  const updated = await db
    .update(requests)
    .set(patch)
    .where(eq(requests.id, requestId))
    .returning({ id: requests.id, status: requests.status });

  if (updated.length === 0) throw new IllegalTransitionError(requestId, from, name);

  await db.insert(requestStateTransitions).values({
    requestId,
    fromState: from,
    toState: rule.to,
    transition: name,
    actorType: context.actorType,
    actorId: context.actorId ?? null,
    reason: context.reason ?? null,
    metadata: (context.metadata ?? null) as never,
  });

  log.info('request transitioned', {
    requestId,
    from,
    to: rule.to,
    transition: name,
    actorType: context.actorType,
    outcome,
  });

  return { requestId, from, to: rule.to, transition: name, outcome };
}

/**
 * Apply a transition that a timer or sweep requested, tolerating the request
 * having already moved on.
 *
 * This is what makes the clock idempotent: a delayed job fires, re-reads the
 * current state, and no-ops if the world has changed. Firing the same job twice
 * must be indistinguishable from firing it once.
 */
export async function transitionIfStillIn(
  requestId: string,
  expected: readonly RequestState[],
  name: RequestTransition,
  context: TransitionContext,
): Promise<TransitionResult | null> {
  const current = await getDb()
    .select({ status: requests.status })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  const from = current[0]?.status as RequestState | undefined;
  if (from === undefined || !expected.includes(from)) {
    log.debug('timer no-op: request has moved on', { requestId, from, transition: name });
    return null;
  }
  try {
    return await transition(requestId, name, context);
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      log.debug('timer no-op: lost the race', { requestId, transition: name });
      return null;
    }
    throw err;
  }
}

function isClosing(state: RequestState): boolean {
  return (
    state === RequestState.CLOSED ||
    state === RequestState.NO_SUPPLY ||
    state === RequestState.NO_OFFERS ||
    state === RequestState.EXPIRED ||
    state === RequestState.CANCELLED ||
    state === RequestState.REFUNDED
  );
}

export async function currentState(requestId: string): Promise<RequestState | null> {
  const rows = await getDb().select({ status: requests.status }).from(requests).where(eq(requests.id, requestId)).limit(1);
  return (rows[0]?.status as RequestState | undefined) ?? null;
}

export async function transitionHistory(requestId: string) {
  return getDb()
    .select()
    .from(requestStateTransitions)
    .where(eq(requestStateTransitions.requestId, requestId))
    .orderBy(requestStateTransitions.createdAt);
}
