import './load-env.js';
import { start } from './server.js';
import { log } from './core/logger.js';
import { env } from './env.js';
import { rearmTimers, startTimerWorkers, stopTimerWorkers } from './timers/worker.js';
import { closeDb } from './db/client.js';
import { stopMarketWatcher } from './market/watcher.js';
import { closeRedis } from './core/redis.js';

/**
 * Entry point.
 *
 * The timer workers start in the same process as the API in this configuration.
 * They are separable — the queue is Redis and the jobs are idempotent — but one
 * process is the right shape until a domain earns its own deployment.
 */
async function main(): Promise<void> {
  const app = await start();
  await startTimerWorkers();
  // A process that restarts must not leave its deadlines unscheduled and rely on
  // the sweep to notice: the sweep has 60-second granularity and the promise is
  // measured in minutes.
  await rearmTimers();
  log.info('NINETY api listening', { port: env().PORT, env: env().NODE_ENV });

  const shutdown = async (signal: string) => {
    log.info('shutting down', { signal });
    await stopTimerWorkers();
    await stopMarketWatcher();
    await app.close();
    await closeDb();
    await closeRedis();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  log.fatal('failed to start', { err });
  process.exit(1);
});
