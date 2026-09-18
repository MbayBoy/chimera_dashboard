import { useEffect, useState } from 'react';
import { countdownTo, formatCountdown, serverNow, type Countdown as CountdownValue } from '../lib/clock.js';

/**
 * A live countdown, computed client-side from the server's absolute deadline.
 *
 * The API never sends "minutes remaining" — a tablet with a wrong clock must
 * not be able to argue about the fifteen minutes, so the server sends the
 * instant and the client subtracts, correcting for its own measured drift.
 */
export function Countdown({ deadline, onExpire }: { deadline: string | null; onExpire?: () => void }): JSX.Element {
  const [value, setValue] = useState<CountdownValue>(() => countdownTo(deadline, serverNow()));

  useEffect(() => {
    setValue(countdownTo(deadline, serverNow()));
    const tick = setInterval(() => {
      const next = countdownTo(deadline, serverNow());
      setValue((previous) => {
        if (!previous.expired && next.expired) onExpire?.();
        return next;
      });
    }, 500);
    return () => clearInterval(tick);
  }, [deadline, onExpire]);

  return (
    <span className={`countdown ${value.urgency}`} aria-live="off" aria-label={formatCountdown(value)}>
      {formatCountdown(value)}
    </span>
  );
}
