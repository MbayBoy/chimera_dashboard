import { normaliseDigits } from './numerals.js';

/**
 * Contact-detail detection for free text.
 *
 * Suppliers will try to put a phone number in the notes field — sometimes to be
 * helpful, sometimes to take the next deal off-platform. Either way it is the
 * end of the double-blind, so free text is REJECTED rather than silently
 * mangled: a supplier whose note was quietly altered will not understand why the
 * buyer is confused, and will assume the product is broken.
 *
 * Detection is deliberately market-agnostic. It recognises phone numbers by
 * shape rather than by country, so adding a third market does not mean editing
 * this file — which is the same reason no currency or tax rate appears in
 * application code. Both UAE (+971 50 123 4567, 050 123 4567) and South African
 * (+27 71 234 5678, 071 234 5678) forms fall out of the general rule, and so do
 * their Arabic-Indic equivalents, because the text is digit-normalised first.
 */

export type ContactViolationKind = 'phone' | 'email' | 'url' | 'handle' | 'solicitation';

export interface ContactViolation {
  readonly kind: ContactViolationKind;
  /** The offending fragment, as it appeared in the user's own text. */
  readonly fragment: string;
  /** i18n key explaining this specific violation to the author. */
  readonly messageKey: string;
}

export interface ScrubResult {
  readonly clean: boolean;
  readonly violations: readonly ContactViolation[];
}

const EMAIL = /[A-Za-z0-9._%+-]+\s*(?:@|\[at\]|\(at\))\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const URL =
  /\b(?:https?:\/\/|www\.)[^\s]+|\b[A-Za-z0-9-]+\.(?:com|net|org|ae|za|co\.za|io|me|app|link|biz|info|shop)\b(?:\/[^\s]*)?/gi;

/**
 * Messaging handles and the phrases that introduce one. The Arabic terms matter:
 * the supplier terminal is used in Arabic and "واتساب" is how the request to go
 * off-platform is actually phrased in this trade.
 */
const HANDLE =
  /\b(?:wa\.me|whats\s?app|whatsapp|telegram|t\.me|viber|imo\b|botim|snapchat|instagram|insta\b|facebook|fb\b|messenger)\b|(?:^|\s)@[A-Za-z0-9._]{3,}/gi;

const HANDLE_AR = /(?:واتس\s?اب|واتساب|تليجرام|تلجرام|انستقرام|انستغرام|سناب\s?شات|بوتيم)/g;

/** "call me", "ring me", "contact me on", and the Arabic equivalents. */
const SOLICITATION =
  /\b(?:call\s+me|ring\s+me|phone\s+me|contact\s+me|text\s+me|message\s+me|reach\s+me)\b|(?:اتصل\s+ب?ي|كلمني|تواصل\s+مع?ي|رقمي)/gi;

/**
 * Phone-number shapes.
 *
 * A candidate is a run of digits and common separators. It counts as a phone
 * number when it carries 7–15 digits and either starts with an international
 * prefix or a trunk zero, or is grouped the way people write phone numbers.
 * A bare undecorated run needs 8 digits before we call it a number, so that a
 * part number or a mileage figure is not rejected for looking like one.
 */
const PHONE_CANDIDATE = /(?:\+|00)?[\d][\d\s().‐-―/-]{5,}[\d]/g;

const MIN_DIGITS_WITH_PREFIX = 7;
const MIN_DIGITS_BARE = 8;
const MAX_PHONE_DIGITS = 15;

/**
 * Shapes that look like phone numbers and are not.
 *
 * Dates are the common one: a yard writing "received 12-03-2024" or a system
 * stamping an ISO date into a description must not be told their note contains a
 * phone number. A false positive here is not harmless — the note is rejected
 * outright, so the supplier loses the ninety seconds and learns to distrust the
 * field.
 */
const DATE_SHAPES: readonly RegExp[] = [
  /^\s*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*$/, // 2026-09-18
  /^\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s*$/, // 18-09-2026, 18/9/26
];

function isDateShaped(candidate: string): boolean {
  return DATE_SHAPES.some((shape) => shape.test(candidate));
}

function isPhoneLike(candidate: string): boolean {
  if (isDateShaped(candidate)) return false;
  const digits = candidate.replace(/\D/g, '');
  if (digits.length > MAX_PHONE_DIGITS) return false;
  const hasInternationalPrefix = /^\s*(?:\+|00)/.test(candidate);
  const hasTrunkZero = /^\s*0/.test(candidate);
  const isGrouped = /\d[\s.‐-―-]\d/.test(candidate);
  if (hasInternationalPrefix || hasTrunkZero) return digits.length >= MIN_DIGITS_WITH_PREFIX;
  if (isGrouped) return digits.length >= MIN_DIGITS_WITH_PREFIX;
  return digits.length >= MIN_DIGITS_BARE;
}

/**
 * Inspect free text for contact details.
 *
 * The text is digit-normalised before matching so Arabic-Indic numerals — the
 * obvious bypass, and one that will be used — are caught by exactly the same
 * rules as ASCII digits. Offsets are preserved because normalisation maps each
 * digit to a single digit, so fragments can be reported in the author's own
 * script.
 */
export function findContactDetails(input: string | null | undefined): ScrubResult {
  if (!input) return { clean: true, violations: [] };

  const original = input;
  const normalised = normaliseDigits(input);
  const violations: ContactViolation[] = [];

  const push = (kind: ContactViolationKind, start: number, length: number, messageKey: string) => {
    const fragment =
      normalised.length === original.length ? original.slice(start, start + length) : normalised.slice(start, start + length);
    violations.push({ kind, fragment: fragment.trim(), messageKey });
  };

  for (const m of normalised.matchAll(EMAIL)) {
    push('email', m.index ?? 0, m[0].length, 'scrub.email');
  }
  for (const m of normalised.matchAll(URL)) {
    push('url', m.index ?? 0, m[0].length, 'scrub.url');
  }
  for (const m of normalised.matchAll(HANDLE)) {
    push('handle', m.index ?? 0, m[0].length, 'scrub.handle');
  }
  for (const m of original.matchAll(HANDLE_AR)) {
    violations.push({ kind: 'handle', fragment: m[0], messageKey: 'scrub.handle' });
  }
  for (const m of normalised.matchAll(SOLICITATION)) {
    push('solicitation', m.index ?? 0, m[0].length, 'scrub.solicitation');
  }
  for (const m of normalised.matchAll(PHONE_CANDIDATE)) {
    if (isPhoneLike(m[0])) push('phone', m.index ?? 0, m[0].length, 'scrub.phone');
  }

  // A fragment already reported as a URL or email often also looks like a phone
  // number. Report each span once, preferring the more specific kind.
  const deduped = dedupeOverlapping(violations);
  return { clean: deduped.length === 0, violations: deduped };
}

function dedupeOverlapping(violations: ContactViolation[]): ContactViolation[] {
  const seen = new Set<string>();
  const out: ContactViolation[] = [];
  const priority: Record<ContactViolationKind, number> = {
    email: 0,
    url: 1,
    handle: 2,
    solicitation: 3,
    phone: 4,
  };
  const sorted = [...violations].sort((a, b) => priority[a.kind] - priority[b.kind]);
  for (const v of sorted) {
    const key = v.fragment.replace(/\s+/g, '');
    if (key === '') continue;
    let covered = false;
    for (const s of seen) {
      if (s.includes(key) || key.includes(s)) {
        covered = true;
        break;
      }
    }
    if (covered) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Convenience predicate for call sites that only need yes or no. */
export function containsContactDetails(input: string | null | undefined): boolean {
  return !findContactDetails(input).clean;
}
