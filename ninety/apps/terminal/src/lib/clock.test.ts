import { beforeEach, describe, expect, it } from 'vitest';
import { clockIsSuspect, clockOffsetMs, countdownTo, formatCountdown, serverNow, syncServerTime } from './clock.js';

/**
 * The countdown is computed from the server's absolute deadline, corrected for
 * this device's own clock error. A yard whose tablet is four minutes fast must
 * not watch a job expire while they are still typing a price and conclude the
 * platform cheated them.
 */
describe('the countdown', () => {
  beforeEach(() => {
    syncServerTime(new Date().toISOString());
  });

  it('measures how far this device clock is from the server', () => {
    const received = Date.now();
    // A tablet running four minutes behind the server.
    syncServerTime(new Date(received + 240_000).toISOString(), received);
    expect(clockOffsetMs()).toBeGreaterThan(239_000);
    expect(clockIsSuspect()).toBe(true);
    expect(serverNow()).toBeGreaterThan(Date.now() + 200_000);
  });

  it('renders the remaining time from the deadline, not from a duration', () => {
    const received = Date.now();
    syncServerTime(new Date(received).toISOString(), received);
    const deadline = new Date(received + 11 * 60_000 + 42_000).toISOString();
    const countdown = countdownTo(deadline, received);
    expect(countdown.minutes).toBe(11);
    expect(countdown.seconds).toBe(42);
    expect(formatCountdown(countdown)).toBe('11:42');
  });

  it('gives a yard its full window back when the device clock is fast', () => {
    // This is the whole point of the correction. The device is five minutes
    // FAST, so the server's 15-minute window looks like 10 minutes to an
    // uncorrected client — and the yard watches a job expire while they are
    // still typing a price, and concludes the platform cheated them.
    const received = Date.now();
    syncServerTime(new Date(received - 300_000).toISOString(), received);
    const deadline = new Date(received - 300_000 + 15 * 60_000).toISOString();

    const uncorrected = countdownTo(deadline, received);
    expect(uncorrected.minutes, 'an uncorrected client loses the five minutes').toBe(10);

    const corrected = countdownTo(deadline, serverNow());
    expect(corrected.minutes, 'the corrected client shows the full window').toBe(15);
  });

  it('escalates the urgency as the window closes', () => {
    const now = Date.now();
    expect(countdownTo(new Date(now + 10 * 60_000).toISOString(), now).urgency).toBe('calm');
    expect(countdownTo(new Date(now + 4 * 60_000).toISOString(), now).urgency).toBe('soon');
    expect(countdownTo(new Date(now + 90_000).toISOString(), now).urgency).toBe('urgent');
    expect(countdownTo(new Date(now - 1000).toISOString(), now).urgency).toBe('expired');
  });

  it('never renders a negative countdown', () => {
    const countdown = countdownTo(new Date(Date.now() - 600_000).toISOString());
    expect(countdown.totalMs).toBe(0);
    expect(formatCountdown(countdown)).toBe('0:00');
    expect(countdown.expired).toBe(true);
  });

  it('treats a missing deadline as expired rather than as infinite', () => {
    expect(countdownTo(null).expired).toBe(true);
  });
});
