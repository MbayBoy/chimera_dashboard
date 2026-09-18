/**
 * Human-readable references.
 *
 * `REQ-4471` is what both sides of a job say out loud on the phone to NINETY
 * support, so it must be short, unambiguous when spoken, and not sequential in a
 * way that tells a competitor our daily volume. A random base-32 tail over a
 * short rotating prefix gives all three.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U

export function randomReference(prefix: string, length = 6, random: () => number = Math.random): string {
  let tail = '';
  for (let i = 0; i < length; i++) {
    tail += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `${prefix}-${tail}`;
}

export const REQUEST_REFERENCE_PREFIX = 'REQ';
export const ORDER_REFERENCE_PREFIX = 'ORD';

/** Offer labels the buyer sees: Offer A, Offer B, … then AA, AB on overflow. */
export function anonLabelForIndex(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < letters.length) return letters[index]!;
  const first = Math.floor(index / letters.length) - 1;
  const second = index % letters.length;
  return `${letters[first]!}${letters[second]!}`;
}
