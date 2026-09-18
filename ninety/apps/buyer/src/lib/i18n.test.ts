import { describe, expect, it } from 'vitest';
import { catalogueKeys, isRtlLanguage, languageForLocale, translate } from './i18n.js';

/**
 * The buyer app ships in Arabic and English from day one. The same parity rule
 * applies here as everywhere: a key in English and missing in Arabic would reach
 * a UAE buyer as English text in a mirrored layout.
 */
describe('buyer app localisation', () => {
  it('has complete parity between the two launch languages', () => {
    const en = catalogueKeys('en');
    const ar = catalogueKeys('ar');
    expect(en.filter((k) => !ar.includes(k))).toEqual([]);
    expect(ar.filter((k) => !en.includes(k))).toEqual([]);
    expect(en.length).toBeGreaterThan(50);
  });

  it('has no Arabic string left as its English source', () => {
    const untranslated = catalogueKeys('en').filter(
      (key) => translate('ar', key) === translate('en', key) && key !== 'signin.language',
    );
    expect(untranslated).toEqual([]);
  });

  it('resolves the device locale to a language it ships', () => {
    expect(languageForLocale('ar-AE')).toBe('ar');
    expect(languageForLocale('en-GB')).toBe('en');
    // A language we do not ship falls back rather than showing keys.
    expect(languageForLocale('fr-FR')).toBe('en');
    expect(languageForLocale(undefined)).toBe('en');
  });

  it('knows Arabic mirrors the layout', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
  });

  it('states the delivery promise honestly, in both languages', () => {
    // "Typically 90 minutes, up to 3 hours in peak traffic" — never a guarantee.
    // A promise broken twice a week is worse than a slower promise kept.
    expect(translate('en', 'app.promise')).toMatch(/up to 3 hours/i);
    expect(translate('en', 'app.promise')).not.toMatch(/guarantee/i);
    expect(translate('ar', 'app.promise')).toMatch(/[؀-ۿ]/);
    expect(translate('ar', 'app.promise')).toMatch(/٣ ساعات/);
  });

  it('tells a buyer their card is authorised rather than charged', () => {
    expect(translate('en', 'accept.authorisedNotCharged')).toMatch(/not charged/i);
    expect(translate('ar', 'accept.authorisedNotCharged')).toMatch(/[؀-ۿ]/);
  });
});
