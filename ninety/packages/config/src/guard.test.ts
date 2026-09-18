import { describe, expect, it } from 'vitest';
import { collectSourceFiles, stripComments } from './scan.js';
import { findViolations, formatViolations, GUARD_RULES } from './rules.js';
import { guardedRoots, repoRoot } from './paths.js';

/**
 * The guard that fails the build.
 *
 * Criterion (f) of the Phase 00 gate is the one that matters most, and it is not
 * satisfied by this test passing — it is satisfied by watching it fail on a
 * deliberate violation. `pnpm guard:demo` in the repo root does exactly that.
 */
describe('no market-specific values in application code', () => {
  const root = repoRoot();
  const files = collectSourceFiles(guardedRoots(root), root);

  it('scans a non-trivial amount of application source', () => {
    // A guard that silently scans nothing passes forever. This is the canary.
    expect(files.length).toBeGreaterThan(20);
  });

  it('finds no hardcoded currency, rate, SLA, locale, timezone, city or country literal', () => {
    const violations = files.flatMap((f) => findViolations(f.relativePath, stripComments(f.contents)));
    if (violations.length > 0) {
      throw new Error(
        `\n${violations.length} market-specific literal(s) in application code:\n\n${formatViolations(violations)}\n\n` +
          `Every one of these belongs in the markets table and must be read through MarketConfigService.\n`,
      );
    }
    expect(violations).toEqual([]);
  });

  it('each rule actually matches the thing it claims to match', () => {
    // A rule with a typo in its regex protects nothing. Every rule is exercised
    // against a sample that must trip it.
    const samples: Record<string, string> = {
      'currency-code-ae': `const c = 'AED';`,
      'currency-code-za': `const c = 'ZAR';`,
      'currency-symbol-concat': `const s = 'R' + amount;`,
      'currency-amount': `const label = "AED 420";`,
      'rate-0-15': `const tax = 0.15;`,
      'rate-0-05': `const tax = 0.05;`,
      'rate-0-11': `const commission = 0.11;`,
      'sla-as-seconds': `const window = 15 * 60;`,
      'locale-za': `const l = 'en-ZA';`,
      'locale-ae': `const l = 'ar-AE';`,
      'locale-en-ae': `const l = 'en-AE';`,
      'rate-0-03': `const fee = 0.03;`,
      'rate-4dp': `const r = 0.1100;`,
      'tax-label': `const label = 'VAT';`,
      timezone: `const tz = 'Asia/Dubai';`,
      'country-name': `const n = 'United Arab Emirates';`,
      'market-code': `const code = 'AE';`,
      'city-name': `const city = 'Sharjah';`,
    };
    for (const rule of GUARD_RULES) {
      const sample = samples[rule.id];
      expect(sample, `no sample for rule ${rule.id}`).toBeDefined();
      expect(findViolations('sample.ts', sample!).some((v) => v.ruleId === rule.id), `rule ${rule.id} did not match its own sample`).toBe(true);
    }
  });

  it('does not flag a market value that only appears in a comment', () => {
    const source = `// the UAE rate is 0.05 and the code is 'AED'\nconst rate = market.tax.rate;\n`;
    expect(findViolations('sample.ts', stripComments(source))).toEqual([]);
  });
});
