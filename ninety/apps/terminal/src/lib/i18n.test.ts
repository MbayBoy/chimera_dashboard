import { describe, expect, it } from 'vitest';
import { catalogueKeys, formatMoney, formatNumber, isRtl, translate } from './i18n.js';

/**
 * The terminal's catalogues are held to the same rule as the API's: a key in
 * English and missing in Arabic would reach a Sharjah counter as English text on
 * a screen someone is expected to answer in ninety seconds.
 */
describe('terminal localisation', () => {
  it('has every English key in Arabic, and nothing extra', () => {
    const en = catalogueKeys('en');
    const ar = catalogueKeys('ar');
    expect(ar.filter((k) => !en.includes(k)), 'keys in Arabic but not English').toEqual([]);
    expect(en.filter((k) => !ar.includes(k)), 'keys in English but not Arabic').toEqual([]);
    expect(en.length).toBeGreaterThan(50);
  });

  it('has no Arabic string left identical to its English source', () => {
    const untranslated = catalogueKeys('en').filter((key) => {
      const english = translate('en', key);
      const arabic = translate('ar', key);
      // A value that is only an interpolation is legitimately identical.
      return arabic === english && !/^\s*\{\{\w+\}\}\s*$/.test(english);
    });
    // `signin.language` is the name of the OTHER language, so it is deliberately
    // in that language on both sides.
    expect(untranslated.filter((k) => k !== 'signin.language')).toEqual([]);
  });

  it('every Arabic string is actually in Arabic script', () => {
    const notArabic = catalogueKeys('ar').filter((key) => {
      const value = translate('ar', key);
      if (/^\s*\{\{\w+\}\}\s*$/.test(value)) return false;
      if (key === 'signin.language') return false;
      return !/[؀-ۿ]/.test(value);
    });
    expect(notArabic).toEqual([]);
  });

  it('knows Arabic mirrors the layout', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });

  it('interpolates and leaves an unknown placeholder visible rather than blank', () => {
    expect(translate('en', 'requests.away', { km: 8.4 })).toContain('8.4');
    expect(translate('ar', 'requests.away', { km: 8.4 })).toContain('8.4');
    expect(translate('en', 'requests.away')).toContain('{{km}}');
  });

  it('formats Arabic numbers and money through Intl rather than by hand', () => {
    // A market-neutral currency code: the terminal reads the real one from the
    // server, and a test is no more entitled to hardcode a market's currency
    // than application code is.
    const arabic = formatMoney('ar', 42_000, 'XTS');
    const english = formatMoney('en', 42_000, 'XTS');
    expect(arabic).toContain('420');
    expect(english).toContain('420');
    expect(formatNumber('ar', 0.88, { style: 'percent' })).toMatch(/88/);
  });

  it('no catalogue string hardcodes a digit in either script', () => {
    // The regression this exists for: the Arabic catalogue spelled "٣٠ يومًا"
    // by hand while every Intl-formatted number on the same screen rendered in
    // Latin digits, because that is what ar-AE does. One screen, two numbering
    // systems. Numbers belong in placeholders so Intl decides, once.
    const offenders: string[] = [];
    for (const language of ['en', 'ar'] as const) {
      for (const key of catalogueKeys(language)) {
        const value = translate(language, key);
        if (/[0-9\u0660-\u0669\u06F0-\u06F9]/.test(value)) offenders.push(`${language}:${key} = ${value}`);
      }
    }
    expect(offenders, 'a digit written into a translation instead of passed as a number').toEqual([]);
  });

  it('formats an interpolated number in the locale of the sentence around it', () => {
    const arabic = translate('ar', 'quote.days30', { days: 30 });
    const english = translate('en', 'quote.days30', { days: 30 });
    expect(arabic).toContain(new Intl.NumberFormat('ar-AE').format(30));
    expect(english).toContain(new Intl.NumberFormat('en-AE').format(30));
    expect(arabic).not.toBe(english);
  });
});
