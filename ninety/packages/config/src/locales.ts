import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Locale catalogue parity.
 *
 * Every system-generated string — push notification, SMS, email, validation
 * error, state label — is looked up by key against the caller's locale. Arabic
 * is a launch requirement in market #1, not a later addition, so a key that
 * exists in the reference catalogue and is missing from any other one fails the
 * build rather than reaching a supplier as English text on an Arabic terminal.
 */

export const REFERENCE_LANGUAGE = 'en';

export interface CatalogueSet {
  readonly languages: readonly string[];
  readonly byLanguage: Readonly<Record<string, Record<string, string>>>;
}

export function loadCatalogues(dir: string): CatalogueSet {
  let entries: string[];
  try {
    if (!statSync(dir).isDirectory()) return { languages: [], byLanguage: {} };
    entries = readdirSync(dir);
  } catch {
    return { languages: [], byLanguage: {} };
  }
  const byLanguage: Record<string, Record<string, string>> = {};
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const language = entry.replace(/\.json$/, '');
    const raw = JSON.parse(readFileSync(join(dir, entry), 'utf8')) as unknown;
    byLanguage[language] = flatten(raw);
  }
  return { languages: Object.keys(byLanguage).sort(), byLanguage };
}

/** Catalogues are authored as nested objects and compared as flat key paths. */
export function flatten(value: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (value === null || typeof value !== 'object') {
    if (prefix !== '') out[prefix] = String(value);
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix === '' ? k : `${prefix}.${k}`;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

export interface ParityReport {
  readonly language: string;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly untranslated: readonly string[];
}

export function checkParity(set: CatalogueSet): ParityReport[] {
  const reference = set.byLanguage[REFERENCE_LANGUAGE];
  if (!reference) return [];
  const referenceKeys = Object.keys(reference).sort();
  const reports: ParityReport[] = [];
  for (const language of set.languages) {
    if (language === REFERENCE_LANGUAGE) continue;
    const target = set.byLanguage[language]!;
    const targetKeys = new Set(Object.keys(target));
    const missing = referenceKeys.filter((k) => !targetKeys.has(k));
    const extra = [...targetKeys].filter((k) => !(k in reference)).sort();
    // A value identical to the reference is usually an untranslated placeholder.
    // Short interpolation-only strings are exempt: "{{reference}}" is the same
    // in every language and legitimately so.
    const untranslated = referenceKeys.filter(
      (k) => targetKeys.has(k) && target[k] === reference[k] && !/^\s*\{\{[^}]+\}\}\s*$/.test(reference[k] ?? ''),
    );
    reports.push({ language, missing, extra, untranslated });
  }
  return reports;
}
