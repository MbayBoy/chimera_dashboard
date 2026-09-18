import type { FastifyInstance } from 'fastify';
import { toIsoUtc } from '@ninety/shared';
import { verifyAccessToken } from '../auth/tokens.js';
import { getDb } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { buyers, suppliers } from '../db/schema.js';
import {
  buyerConnections,
  heartbeat,
  markSupplierOffline,
  markSupplierOnline,
  supplierConnections,
} from './hub.js';
import { log } from '../core/logger.js';

/**
 * WebSocket endpoints.
 *
 * Authentication is by token in the query string rather than a header: browsers
 * cannot set headers on a WebSocket handshake, and the terminal is a web page by
 * design because scrapyards will not install an app.
 *
 * On reconnect the client re-fetches state rather than assuming it is current.
 * A terminal that was offline for ninety seconds has missed a job and needs the
 * list, not a replayed event.
 */
export async function registerRealtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/supplier/stream', { websocket: true }, async (socket, req) => {
    const token = (req.query as { token?: string }).token;
    if (token === undefined) {
      socket.close(4401, 'unauthenticated');
      return;
    }

    let supplierId: string;
    try {
      const claims = await verifyAccessToken(token);
      if (claims.role !== 'supplier') {
        socket.close(4403, 'forbidden');
        return;
      }
      const rows = await getDb().select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.userId, claims.sub)).limit(1);
      const id = rows[0]?.id;
      if (id === undefined) {
        socket.close(4403, 'forbidden');
        return;
      }
      supplierId = id;
    } catch {
      socket.close(4401, 'unauthenticated');
      return;
    }

    supplierConnections.add(supplierId, socket);
    await markSupplierOnline(supplierId);
    log.info('supplier terminal connected', { supplierId, connections: supplierConnections.countFor(supplierId) });

    // The client re-fetches on connect; this only tells it the socket is live and
    // hands it the server's clock so it can detect its own drift.
    socket.send(JSON.stringify({ type: 'connected', serverTime: toIsoUtc(new Date()) }));

    socket.on('message', (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: string };
        if (message.type === 'ping') {
          void heartbeat(supplierId);
          socket.send(JSON.stringify({ type: 'pong', serverTime: toIsoUtc(new Date()) }));
        }
      } catch {
        /* a malformed frame from a terminal is not worth closing the socket over */
      }
    });

    socket.on('close', () => {
      const remaining = supplierConnections.remove(supplierId, socket);
      void markSupplierOffline(supplierId, remaining);
      log.info('supplier terminal disconnected', { supplierId, remaining });
    });
  });

  app.get('/v1/buyer/stream', { websocket: true }, async (socket, req) => {
    const token = (req.query as { token?: string }).token;
    if (token === undefined) {
      socket.close(4401, 'unauthenticated');
      return;
    }
    let buyerId: string;
    try {
      const claims = await verifyAccessToken(token);
      if (claims.role !== 'buyer') {
        socket.close(4403, 'forbidden');
        return;
      }
      const rows = await getDb().select({ id: buyers.id }).from(buyers).where(eq(buyers.userId, claims.sub)).limit(1);
      const id = rows[0]?.id;
      if (id === undefined) {
        socket.close(4403, 'forbidden');
        return;
      }
      buyerId = id;
    } catch {
      socket.close(4401, 'unauthenticated');
      return;
    }

    buyerConnections.add(buyerId, socket);
    socket.send(JSON.stringify({ type: 'connected', serverTime: toIsoUtc(new Date()) }));

    socket.on('message', (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: string };
        if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong', serverTime: toIsoUtc(new Date()) }));
      } catch {
        /* ignore */
      }
    });

    socket.on('close', () => {
      buyerConnections.remove(buyerId, socket);
    });
  });
}
