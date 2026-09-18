import { describe, expect, it } from 'vitest';
import { checkParity, loadCatalogues, REFERENCE_LANGUAGE } from './locales.js';
import { catalogueDir } from './paths.js';

/**
 * Arabic is a launch requirement, not a later addition. A key that exists in
 * English and is missing in Arabic reaches a Sharjah yard as English text on a
 * screen they are expected to answer in ninety seconds, so it fails the build.
 */
describe('locale catalogue parity', () => {
  const set = loadCatalogues(catalogueDir());

  it('has a reference catalogue with a meaningful number of keys', () => {
    expect(set.languages).toContain(REFERENCE_LANGUAGE);
    expect(Object.keys(set.byLanguage[REFERENCE_LANGUAGE] ?? {}).length).toBeGreaterThan(40);
  });

  it('ships every supported language', () => {
    expect(set.languages).toContain('ar');
  });

  it('has no key present in the reference catalogue and missing from another', () => {
    const reports = checkParity(set);
    const failures = reports.filter((r) => r.missing.length > 0 || r.extra.length > 0);
    if (failures.length > 0) {
      const detail = failures
        .map((r) => `  ${r.language}: missing ${r.missing.length} [${r.missing.slice(0, 10).join(', ')}] extra ${r.extra.length} [${r.extra.slice(0, 10).join(', ')}]`)
        .join('\n');
      throw new Error(`\nlocale catalogues are out of parity:\n${detail}\n`);
    }
    expect(failures).toEqual([]);
  });

  it('has no untranslated placeholder left identical to the English', () => {
    const reports = checkParity(set);
    const failures = reports.filter((r) => r.untranslated.length > 0);
    if (failures.length > 0) {
      const detail = failures.map((r) => `  ${r.language}: ${r.untranslated.slice(0, 15).join(', ')}`).join('\n');
      throw new Error(`\nkeys copied from the reference catalogue rather than translated:\n${detail}\n`);
    }
    expect(failures).toEqual([]);
  });
});
