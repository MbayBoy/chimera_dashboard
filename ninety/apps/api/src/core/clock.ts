import { env } from '../env.js';

/**
 * The product clock.
 *
 * Every SLA-governed deadline is computed here, and TIMER_SPEED_FACTOR is
 * applied here — to the deadline itself, not to the queue delay.
 *
 * This matters more than it looks. If the compression were applied only when
 * the timer was armed, the deadline the API published and the moment the server
 * actually acted on it would disagree by the whole difference: a terminal in a
 * sped-up rehearsal would render a fifteen-minute countdown over a window that
 * closes in seconds, and the load test would measure timers firing twelve
 * minutes "early" against deadlines nobody honoured. One clock, one answer.
 *
 * At the production default of 1 this is exactly addMinutes, and the guard that
 * forbids market values in code still governs the minutes themselves — they
 * come from market config, never from here.
 */
export function slaDeadline(from: Date, minutes: number): Date {
  return new Date(from.getTime() + (minutes * 60_000) / env().TIMER_SPEED_FACTOR);
}

/** The same compression, for a window expressed in milliseconds. */
export function slaMs(ms: number): number {
  return ms / env().TIMER_SPEED_FACTOR;
}
