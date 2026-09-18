/**
 * Arabic-Indic numeral handling.
 *
 * Market #1 is the UAE and much of the used-parts trade operates in Arabic. A
 * supplier typing a price on the terminal may type ٤٢٠ rather than 420, and a
 * price field that silently rejects it costs an offer inside the 15 minutes.
 *
 * Two families are handled: Arabic-Indic (٠-٩, U+0660–0669) used across the
 * Gulf, and Eastern Arabic-Indic (۰-۹, U+06F0–06F9) used in Persian/Urdu
 * keyboards, which are common on devices in this trade.
 */

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;

/** Normalise any Arabic-Indic digits in a string to ASCII digits. */
export function normaliseDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EASTERN_ARABIC_INDIC_ZERO && code <= EASTERN_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EASTERN_ARABIC_INDIC_ZERO);
    } else if (ch === '٫') {
      out += '.'; // Arabic decimal separator
    } else if (ch === '٬') {
      // Arabic thousands separator — drop it
    } else {
      out += ch;
    }
  }
  return out;
}

/** True if the string contains any Arabic-Indic digit. */
export function containsArabicIndicDigits(input: string): boolean {
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) return true;
    if (code >= EASTERN_ARABIC_INDIC_ZERO && code <= EASTERN_ARABIC_INDIC_ZERO + 9) return true;
  }
  return false;
}

/**
 * Parse a user-entered amount (major units, possibly in Arabic-Indic digits)
 * into integer minor units. Returns null when the input is not a number.
 */
export function parseAmountToMinorUnits(input: string, minorUnitExponent = 2): number | null {
  const normalised = normaliseDigits(input).replace(/[\s,]/g, '').trim();
  if (normalised === '' || !/^\d+(\.\d+)?$/.test(normalised)) return null;
  const major = Number(normalised);
  if (!Number.isFinite(major)) return null;
  const minor = Math.round(major * Math.pow(10, minorUnitExponent));
  return Number.isSafeInteger(minor) ? minor : null;
}
