import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface GrepHit {
  readonly file: string;
  readonly lineNumber: number;
  readonly line: string;
}

/**
 * A grep the tests can assert against.
 *
 * Used where a rule is about the shape of the source rather than the behaviour
 * of the running system — "this number must not appear as a literal in
 * application code" cannot be checked any other way.
 */
export async function grep(pattern: RegExp, roots: readonly string[]): Promise<GrepHit[]> {
  const hits: GrepHit[] = [];
  for (const root of roots) await walk(root, pattern, hits);
  return hits;
}

async function walk(dir: string, pattern: RegExp, hits: GrepHit[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'migrations') continue;
      await walk(path, pattern, hits);
      continue;
    }
    if (!/\.[cm]?tsx?$/.test(entry.name)) continue;
    const text = await readFile(path, 'utf8');
    text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) hits.push({ file: path, lineNumber: index + 1, line });
    });
  }
}
