import en from '../locales/en.json';
import ar from '../locales/ar.json';

/**
 * Terminal localisation.
 *
 * Arabic and English, with the layout mirrored rather than the strings
 * translated into an English frame. RTL changes direction, alignment, the
 * meaning of "back", and which side a countdown sits on — it is a layout
 * concern, and it is built in here from the first screen because retrofitting it
 * across every screen later costs more than building it in.
 */

const CATALOGUES: Record<string, Record<string, unknown>> = { en, ar };

export type Language = 'en' | 'ar';

export const RTL_LANGUAGES: readonly Language[] = ['ar'];

/**
 * The market's own locales, learned from the server.
 *
 * The obvious shortcut is `language === 'ar' ? 'ar-AE' : 'en-AE'`, and it is
 * wrong twice: it bakes a market into the client build, so the second market
 * needs a second build of the same app, and it decides on the client what
 * numbers and dates look like in a market the client has never been told about.
 * The server knows; it is asked, once, before sign-in.
 *
 * Until it answers, the bare language tag is used. Intl resolves that to
 * something sensible, and it is honest: we do not yet know the region.
 */
const marketLocales = new Map<Language, string>();

export function setMarketLocales(locales: readonly string[]): void {
  marketLocales.clear();
  for (const locale of locales) {
    const language = locale.slice(0, 2);
    if (language === 'ar' || language === 'en') marketLocales.set(language, locale);
  }
}

export function localeFor(language: Language): string {
  return marketLocales.get(language) ?? language;
}

export function isRtl(language: Language): boolean {
  return RTL_LANGUAGES.includes(language);
}

function lookup(catalogue: Record<string, unknown>, key: string): string | undefined {
  let node: unknown = catalogue;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(language: Language, key: string, params: Record<string, string | number> = {}): string {
  const template = lookup(CATALOGUES[language] ?? {}, key) ?? lookup(CATALOGUES.en!, key) ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return `{{${name}}}`;
    const value = params[name];
    // A number interpolated into a sentence is formatted like every other
    // number on the screen. Writing "٣٠ يومًا" into the Arabic catalogue by
    // hand looked right in isolation and produced a screen that mixed
    // Arabic-Indic and Latin digits, because ar-AE renders Latin by default
    // and everything going through Intl already did.
    return typeof value === 'number' ? formatNumber(language, value) : String(value);
  });
}

/** Every key in English must exist in Arabic. Asserted by a test, not by hope. */
export function catalogueKeys(language: Language): string[] {
  const out: string[] = [];
  const walk = (node: unknown, prefix: string) => {
    if (node === null || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const key = prefix === '' ? k : `${prefix}.${k}`;
      if (typeof v === 'string') out.push(key);
      else walk(v, key);
    }
  };
  walk(CATALOGUES[language] ?? {}, '');
  return out.sort();
}

/**
 * Numbers, dates and currency through Intl.
 *
 * Arabic locales render digits in Arabic-Indic form by default on most
 * platforms, which is what a Sharjah counter expects to read — and it is why
 * this never hand-formats.
 */
export function formatNumber(language: Language, value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}

export function formatMoney(language: Language, minorUnits: number, currency: string, exponent = 2): string {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(minorUnits / Math.pow(10, exponent));
}

export function formatTime(language: Language, at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(localeFor(language), { timeStyle: 'short', timeZone }).format(at);
}
