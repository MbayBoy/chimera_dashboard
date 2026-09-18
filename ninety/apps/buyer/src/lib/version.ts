/**
 * Forced updates.
 *
 * The API reports a minimum supported version and the app blocks below it.
 *
 * This is built now rather than later for one reason: the first breaking API
 * change strands exactly the users who cannot be told to update, because the
 * version that needs updating is the one with no update mechanism in it. Adding
 * it in month three helps everybody except the people who installed in month one
 * — who are the earliest and most valuable buyers.
 */

export interface VersionCheck {
  readonly supported: boolean;
  readonly minimumVersion: string;
  readonly currentVersion: string;
}

/** Semantic comparison. Returns negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function isSupported(currentVersion: string, minimumVersion: string): boolean {
  return compareVersions(currentVersion, minimumVersion) >= 0;
}

export async function checkVersion(apiBase: string, currentVersion: string): Promise<VersionCheck> {
  try {
    const response = await fetch(`${apiBase}/v1/app-version`);
    const body = (await response.json()) as { minimumSupportedVersion: string };
    return {
      supported: isSupported(currentVersion, body.minimumSupportedVersion),
      minimumVersion: body.minimumSupportedVersion,
      currentVersion,
    };
  } catch {
    // A version check that cannot reach the server must not lock a buyer out of
    // an app that would otherwise work. Fail open; the next launch re-checks.
    return { supported: true, minimumVersion: '0.0.0', currentVersion };
  }
}
