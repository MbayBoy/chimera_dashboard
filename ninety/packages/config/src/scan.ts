import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface SourceFile {
  readonly path: string;
  readonly relativePath: string;
  readonly contents: string;
}

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Directory and file patterns excluded from the market-value guard.
 *
 * Seeds, migrations and tests are excluded deliberately: seed data IS market
 * data, migrations record it historically, and a test that asserts a rate must
 * be able to name the rate. Everything else — every line of application code —
 * is scanned.
 */
const EXCLUDED_DIR_SEGMENTS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.expo',
  'android',
  'ios',
  'migrations',
  'seed',
  'seeds',
  '__fixtures__',
];

const EXCLUDED_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.d\.ts$/,
  // Seed files ARE market data. Excluding them is the point, not a loophole.
  /^seed([-.].*)?\.[cm]?[jt]s$/,
];

/**
 * A file-level opt-out, for the rare case that is genuinely market data outside
 * a seed file. It must carry a reason on the same line, so the exemption is
 * reviewable rather than a magic comment someone pasted to get past CI.
 */
export const GUARD_PRAGMA = /guard:allow-market-values\s*[—:-]\s*\S+/;

export function collectSourceFiles(roots: readonly string[], repoRoot: string): SourceFile[] {
  const out: SourceFile[] = [];
  for (const root of roots) {
    let stat;
    try {
      stat = statSync(root);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    walk(root, out, repoRoot);
  }
  return out;
}

function walk(dir: string, out: SourceFile[], repoRoot: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_SEGMENTS.includes(entry.name)) continue;
      walk(full, out, repoRoot);
      continue;
    }
    if (!CODE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
    if (EXCLUDED_FILE_PATTERNS.some((re) => re.test(entry.name))) continue;
    const contents = readFileSync(full, 'utf8');
    if (GUARD_PRAGMA.test(contents.slice(0, 2000))) continue;
    out.push({ path: full, relativePath: relative(repoRoot, full).split(sep).join('/'), contents });
  }
}

/** Strip line and block comments so a rate mentioned in prose is not a violation. */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let state: 'code' | 'line' | 'block' | 'single' | 'double' | 'template' = 'code';
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    const ch = source[i]!;
    if (state === 'code') {
      if (two === '//') {
        state = 'line';
        i += 2;
        continue;
      }
      if (two === '/*') {
        state = 'block';
        i += 2;
        continue;
      }
      if (ch === "'") state = 'single';
      else if (ch === '"') state = 'double';
      else if (ch === '`') state = 'template';
      out += ch;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (ch === '\n') {
        state = 'code';
        out += ch;
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (two === '*/') {
        state = 'code';
        i += 2;
        continue;
      }
      if (ch === '\n') out += ch;
      i += 1;
      continue;
    }
    // inside a string literal: copy verbatim, honouring escapes
    if (ch === '\\') {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if ((state === 'single' && ch === "'") || (state === 'double' && ch === '"') || (state === 'template' && ch === '`')) {
      state = 'code';
    }
    out += ch;
    i += 1;
  }
  return out;
}
