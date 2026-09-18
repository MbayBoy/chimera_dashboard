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

/**
 * Numbers written into a translated sentence.
 *
 * Two different bugs wear this disguise, and both shipped before this check
 * existed:
 *
 *  - A market value hiding where the market-value guard does not look. "Yards
 *    have 15 minutes to answer" is the response SLA, typed into a sentence; a
 *    market with a twenty-minute window would have an app promising fifteen.
 *  - A numbering system decided by hand. The Arabic catalogue spelled "٣٠ يومًا"
 *    while every Intl-formatted number on the same screen rendered in Latin
 *    digits, because that is what ar-AE does. One screen, two numbering systems.
 *
 * The rule is the same in both cases: a number in a message is a parameter, and
 * the code that knows what it is passes it in. Arabic-Indic and Eastern
 * Arabic-Indic digits count, as do Latin ones.
 */
const DIGITS = /[0-9٠-٩۰-۹]/;

export interface CatalogueDigit {
  readonly language: string;
  readonly key: string;
  readonly value: string;
}

export function findHardcodedNumbers(set: CatalogueSet): CatalogueDigit[] {
  const out: CatalogueDigit[] = [];
  for (const language of set.languages) {
    for (const [key, value] of Object.entries(set.byLanguage[language] ?? {})) {
      // A placeholder is not a number, and neither is a key naming one.
      const withoutPlaceholders = value.replace(/\{\{\w+\}\}/g, '');
      if (DIGITS.test(withoutPlaceholders)) out.push({ language, key, value });
    }
  }
  return out;
}
