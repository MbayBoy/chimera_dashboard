/**
 * The countdown.
 *
 * The server sends absolute UTC deadlines and never a duration. This module
 * renders them, and it corrects for the tablet's own clock being wrong — which
 * on cheap hardware in a yard it frequently is.
 *
 * The correction matters commercially as well as technically. A yard whose
 * tablet is four minutes fast sees a job expire while they are still filling in
 * the price, decides the platform cheated them, and stops answering. Measuring
 * the offset against the server's clock on every poll removes that argument
 * entirely.
 */

let offsetMs = 0;

/** Record the server's clock, as reported alongside every list response. */
export function syncServerTime(serverTimeIso: string, receivedAt = Date.now()): number {
  const serverMs = Date.parse(serverTimeIso);
  if (!Number.isFinite(serverMs)) return offsetMs;
  offsetMs = serverMs - receivedAt;
  return offsetMs;
}

/** The server's idea of now, in local milliseconds. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}

/** True when this device's clock is far enough out to be worth telling someone. */
export function clockIsSuspect(thresholdMs = 120_000): boolean {
  return Math.abs(offsetMs) > thresholdMs;
}

export interface Countdown {
  readonly totalMs: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly expired: boolean;
  /** How urgent this looks: amber under five minutes, red under two. */
  readonly urgency: 'calm' | 'soon' | 'urgent' | 'expired';
}

export function countdownTo(deadlineIso: string | null, now = serverNow()): Countdown {
  if (deadlineIso === null) {
    return { totalMs: 0, minutes: 0, seconds: 0, expired: true, urgency: 'expired' };
  }
  const totalMs = Math.max(0, Date.parse(deadlineIso) - now);
  const expired = totalMs <= 0;
  const minutes = Math.floor(totalMs / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const urgency: Countdown['urgency'] = expired
    ? 'expired'
    : totalMs < 120_000
      ? 'urgent'
      : totalMs < 300_000
        ? 'soon'
        : 'calm';
  return { totalMs, minutes, seconds, expired, urgency };
}

export function formatCountdown(countdown: Countdown): string {
  if (countdown.expired) return '0:00';
  return `${countdown.minutes}:${String(countdown.seconds).padStart(2, '0')}`;
}
