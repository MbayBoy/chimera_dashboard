import IORedis, { type Redis } from 'ioredis';
import { env } from '../env.js';

/**
 * Redis.
 *
 * Three jobs: configuration cache, the ping-rate budget that protects supplier
 * terminals from irrelevant alerts, and — the important one — the delayed-job
 * queue behind every deadline in the product. BullMQ requires
 * `maxRetriesPerRequest: null` on the connections it owns, so queue connections
 * are created separately from the general-purpose one.
 */

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client === null) {
    client = new IORedis(env().REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
    client.on('error', (err) => {
      // Logged rather than thrown: a Redis blip must degrade the config cache,
      // not take the API down. The reconciliation sweep covers lost timers.
      console.error(JSON.stringify({ level: 'error', msg: 'redis error', err: err.message }));
    });
  }
  return client;
}

/** A dedicated connection for BullMQ, which needs unlimited retries. */
export function makeQueueConnection(): Redis {
  return new IORedis(env().REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

export async function closeRedis(): Promise<void> {
  if (client !== null) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}

export async function pingRedis(): Promise<{ ok: boolean; error?: string }> {
  try {
    const pong = await getRedis().ping();
    return { ok: pong === 'PONG' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
