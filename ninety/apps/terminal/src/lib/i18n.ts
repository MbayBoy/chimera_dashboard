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
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{{${name}}}`,
  );
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
  return new Intl.NumberFormat(language === 'ar' ? 'ar-AE' : 'en-AE', options).format(value);
}

export function formatMoney(language: Language, minorUnits: number, currency: string, exponent = 2): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-AE' : 'en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(minorUnits / Math.pow(10, exponent));
}

export function formatTime(language: Language, at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-AE' : 'en-AE', { timeStyle: 'short', timeZone }).format(at);
}
