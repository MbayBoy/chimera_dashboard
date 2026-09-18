import { describe, expect, it } from 'vitest';
import { negotiateLocale } from './negotiate.js';

describe('Accept-Language negotiation', () => {
  it('picks a supported language', () => {
    expect(negotiateLocale('ar-XX,ar;q=0.9,en;q=0.8')).toBe('ar-XX');
  });

  it('honours quality ordering rather than document order', () => {
    expect(negotiateLocale('fr;q=0.9,ar;q=1.0')).toBe('ar');
  });

  it('skips languages we do not ship', () => {
    expect(negotiateLocale('fr-FR,de;q=0.9')).toBe('en');
  });

  it('falls back on a missing or wildcard header', () => {
    expect(negotiateLocale(undefined)).toBe('en');
    expect(negotiateLocale('*')).toBe('en');
    expect(negotiateLocale('')).toBe('en');
  });

  it('ignores a candidate offered at q=0', () => {
    expect(negotiateLocale('ar;q=0,en;q=0.5')).toBe('en');
  });
});
