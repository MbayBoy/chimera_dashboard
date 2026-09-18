import postgres from 'postgres';
import { env } from '../env.js';
import { log } from '../core/logger.js';
import { marketConfig } from './config.js';

/**
 * Market change listener.
 *
 * Holds one dedicated connection on `LISTEN ninety_market_changed`, so a change
 * to a market row — whether it came through the admin editor or straight from
 * psql during an incident — invalidates the cache in every API process
 * immediately rather than after the cache TTL.
 *
 * Without this, an admin who edits a rate and watches nothing happen for five
 * minutes concludes the editor is broken, and the next person edits the code.
 */

let listener: postgres.Sql | null = null;

export async function startMarketWatcher(): Promise<void> {
  if (listener !== null) return;
  listener = postgres(env().DATABASE_URL, { max: 1, onnotice: () => {} });
  await listener.listen('ninety_market_changed', (payload) => {
    try {
      const { id, code } = JSON.parse(payload) as { id: string; code: string };
      void marketConfig.invalidate(id, code);
      log.info('market configuration invalidated by database notification', { marketId: id, code });
    } catch (err) {
      log.warn('malformed market change notification', { payload, err: err instanceof Error ? err.message : String(err) });
    }
  });
  log.info('listening for market configuration changes');
}

export async function stopMarketWatcher(): Promise<void> {
  if (listener === null) return;
  await listener.end({ timeout: 2 });
  listener = null;
}
