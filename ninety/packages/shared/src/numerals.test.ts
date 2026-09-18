import { describe, expect, it } from 'vitest';
import { containsArabicIndicDigits, normaliseDigits, parseAmountToMinorUnits } from './numerals.js';

describe('Arabic-Indic numeral handling', () => {
  it('normalises Gulf Arabic-Indic digits to ASCII', () => {
    expect(normaliseDigits('٤٢٠')).toBe('420');
    expect(normaliseDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('normalises the Persian/Urdu forms common on keyboards in this trade', () => {
    expect(normaliseDigits('۴۲۰')).toBe('420');
  });

  it('handles the Arabic decimal and thousands separators', () => {
    expect(normaliseDigits('١٬٢٣٤٫٥٠')).toBe('1234.50');
  });

  it('detects Arabic-Indic digits anywhere in a string', () => {
    expect(containsArabicIndicDigits('call ٠٥٠')).toBe(true);
    expect(containsArabicIndicDigits('call 050')).toBe(false);
  });

  it('parses a price typed in either script to the same minor units', () => {
    // A yard typing ٤٢٠ on the terminal must not lose the offer inside the
    // fifteen minutes because the price field only understands ASCII.
    expect(parseAmountToMinorUnits('420')).toBe(42_000);
    expect(parseAmountToMinorUnits('٤٢٠')).toBe(42_000);
    expect(parseAmountToMinorUnits('٤٢٠٫٥٠')).toBe(42_050);
    expect(parseAmountToMinorUnits('1,250')).toBe(125_000);
  });

  it('returns null rather than a wrong number for unparseable input', () => {
    expect(parseAmountToMinorUnits('')).toBeNull();
    expect(parseAmountToMinorUnits('abc')).toBeNull();
    expect(parseAmountToMinorUnits('4.2.0')).toBeNull();
  });
});
