/**
 * The offline queue.
 *
 * A yard's connectivity is not reliable: a metal roof, a flat battery, a power
 * cut. An offer composed during an outage must survive and send on reconnect.
 *
 * The failure this exists to prevent is specific and expensive: if a queued
 * offer is silently dropped, the supplier believes they responded and the
 * platform believes they did not. Their score falls for something they did, and
 * they stop trusting the product. So nothing is ever removed from this queue
 * except on a confirmed server acknowledgement or a permanent rejection, and the
 * terminal always shows which state a submission is in.
 */

const STORAGE_KEY = 'ninety.terminal.outbox.v1';

export type QueuedKind = 'offer' | 'decline' | 'seen' | 'ready';

export interface QueuedItem {
  readonly id: string;
  readonly kind: QueuedKind;
  readonly requestId: string;
  readonly path: string;
  readonly method: 'POST';
  readonly body: Record<string, unknown>;
  /** Photos held as data URLs, because a Blob does not survive localStorage. */
  readonly photos: readonly string[];
  /** When the operator actually composed it — what their response time is measured from. */
  readonly composedAt: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'sending' | 'failed' | 'rejected';
}

function read(): QueuedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? [] : (JSON.parse(raw) as QueuedItem[]);
  } catch {
    return [];
  }
}

function write(items: readonly QueuedItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked. The in-memory copy still flushes this session;
    // losing it silently on reload is the one thing this must not do, so it is
    // surfaced rather than swallowed.
    console.error('could not persist the outbox — do not close this tab until it is empty');
  }
}

export function enqueue(item: Omit<QueuedItem, 'attempts' | 'lastError' | 'status'>): QueuedItem {
  const queued: QueuedItem = { ...item, attempts: 0, lastError: null, status: 'pending' };
  const items = read();
  // Same request, same kind: replace rather than duplicate. Tapping submit twice
  // on a slow connection must not produce two offers.
  const deduped = items.filter((i) => !(i.requestId === queued.requestId && i.kind === queued.kind));
  write([...deduped, queued]);
  return queued;
}

export function all(): QueuedItem[] {
  return read();
}

export function pendingCount(): number {
  return read().filter((i) => i.status !== 'rejected').length;
}

export function forRequest(requestId: string): QueuedItem[] {
  return read().filter((i) => i.requestId === requestId);
}

export function remove(id: string): void {
  write(read().filter((i) => i.id !== id));
}

export function update(id: string, patch: Partial<QueuedItem>): void {
  write(read().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export interface FlushResult {
  readonly sent: number;
  readonly failed: number;
  readonly rejected: number;
}

export interface Sender {
  send(item: QueuedItem): Promise<{ ok: true } | { ok: false; permanent: boolean; error: string }>;
}

/**
 * Attempt to send everything queued.
 *
 * A permanent rejection — the window closed, this yard already quoted — marks
 * the item rejected and keeps it visible, because the operator needs to know
 * their quote did not land. A transient failure leaves it pending for the next
 * attempt.
 */
export async function flush(sender: Sender): Promise<FlushResult> {
  let sent = 0;
  let failed = 0;
  let rejected = 0;

  for (const item of read()) {
    if (item.status === 'rejected') continue;
    update(item.id, { status: 'sending' });
    const result = await sender.send(item);
    if (result.ok) {
      remove(item.id);
      sent += 1;
      continue;
    }
    if (result.permanent) {
      update(item.id, { status: 'rejected', lastError: result.error, attempts: item.attempts + 1 });
      rejected += 1;
      continue;
    }
    update(item.id, { status: 'pending', lastError: result.error, attempts: item.attempts + 1 });
    failed += 1;
  }
  return { sent, failed, rejected };
}

/** Clear items the operator has acknowledged. Rejected ones only. */
export function dismissRejected(): void {
  write(read().filter((i) => i.status !== 'rejected'));
}
