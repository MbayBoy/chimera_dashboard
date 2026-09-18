/**
 * The alert.
 *
 * A browser notification alone is silent when the tablet is muted or the tab is
 * backgrounded, and a job nobody hears is a job nobody answers. So this is three
 * things at once: a sound loud enough to carry across a yard, a vibration, and a
 * notification.
 *
 * The sound is synthesised rather than loaded from a file, so it works offline
 * on first run and cannot be the asset that failed to cache.
 */

let audioContext: AudioContext | null = null;
let unlocked = false;

/**
 * Browsers refuse to play audio until the user has interacted with the page.
 * The terminal calls this on the first tap, so the first real alert is audible
 * rather than silently blocked.
 */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  try {
    audioContext = audioContext ?? new AudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();
    unlocked = true;
  } catch {
    // Audio unavailable. Vibration and the notification still fire.
  }
}

/**
 * A two-tone chime, repeated. Deliberately not a gentle notification sound: this
 * has to be heard over an angle grinder.
 */
export function playAlert(repeats = 3): void {
  if (audioContext === null) return;
  const ctx = audioContext;
  const start = ctx.currentTime;
  for (let i = 0; i < repeats; i++) {
    for (const [index, frequency] of [880, 1320].entries()) {
      const at = start + i * 0.55 + index * 0.22;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, at);
      // A short attack and decay: a sustained tone is ignored, a transient is not.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.22);
    }
  }
}

export function vibrate(): void {
  try {
    navigator.vibrate?.([300, 120, 300, 120, 500]);
  } catch {
    /* not supported */
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, tag: 'ninety-new-request', renotify: true } as NotificationOptions);
  } catch {
    /* notifications unavailable */
  }
}

/** Everything at once, for a new job. */
export async function alertNewRequest(title: string, body: string): Promise<void> {
  playAlert();
  vibrate();
  await notify(title, body);
}
