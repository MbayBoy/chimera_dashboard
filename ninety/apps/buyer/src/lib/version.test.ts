import { describe, expect, it } from 'vitest';
import { compareVersions, isSupported } from './version.js';

/**
 * The forced-update check.
 *
 * Built now because the first breaking API change strands exactly the users who
 * cannot be told to update: the version needing the update is the one without
 * the mechanism in it.
 */
describe('minimum supported version', () => {
  it('orders versions numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('tolerates a short version string', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
  });

  it('blocks below the minimum and allows at or above it', () => {
    expect(isSupported('1.0.0', '1.1.0')).toBe(false);
    expect(isSupported('1.1.0', '1.1.0')).toBe(true);
    expect(isSupported('1.2.0', '1.1.0')).toBe(true);
  });
});
