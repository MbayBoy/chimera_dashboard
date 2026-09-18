import { describe, expect, it } from 'vitest';
import { containsContactDetails, findContactDetails } from './scrub.js';

/**
 * Contact-detail rejection.
 *
 * Double-blind is the business model, and free text is where it leaks. These
 * cases are the ones the phase document names explicitly, plus the Arabic-Indic
 * bypass, which is obvious and will be used.
 */
describe('contact-detail detection', () => {
  const rejected = [
    ['a South African mobile, spaced', '071 234 5678'],
    ['a South African mobile, international', '+27 71 234 5678'],
    ['a UAE mobile, international', '+971 50 123 4567'],
    ['a UAE mobile, trunk zero', '050 123 4567'],
    ['a UAE mobile, unspaced', '0501234567'],
    ['a UAE landline', '04 123 4567'],
    ['an international form with 00', '0097150 123 4567'],
    ['a number with dots', '050.123.4567'],
    ['a number with dashes', '071-234-5678'],
    ['an email address', 'reach me at yard@example.com'],
    ['an obfuscated email', 'yard [at] example.com'],
    ['a URL', 'see https://example.com/parts'],
    ['a bare domain', 'we are at myyard.ae'],
    ['a WhatsApp link', 'wa.me/971501234567'],
    ['the word WhatsApp', 'whatsapp me for a better price'],
    ['a Telegram handle', 't.me/yardparts'],
    ['a social handle', 'find us @gulfspares'],
    ['a direct solicitation', 'call me before you decide'],
  ] as const;

  for (const [label, text] of rejected) {
    it(`rejects ${label}`, () => {
      const result = findContactDetails(text);
      expect(result.clean, `"${text}" was not rejected`).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]!.messageKey).toMatch(/^scrub\./);
    });
  }

  it('rejects Arabic-Indic digits, which are the obvious bypass', () => {
    expect(containsContactDetails('٠٥٠ ١٢٣ ٤٥٦٧')).toBe(true);
    expect(containsContactDetails('+٩٧١ ٥٠ ١٢٣ ٤٥٦٧')).toBe(true);
    expect(containsContactDetails('٠٧١ ٢٣٤ ٥٦٧٨')).toBe(true);
  });

  it('rejects Arabic phrasing for going off-platform', () => {
    expect(containsContactDetails('واتساب')).toBe(true);
    expect(containsContactDetails('اتصل بي')).toBe(true);
  });

  const allowed = [
    ['a plain price', 'AED 420 firm'],
    ['a model year', 'off a 2019 Patrol, left side'],
    ['a short quantity', 'I have 3 of these'],
    ['an ordinary trade note', 'Good condition, small scratch on the lens, tested working'],
    ['an Arabic trade note', 'حالة ممتازة، خدش بسيط على العدسة'],
    ['a part number with letters', 'OEM 26550-1LB0A, genuine'],
    ['a warranty statement', '90 day warranty, no returns after fitting'],
  ] as const;

  for (const [label, text] of allowed) {
    it(`allows ${label}`, () => {
      const result = findContactDetails(text);
      expect(result.clean, `"${text}" was wrongly rejected as ${result.violations.map((v) => v.kind).join(', ')}`).toBe(true);
    });
  }

  it('reports what was found so the supplier can be told why', () => {
    // Rejected, not silently mangled: a supplier whose note was quietly altered
    // will not understand why the buyer is confused.
    const result = findContactDetails('best price, call 050 123 4567 or yard@example.com');
    expect(result.clean).toBe(false);
    const kinds = new Set(result.violations.map((v) => v.kind));
    expect(kinds.has('phone')).toBe(true);
    expect(kinds.has('email')).toBe(true);
  });

  it('treats empty and absent text as clean', () => {
    expect(findContactDetails(null).clean).toBe(true);
    expect(findContactDetails(undefined).clean).toBe(true);
    expect(findContactDetails('').clean).toBe(true);
  });
});
