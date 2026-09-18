import { languageOf, supportedLanguages, REFERENCE_LANGUAGE } from './index.js';

/**
 * Locale negotiation from `Accept-Language`.
 *
 * A validation failure happens before a body is parsed and before a caller is
 * authenticated, so at that moment the only signal about who is reading the
 * message is the header the client sent. Without this, the first error a Sharjah
 * yard sees — a mistyped phone number on the sign-in screen — arrives in English
 * on an Arabic terminal.
 *
 * This is a provisional locale only. Once the caller is authenticated, their own
 * locale (falling back to the market default) replaces it.
 */
export function negotiateLocale(header: string | undefined): string {
  if (header === undefined || header.trim() === '') return REFERENCE_LANGUAGE;
  const supported = supportedLanguages();

  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q === undefined ? 1 : Number.parseFloat(q.slice(2));
      return { tag: (tag ?? '').trim(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((c) => c.tag !== '' && c.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const candidate of candidates) {
    if (candidate.tag === '*') return REFERENCE_LANGUAGE;
    if (supported.includes(languageOf(candidate.tag))) return candidate.tag;
  }
  return REFERENCE_LANGUAGE;
}
