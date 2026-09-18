import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));

/** The monorepo root, found by walking up to the workspace manifest. */
export function repoRoot(): string {
  let dir = here;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  return resolve(here, '../../..');
}

/** Directories the market-value guard scans: all application source. */
export function guardedRoots(root = repoRoot()): string[] {
  return [
    join(root, 'apps', 'api', 'src'),
    join(root, 'apps', 'terminal', 'src'),
    join(root, 'apps', 'admin', 'src'),
    join(root, 'apps', 'buyer', 'src'),
    join(root, 'packages', 'shared', 'src'),
  ];
}

export function catalogueDir(root = repoRoot()): string {
  return join(root, 'apps', 'api', 'src', 'i18n', 'catalogues');
}
