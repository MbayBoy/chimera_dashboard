import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatMoney, type Cents } from '@ninety/shared';

/**
 * Localisation.
 *
 * Every system-generated string — push notification, SMS, email, validation
 * error, state label — is looked up by key against the caller's locale. There is
 * no user-facing English string literal anywhere in application code, and a key
 * present in the reference catalogue and missing from another fails the build.
 *
 * The cost of building this on day one is about a day. The cost of adding it in
 * month six, across forty endpoints, is a fortnight — and market #1 launches in
 * Arabic, so month six is too late by five months.
 */

const cataloguesDir = join(dirname(fileURLToPath(import.meta.url)), 'catalogues');

export const REFERENCE_LANGUAGE = 'en';

/** Languages written right to left. A property of the language, not of a market. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

type Catalogue = Record<string, string>;

const catalogues = new Map<string, Catalogue>();

function flatten(value: unknown, prefix = ''): Catalogue {
  const out: Catalogue = {};
  if (value === null || typeof value !== 'object') return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix === '' ? k : `${prefix}.${k}`;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = String(v);
  }
  return out;
}

function load(): void {
  if (catalogues.size > 0) return;
  for (const file of readdirSync(cataloguesDir)) {
    if (!file.endsWith('.json')) continue;
    const language = file.replace(/\.json$/, '');
    catalogues.set(language, flatten(JSON.parse(readFileSync(join(cataloguesDir, file), 'utf8'))));
  }
}

/** The language subtag of a locale: `ar-AE` → `ar`. Never hardcoded per market. */
export function languageOf(locale: string): string {
  return (locale.split('-')[0] ?? REFERENCE_LANGUAGE).toLowerCase();
}

export function isRtlLocale(locale: string): boolean {
  return RTL_LANGUAGES.has(languageOf(locale));
}

export function supportedLanguages(): string[] {
  load();
  return [...catalogues.keys()].sort();
}

/**
 * Resolve the locale for a caller: their own preference, falling back to the
 * market's default. Never a global default — a global default is how an Arabic
 * market ends up receiving English.
 */
export function resolveLocale(userLocale: string | null | undefined, marketDefaultLocale: string): string {
  return userLocale && userLocale.trim() !== '' ? userLocale : marketDefaultLocale;
}

export type MessageParams = Record<string, string | number>;

/**
 * Translate. Falls back to the reference language when a key is missing from the
 * requested one, and returns the key itself if it is missing everywhere — a
 * visible `notify.buyer.whatever` in a log is a bug report; a silent empty string
 * is not.
 */
export function t(key: string, locale: string, params: MessageParams = {}): string {
  load();
  const language = languageOf(locale);
  const primary = catalogues.get(language);
  const fallback = catalogues.get(REFERENCE_LANGUAGE);
  const template = primary?.[key] ?? fallback?.[key];
  if (template === undefined) return key;
  return interpolate(template, params);
}

export function hasKey(key: string): boolean {
  load();
  return catalogues.get(REFERENCE_LANGUAGE)?.[key] !== undefined;
}

function interpolate(template: string, params: MessageParams): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{{${name}}}`,
  );
}

/** Date and time, always through Intl, always in the market's timezone. */
export function formatDateTime(at: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(at);
}

export function formatTime(at: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, timeStyle: 'short' }).format(at);
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCurrency(amount: Cents, currency: string, locale: string, minorUnitExponent: number): string {
  return formatMoney(amount, currency, locale, minorUnitExponent);
}

export function formatDistanceKm(km: number, locale: string): string {
  return t('common.distance_km', locale, { km: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km) });
}
