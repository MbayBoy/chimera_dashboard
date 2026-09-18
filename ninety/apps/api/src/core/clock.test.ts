import { describe, expect, it } from 'vitest';
import { slaDeadline, slaMs } from './clock.js';

/**
 * The regression this exists for: the speed factor used to compress only the
 * queue delay, so a sped-up run fired its timers twelve minutes before the
 * deadline the API had published to the buyer's countdown. One clock.
 */
describe('product clock', () => {
  const factor = Number(process.env.TIMER_SPEED_FACTOR ?? '1');

  it('scales a deadline by the speed factor', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(slaDeadline(from, 15).getTime() - from.getTime()).toBe((15 * 60_000) / factor);
  });

  it('scales a millisecond window by the same factor', () => {
    expect(slaMs(60_000)).toBe(60_000 / factor);
  });

  it('agrees with the delay a timer would wait', () => {
    const now = new Date();
    const deadline = slaDeadline(now, 30);
    // What scheduleTimer computes: the raw distance to the published deadline.
    expect(deadline.getTime() - now.getTime()).toBe((30 * 60_000) / factor);
  });
});
