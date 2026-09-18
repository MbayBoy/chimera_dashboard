/**
 * Generate docs/UNHAPPY-PATHS.md from the shipping message catalogues.
 *
 * The document is generated rather than written because the failure mode this
 * phase warns about is a catalogue of copy that drifts from the product: a
 * message gets reworded in the app, the document keeps the old wording, and the
 * launch team quotes the document. Every line of copy below is read out of
 * apps/api/src/i18n/catalogues at generation time, so the two cannot disagree.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const en = JSON.parse(readFileSync(join(root, 'apps/api/src/i18n/catalogues/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/api/src/i18n/catalogues/ar.json'), 'utf8'));

const at = (catalogue, path) => path.split('.').reduce((node, part) => node?.[part], catalogue);

/**
 * The ten paths Phase 07 names, each with where it is handled, what the system
 * does, the test that proves it, and the exact words the person receives.
 */
const PATHS = [
  {
    n: 1,
    title: 'Zero offers at the response deadline',
    behaviour:
      'The search widens to tier 2: the stock-profile weight is dropped, the radius is extended by half, and lower-scored yards are included. The buyer is told, with the new deadline as an absolute time.',
    code: 'apps/api/src/matching/hooks.ts — onResponseDeadline',
    test: 'tests/unhappy-paths.test.ts — "zero offers at the response deadline"',
    audience: 'buyer',
    keys: ['notify.buyer.search_widened'],
  },
  {
    n: 2,
    title: 'Zero offers after the widened search',
    behaviour:
      'The request closes honestly, a demand miss is logged with the part, the vehicle, the place and the time, and the buyer is told plainly that nobody had it. Never silence.',
    code: 'apps/api/src/matching/hooks.ts — onWideningDeadline',
    test: 'tests/unhappy-paths.test.ts — "zero offers after widening"',
    audience: 'buyer',
    keys: ['notify.buyer.no_offers', 'notify.buyer.no_supply'],
  },
  {
    n: 3,
    title: 'A yard withdraws an offer before the buyer chooses',
    behaviour:
      'The offer disappears from the buyer\'s list; the others are untouched. No score penalty — withdrawing an open quote is honest, and punishing it produces yards who quote on stock they do not have.',
    code: 'apps/api/src/routes/supplier.ts — POST /v1/supplier/offers/:id/withdraw',
    test: 'tests/unhappy-paths.test.ts — "supplier withdraws after offering"',
    audience: 'buyer',
    keys: ['notify.buyer.offer_withdrawn', 'unhappy.supplier_withdrew_before_accept'],
  },
  {
    n: 4,
    title: 'A yard withdraws an offer the buyer had already accepted',
    behaviour:
      'The card authorisation is voided immediately, the request returns to selection with the other offers still open, and the yard takes a score penalty — the buyer was let down after committing.',
    code: 'apps/api/src/matching/hooks.ts — onOfferWithdrawn',
    test: 'tests/unhappy-paths.test.ts — "supplier withdraws an ACCEPTED offer"',
    audience: 'buyer',
    keys: ['notify.buyer.accepted_offer_withdrawn'],
  },
  {
    n: 5,
    title: 'The buyer cancels',
    behaviour:
      'Defined in every state. Any held authorisation is voided BEFORE the state changes, so a failure to void leaves the request visibly open rather than closed and wrong. Which message is sent depends on whether a driver already has the part.',
    code: 'apps/api/src/requests/routes.ts — POST /v1/requests/:id/cancel',
    test: 'tests/unhappy-paths.test.ts — "the buyer cancels"',
    audience: 'buyer',
    keys: ['unhappy.buyer_cancelled_authorised', 'unhappy.buyer_cancelled_dispatched'],
  },
  {
    n: 6,
    title: 'The card is declined',
    behaviour:
      'The request stays in selection with every offer intact. Fifteen minutes of supplier effort is not thrown away because one card failed; the buyer picks another card or another offer.',
    code: 'apps/api/src/payments/service.ts — acceptOfferAndAuthorise',
    test: 'tests/unhappy-paths.test.ts — "the card is declined"',
    audience: 'buyer',
    keys: ['error.payment_failed', 'notify.buyer.payment_failed'],
  },
  {
    n: 7,
    title: 'The courier fails after collection',
    behaviour:
      'The part physically exists and is in a van. An ops escalation is raised with the request attached, the buyer is told honestly and promised a call, and the yard takes NO score penalty — they did their job.',
    code: 'apps/api/src/logistics/service.ts — onCourierFailure',
    test: 'tests/unhappy-paths.test.ts — "the courier fails after collection"',
    audience: 'buyer',
    keys: ['notify.buyer.courier_failed_after_collection', 'notify.buyer.courier_all_failed'],
  },
  {
    n: 8,
    title: 'The part arrives damaged or wrong',
    behaviour:
      'A dispute, raised by either side, with evidence from both. Only an admin resolves it. The outcome is expressed as what the buyer ends up paying; the money moves by refund, void or reduced capture depending on where it already is.',
    code: 'apps/api/src/disputes/service.ts — resolveDispute',
    test: 'tests/disputes.test.ts',
    audience: 'buyer',
    keys: ['notify.buyer.dispute_opened', 'notify.buyer.dispute_resolved', 'notify.buyer.refund_issued'],
  },
  {
    n: 9,
    title: 'The buyer never confirms receipt',
    behaviour:
      'The order auto-confirms after the market\'s own window (24 hours in the UAE) and the card is captured. The buyer is told it happened and that they can still raise a problem.',
    code: 'apps/api/src/logistics/service.ts — autoConfirmDelivery',
    test: 'tests/unhappy-paths.test.ts — "the buyer never confirms"',
    audience: 'buyer',
    keys: ['notify.buyer.auto_confirmed'],
  },
  {
    n: 10,
    title: 'The same request is posted twice',
    behaviour:
      'Detected and refused with a warning naming the existing request, not silently fanned out to the same yards a second time. The buyer can post it again deliberately once warned.',
    code: 'apps/api/src/requests/service.ts — duplicate detection',
    test: 'tests/unhappy-paths.test.ts — "a duplicate is detected"',
    audience: 'buyer',
    keys: ['error.duplicate_request', 'unhappy.duplicate_detected'],
  },
  {
    n: 11,
    title: 'A terminal is offline when the job goes out',
    behaviour:
      'Recorded as "unreachable", never as "no response". The score delta for unreachable is exactly zero. Penalising a yard for a power cut is the fastest way to lose the yards that took three months to sign.',
    code: 'apps/api/src/matching/hooks.ts — markNonResponders',
    test: 'tests/unhappy-paths.test.ts — "a terminal offline at fan-out"',
    audience: 'supplier',
    keys: ['notify.supplier.offline_not_penalised', 'unhappy.terminal_offline_at_fanout'],
  },
  {
    n: 12,
    title: 'A yard tries to put contact details in a note',
    behaviour:
      'Rejected, never silently mangled, in Latin and Arabic-Indic numerals alike — and the yard is told WHY the rule exists, because a supplier who only sees a refusal concludes the product is broken.',
    code: 'packages/shared/src/scrub.ts, apps/terminal/src/components/QuoteScreen.tsx',
    test: 'packages/shared — scrub tests; the RTL pass captures the screen',
    audience: 'supplier',
    keys: ['scrub.rejected', 'scrub.why'],
  },
];

