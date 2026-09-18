import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load `.env` from the monorepo root, if one is present.
 *
 * Imported for its side effect before anything reads `process.env`. In a
 * container the environment is injected and no file exists, which is the normal
 * production path — this exists so a developer can clone, copy `.env.example`
 * and run one command.
 */
const here = dirname(fileURLToPath(import.meta.url));

function findRepoRoot(): string {
  let dir = here;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  return here;
}

const envFile = join(findRepoRoot(), '.env');
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

export {};
