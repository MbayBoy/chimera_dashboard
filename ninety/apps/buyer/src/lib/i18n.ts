import en from '../locales/en.json';
import ar from '../locales/ar.json';

/**
 * Buyer-app localisation.
 *
 * Arabic and English with full RTL from the first screen. In React Native, RTL
 * is a native-shell concern: `I18nManager.forceRTL` is what actually mirrors a
 * layout, and it requires a reload to take effect — which is why the language
 * choice is made once and applied at start-up rather than toggled mid-session
 * and left half-applied.
 */

const CATALOGUES: Record<string, Record<string, unknown>> = { en, ar };

export type Language = 'en' | 'ar';

export function isRtlLanguage(language: Language): boolean {
  return language === 'ar';
}

/** Map a device locale to a language this app ships. */
export function languageForLocale(locale: string | undefined): Language {
  const tag = (locale ?? 'en').toLowerCase();
  return tag.startsWith('ar') ? 'ar' : 'en';
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
    // Numbers are formatted in the locale of the sentence around them, so one
    // screen never mixes two numbering systems.
    return typeof value === 'number' ? new Intl.NumberFormat(localeFor(language)).format(value) : String(value);
  });
}

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
 * The market's own locales, learned from the server.
 *
 * Composing "ar" + "-AE" in the app is the shortcut that makes the same binary
 * wrong in the second market: it decides on the device what numbers, dates and
 * currency look like in a country the device has not been told about. The
 * server knows, and says so before sign-in.
 *
 * Until it answers, the bare language tag is used — Intl resolves it sensibly,
 * and it is honest about not yet knowing the region.
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
