/**
 * The guard that outlives every other decision.
 *
 * No market-specific value may appear as a literal in application code: not a
 * currency symbol, a tax rate, a commission percentage, an SLA number, a locale
 * string, a timezone, a city or a country name. Everything comes from the
 * `markets` table through MarketConfigService.
 *
 * This looks pedantic on day one. It is the difference between adding the second
 * country in a week and adding it in two months, and it is enforced here rather
 * than in code review because nobody catches this by reading code.
 *
 * The first ten rules are the specified minimum. The rest are the same rule
 * applied to the other values that turned out to be market-specific once the
 * schema existed.
 */

export interface GuardRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly explanation: string;
}

export const GUARD_RULES: readonly GuardRule[] = [
  { id: 'currency-code-ae', pattern: /['"]AED['"]/, explanation: 'currency code — read markets.currency' },
  { id: 'currency-code-za', pattern: /['"]ZAR['"]/, explanation: 'currency code — read markets.currency' },
  { id: 'currency-symbol-concat', pattern: /['"]R['"]\s*\+/, explanation: 'currency symbol — format with Intl and markets.currency' },
  { id: 'currency-amount', pattern: /\bAED\s*\d/, explanation: 'currency-prefixed amount — format with Intl' },
  { id: 'rate-0-15', pattern: /(?<![\d.])0\.15(?![\d])/, explanation: 'tax rate — read markets.tax_rate' },
  { id: 'rate-0-05', pattern: /(?<![\d.])0\.05(?![\d])/, explanation: 'tax rate — read markets.tax_rate' },
  { id: 'rate-0-11', pattern: /(?<![\d.])0\.11(?![\d])/, explanation: 'commission rate — read markets.commission_rate' },
  { id: 'sla-as-seconds', pattern: /\b(?:15|30|90|75)\s*\*\s*60\b/, explanation: 'SLA minutes as seconds — read markets.sla_*_min' },
  { id: 'locale-za', pattern: /['"]en-ZA['"]/, explanation: 'locale string — read markets.locale_default' },
  { id: 'locale-ae', pattern: /['"]ar-AE['"]/, explanation: 'locale string — read markets.locale_default' },

  { id: 'locale-en-ae', pattern: /['"]en-AE['"]/, explanation: 'locale string — read markets.locales_supported' },
  { id: 'rate-0-03', pattern: /(?<![\d.])0\.03(?![\d])/, explanation: 'buyer fee rate — read markets.buyer_fee_rate' },
  { id: 'rate-4dp', pattern: /(?<![\d.])0\.(?:0500|1500|1100|0300)(?![\d])/, explanation: 'market rate — read it from markets' },
  { id: 'tax-label', pattern: /['"]VAT['"]/, explanation: 'tax label — read markets tax label' },
  { id: 'timezone', pattern: /['"](?:Asia\/Dubai|Africa\/Johannesburg)['"]/, explanation: 'timezone — read markets.timezone' },
  { id: 'country-name', pattern: /['"](?:United Arab Emirates|South Africa)['"]/, explanation: 'country name — read markets.name' },
  { id: 'market-code', pattern: /['"](?:ZA|AE)['"]/, explanation: 'market code — resolve the market from the caller' },
  {
    id: 'city-name',
    pattern: /['"](?:Dubai|Sharjah|Abu Dhabi|Johannesburg|Cape Town|Durban|Al Sajaa|Mussafah)['"]/,
    explanation: 'city name — read it from cities',
  },
];

export interface GuardViolation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly ruleId: string;
  readonly explanation: string;
  readonly snippet: string;
}

export function findViolations(relativePath: string, sourceWithoutComments: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  const lines = sourceWithoutComments.split('\n');
  for (const rule of GUARD_RULES) {
    lines.forEach((line, i) => {
      const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
      for (const m of line.matchAll(re)) {
        violations.push({
          file: relativePath,
          line: i + 1,
          column: (m.index ?? 0) + 1,
          ruleId: rule.id,
          explanation: rule.explanation,
          snippet: line.trim().slice(0, 160),
        });
      }
    });
  }
  return violations.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function formatViolations(violations: readonly GuardViolation[]): string {
  if (violations.length === 0) return 'no market-specific literals in application code';
  return violations
    .map((v) => `  ${v.file}:${v.line}:${v.column}  [${v.ruleId}] ${v.explanation}\n      ${v.snippet}`)
    .join('\n');
}