const lines = [];
lines.push('# Unhappy paths, and what we say');
lines.push('');
lines.push(
  'Generated by `node scripts/generate-unhappy-paths.mjs` from the message catalogues the product actually ships ' +
    '(`apps/api/src/i18n/catalogues/*.json`). Do not edit by hand — edit the copy and regenerate, or the document and ' +
    'the product will disagree and the launch team will quote the document.',
);
lines.push('');
lines.push(
  'The rule behind all of it: the handling is not the feature, the message is. A buyer who receives "Error: 409" ' +
    'decides the product is broken and tells the other workshops.',
);
lines.push('');
lines.push('| # | Path | Told to | Message keys |');
lines.push('|---|------|---------|--------------|');
for (const path of PATHS) {
  lines.push(`| ${path.n} | ${path.title} | ${path.audience} | ${path.keys.map((k) => `\`${k}\``).join('<br>')} |`);
}
lines.push('');

for (const path of PATHS) {
  lines.push(`## ${path.n}. ${path.title}`);
  lines.push('');
  lines.push(`**What happens.** ${path.behaviour}`);
  lines.push('');
  lines.push(`**Where.** \`${path.code}\``);
  lines.push('');
  lines.push(`**Proved by.** \`${path.test}\``);
  lines.push('');
  for (const key of path.keys) {
    const english = at(en, key);
    const arabic = at(ar, key);
    if (english === undefined) throw new Error(`missing English copy for ${key}`);
    if (arabic === undefined) throw new Error(`missing Arabic copy for ${key}`);
    lines.push(`**\`${key}\`**`);
    lines.push('');
    lines.push('> ' + String(english).replace(/\n/g, '\n> '));
    lines.push('');
    lines.push('> ' + String(arabic).replace(/\n/g, '\n> '));
    lines.push('');
  }
}

lines.push('## Every message, both languages');
lines.push('');
lines.push('The full catalogue, so nothing below is quoted out of context.');
lines.push('');
const flatten = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'string' ? [[prefix === '' ? key : `${prefix}.${key}`, value]] : flatten(value, prefix === '' ? key : `${prefix}.${key}`),
  );
lines.push('| Key | English | العربية |');
lines.push('|-----|---------|---------|');
for (const [key, english] of flatten(en)) {
  const arabic = at(ar, key) ?? '';
  const clean = (s) => String(s).replace(/\|/g, '\\|');
  lines.push(`| \`${key}\` | ${clean(english)} | ${clean(arabic)} |`);
}
lines.push('');

writeFileSync(join(root, 'docs', 'UNHAPPY-PATHS.md'), lines.join('\n'));
console.log(`wrote docs/UNHAPPY-PATHS.md — ${PATHS.length} paths, ${flatten(en).length} message keys`);
