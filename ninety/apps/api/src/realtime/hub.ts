import type { WebSocket } from 'ws';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { supplierPresence } from '../db/schema.js';
import { log } from '../core/logger.js';

/**
 * Realtime hub.
 *
 * Supplier terminals hold a WebSocket. A yard must be alerted the instant a
 * relevant request appears, not on the next poll: polling at thirty seconds
 * spends a third of the response window before the operator has seen anything.
 *
 * Presence is not decoration either. It feeds the availability component of
 * matching, and — more importantly — it is how the system distinguishes "did not
 * answer" from "was not reachable". Penalising a yard for a flat tablet or a
 * power cut is the fastest way to lose the yards it took three months to sign.
 */

export type SupplierEvent =
  | { type: 'new_request'; requestId: string; reference: string; responseDeadline: string; summary: Record<string, unknown> }
  | { type: 'request_withdrawn'; requestId: string; reference: string }
  | { type: 'offer_accepted'; requestId: string; orderId: string; reference: string; payoutCents: number }
  | { type: 'offer_lost'; requestId: string; reference: string }
  | { type: 'window_closed'; requestId: string; reference: string }
  | { type: 'score_changed'; score: number; rank: number | null }
  | { type: 'pong'; serverTime: string };

export type BuyerEvent =
  | { type: 'offer_received'; requestId: string; offerCount: number }
  | { type: 'offers_final'; requestId: string; offerCount: number }
  | { type: 'search_widened'; requestId: string; wideningDeadline: string }
  | { type: 'no_offers'; requestId: string }
  | { type: 'courier_assigned'; requestId: string; etaMinutes: number | null }
  | { type: 'courier_collected'; requestId: string }
  | { type: 'delivered'; requestId: string }
  | { type: 'delivery_failed'; requestId: string }
  | { type: 'status_changed'; requestId: string; status: string }
  | { type: 'pong'; serverTime: string };

class ConnectionRegistry<TEvent> {
  private readonly sockets = new Map<string, Set<WebSocket>>();

  add(id: string, socket: WebSocket): void {
    const existing = this.sockets.get(id);
    if (existing === undefined) this.sockets.set(id, new Set([socket]));
    else existing.add(socket);
  }

  remove(id: string, socket: WebSocket): number {
    const existing = this.sockets.get(id);
    if (existing === undefined) return 0;
    existing.delete(socket);
    if (existing.size === 0) this.sockets.delete(id);
    return existing.size;
  }

  countFor(id: string): number {
    return this.sockets.get(id)?.size ?? 0;
  }

  isConnected(id: string): boolean {
    return this.countFor(id) > 0;
  }

  connectedIds(): string[] {
    return [...this.sockets.keys()];
  }

  send(id: string, event: TEvent): number {
    const targets = this.sockets.get(id);
    if (targets === undefined) return 0;
    const payload = JSON.stringify(event);
    let delivered = 0;
    for (const socket of targets) {
      try {
        socket.send(payload);
        delivered += 1;
      } catch (err) {
        log.warn('websocket send failed', { err: err instanceof Error ? err.message : String(err) });
      }
    }
    return delivered;
  }

  closeAll(): void {
    for (const set of this.sockets.values()) {
      for (const socket of set) {
        try {
          socket.close(1001, 'server shutting down');
        } catch {
          /* already gone */
        }
      }
    }
    this.sockets.clear();
  }
}

export const supplierConnections = new ConnectionRegistry<SupplierEvent>();
export const buyerConnections = new ConnectionRegistry<BuyerEvent>();

export async function markSupplierOnline(supplierId: string): Promise<void> {
  supplierConnections.countFor(supplierId);
  const now = new Date();
  await getDb()
    .insert(supplierPresence)
    .values({ supplierId, online: true, lastSeenAt: now, lastOnlineAt: now, connectionCount: 1 })
    .onConflictDoUpdate({
      target: supplierPresence.supplierId,
      set: {
        online: true,
        lastSeenAt: now,
        lastOnlineAt: now,
        connectionCount: sql`${supplierPresence.connectionCount} + 1`,
      },
    });
}

export async function markSupplierOffline(supplierId: string, remaining: number): Promise<void> {
  const now = new Date();
  if (remaining > 0) {
    await getDb().update(supplierPresence).set({ lastSeenAt: now }).where(eq(supplierPresence.supplierId, supplierId));
    return;
  }
  await getDb()
    .update(supplierPresence)
    .set({ online: false, lastSeenAt: now, lastOfflineAt: now, connectionCount: 0 })
    .where(eq(supplierPresence.supplierId, supplierId));
}

export async function heartbeat(supplierId: string): Promise<void> {
  await getDb().update(supplierPresence).set({ lastSeenAt: new Date() }).where(eq(supplierPresence.supplierId, supplierId));
}

/** Whether a terminal is reachable right now. Used by matching and by scoring. */
export function isSupplierTerminalOnline(supplierId: string): boolean {
  return supplierConnections.isConnected(supplierId);
}

export function closeAllConnections(): void {
  supplierConnections.closeAll();
  buyerConnections.closeAll();
}
