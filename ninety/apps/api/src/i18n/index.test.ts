import { describe, expect, it } from 'vitest';
import { formatDateTime, isRtlLocale, languageOf, resolveLocale, supportedLanguages, t } from './index.js';

describe('localisation', () => {
  it('ships both launch languages', () => {
    expect(supportedLanguages()).toEqual(['ar', 'en']);
  });

  it('falls back to the market default when the user has no preference', () => {
    const marketDefault = 'ar-XX';
    expect(resolveLocale(null, marketDefault)).toBe(marketDefault);
    expect(resolveLocale('en-XX', marketDefault)).toBe('en-XX');
  });

  it('resolves the catalogue from the language subtag, not the whole locale', () => {
    expect(languageOf('ar-XX')).toBe('ar');
    expect(languageOf('EN-XX')).toBe('en');
  });

  it('returns Arabic to an Arabic caller and English to an English one', () => {
    const arabic = t('error.not_found', 'ar-XX');
    const english = t('error.not_found', 'en-XX');
    expect(arabic).not.toBe(english);
    expect(arabic).toMatch(/[؀-ۿ]/);
    expect(english).toMatch(/[A-Za-z]/);
  });

  it('interpolates parameters and leaves unknown placeholders visible', () => {
    const msg = t('notify.buyer.offer_received', 'en-XX', { reference: 'REQ-4471', price: 'X 420', count: 3 });
    expect(msg).toContain('REQ-4471');
    expect(msg).toContain('X 420');
    expect(msg).toContain('3');
    expect(t('notify.buyer.offer_received', 'en-XX')).toContain('{{reference}}');
  });

  it('returns the key itself for an unknown message rather than an empty string', () => {
    expect(t('does.not.exist', 'en-XX')).toBe('does.not.exist');
  });

  it('knows which languages mirror the layout', () => {
    expect(isRtlLocale('ar-XX')).toBe(true);
    expect(isRtlLocale('en-XX')).toBe(false);
  });

  it('formats a timestamp in the market timezone rather than the server one', () => {
    const at = new Date('2026-03-01T06:30:00Z');
    const gulf = formatDateTime(at, 'en-GB', 'Indian/Maldives');
    const utc = formatDateTime(at, 'en-GB', 'UTC');
    expect(gulf).not.toBe(utc);
  });
});
