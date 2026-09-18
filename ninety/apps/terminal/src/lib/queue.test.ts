import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueuedItem } from './queue.js';

/**
 * The power-cut test.
 *
 * A tablet losing power is not `navigator.onLine === false`. The process stops
 * mid-sentence: nothing unloads, no handler runs, in-memory state is gone, and
 * the only thing that survives is what was already written to disk. That is what
 * is simulated here — the module is re-imported from scratch against the same
 * localStorage, exactly as a browser does after the tablet is plugged back in.
 *
 * What must be true afterwards: the offer the operator composed is still there,
 * it sends on reconnect, and it is credited to when they composed it rather than
 * when the power came back. A yard whose score fell because of a power cut does
 * not stay on the platform.
 */

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
  /** Survives a power cut, the way a disk does. */
  snapshot(): Map<string, string> {
    return new Map(this.data);
  }
  restore(snapshot: Map<string, string>): void {
    this.data = new Map(snapshot);
  }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);

/** A cold start: module registry cleared, exactly as a reboot leaves it. */
async function freshQueueModule() {
  vi.resetModules();
  return import('./queue.js');
}

describe('the supplier terminal outbox survives a power cut', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('keeps a composed offer across a hard power loss and sends it on reconnect', async () => {
    const before = await freshQueueModule();
    const composedAt = new Date(Date.now() - 4 * 60_000).toISOString();
    before.enqueue({
      id: 'outbox-1',
      kind: 'offer',
      requestId: 'req-1',
      path: '/v1/supplier/requests/req-1/offer',
      method: 'POST',
      body: { price: '450', condition: 'used', warrantyDays: 30, readyInMin: 20 },
      photos: [],
      composedAt,
    });
    expect(before.pendingCount()).toBe(1);

    // The lights go out. Nothing unloads; only what reached storage exists.
    const disk = storage.snapshot();
    storage.clear();
    storage.restore(disk);

    const after = await freshQueueModule();
    const recovered = after.all() as QueuedItem[];
    expect(recovered).toHaveLength(1);
    expect(recovered[0]!.status).toBe('pending');
    // The time they actually composed it, not the time the tablet rebooted.
    expect(recovered[0]!.composedAt).toBe(composedAt);

    const sent: unknown[] = [];
    const result = await after.flush({
      send: async (item: unknown) => {
        sent.push(item);
        return { ok: true as const };
      },
    });
    expect(result.sent).toBe(1);
    expect(after.pendingCount()).toBe(0);
    expect((sent[0] as { composedAt: string }).composedAt).toBe(composedAt);
  });

  it('a transient failure leaves the offer queued; it is never silently dropped', async () => {
    const queue = await freshQueueModule();
    queue.enqueue({
      id: 'outbox-2',
      kind: 'offer',
      requestId: 'req-2',
      path: '/v1/supplier/requests/req-2/offer',
      method: 'POST',
      body: { price: '300' },
      photos: [],
      composedAt: new Date().toISOString(),
    });

    const failed = await queue.flush({
      send: async () => ({ ok: false as const, permanent: false, error: 'network unreachable' }),
    });
    expect(failed.failed).toBe(1);
    expect(queue.pendingCount()).toBe(1);
    expect((queue.all() as QueuedItem[])[0]!.status).toBe('pending');
    expect((queue.all() as QueuedItem[])[0]!.attempts).toBe(1);

    const later = await queue.flush({ send: async () => ({ ok: true as const }) });
    expect(later.sent).toBe(1);
    expect(queue.pendingCount()).toBe(0);
  });

  it('a permanent rejection stays visible instead of disappearing', async () => {
    const queue = await freshQueueModule();
    queue.enqueue({
      id: 'outbox-3',
      kind: 'offer',
      requestId: 'req-3',
      path: '/v1/supplier/requests/req-3/offer',
      method: 'POST',
      body: { price: '300' },
      photos: [],
      composedAt: new Date().toISOString(),
    });

    const result = await queue.flush({
      send: async () => ({ ok: false as const, permanent: true, error: 'the window for this job has closed' }),
    });
    expect(result.rejected).toBe(1);
    // Still on screen. The operator must find out their quote did not land —
    // believing you answered when you did not is how a yard loses trust.
    expect(queue.all()).toHaveLength(1);
    expect((queue.all() as QueuedItem[])[0]!.status).toBe('rejected');
    expect((queue.all() as QueuedItem[])[0]!.lastError).toContain('closed');

    queue.dismissRejected();
    expect(queue.all()).toHaveLength(0);
  });

  it('submitting twice on a slow connection queues one offer, not two', async () => {
    const queue = await freshQueueModule();
    const item = {
      id: 'outbox-4',
      kind: 'offer' as const,
      requestId: 'req-4',
      path: '/v1/supplier/requests/req-4/offer',
      method: 'POST' as const,
      body: { price: '275' },
      photos: [],
      composedAt: new Date().toISOString(),
    };
    queue.enqueue(item);
    queue.enqueue({ ...item, id: 'outbox-5' });
    expect(queue.all()).toHaveLength(1);
  });

  it('a queue that cannot be persisted still flushes this session', async () => {
    const queue = await freshQueueModule();
    const original = storage.setItem.bind(storage);
    let thrown = 0;
    vi.stubGlobal('localStorage', {
      ...storage,
      getItem: (k: string) => storage.getItem(k),
      setItem: () => {
        thrown += 1;
        throw new Error('QuotaExceededError');
      },
      removeItem: (k: string) => { storage.removeItem(k); },
    });

    // Must not throw out of the product: a full disk is not a reason to lose
    // the operator's work mid-shift.
    expect(() =>
      queue.enqueue({
        id: 'outbox-6',
        kind: 'offer',
        requestId: 'req-6',
        path: '/v1/supplier/requests/req-6/offer',
        method: 'POST',
        body: { price: '199' },
        photos: [],
        composedAt: new Date().toISOString(),
      }),
    ).not.toThrow();
    expect(thrown).toBeGreaterThan(0);

    vi.stubGlobal('localStorage', storage);
    storage.setItem = original;
  });
});
