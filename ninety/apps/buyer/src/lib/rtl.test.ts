import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { translate, catalogueKeys, type Language } from './i18n.js';

/**
 * The buyer app's RTL pass, as far as it can be made mechanical.
 *
 * The terminal's RTL evidence is screenshots, because it is a web page and a
 * browser can be pointed at it. This app is React Native: proving it renders
 * requires an Android emulator, which this container does not have. So what is
 * checked here is everything that CAN be checked without one, and the parts
 * that cannot are written down in docs/GATE-EVIDENCE.md rather than implied.
 *
 * What a screenshot would add, and this cannot: that the mirrored layout looks
 * right to a person who reads Arabic.
 */

const SOURCE_DIRS = ['src', 'src/screens', 'src/lib'];

function sourceFiles(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const dir of SOURCE_DIRS) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || entry.name.endsWith('.test.ts')) continue;
      const path = join(dir, entry.name);
      out.push({ path, text: readFileSync(path, 'utf8') });
    }
  }
  return out;
}

describe('the buyer app mirrors rather than translates', () => {
  it('forces the native layout direction rather than only switching strings', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    // I18nManager.forceRTL is what actually mirrors a React Native layout.
    // Without it, Arabic text renders inside a left-to-right frame, which reads
    // as a translated English app and is exactly what the spec forbids.
    expect(app).toContain('I18nManager.allowRTL');
    expect(app).toContain('I18nManager.forceRTL');
  });

  it('positions with start and end, never with left and right', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      file.text.split('\n').forEach((line, index) => {
        // A physical edge in a style does not mirror. `start`/`end` do.
        if (/\b(marginLeft|marginRight|paddingLeft|paddingRight|left:|right:)\s*:?/.test(line)) {
          offenders.push(`${file.path}:${index + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'a physical edge in a style will not mirror under RTL').toEqual([]);
  });

  it('aligns text by direction rather than always to the left', () => {
    const theme = readFileSync('src/lib/theme.ts', 'utf8');
    expect(theme).toContain('I18nManager.isRTL');
    // Any textAlign in the theme is conditional on direction.
    for (const match of theme.matchAll(/textAlign:\s*([^,\n]+)/g)) {
      expect(match[1], `textAlign: ${match[1]} does not mirror`).toMatch(/isRtl\(\)|'auto'|'center'/);
    }
  });

  it('never hardcodes a directional word that would point the wrong way', () => {
    // "Back" is a direction in a mirrored layout. An arrow typed as a literal
    // points the same way in both, which is right in one of them.
    const offenders: string[] = [];
    for (const language of ['en', 'ar'] as Language[]) {
      for (const key of catalogueKeys(language)) {
        const value = translate(language, key);
        if (/[←→]/.test(value)) offenders.push(`${language}:${key} = ${value}`);
      }
    }
    expect(offenders, 'a directional arrow in a string points one way in both layouts').toEqual([]);
  });

  it('has Arabic copy for every screen, including the empty and error states', () => {
    // The screens a buyer sees on a bad day are the ones most likely to be left
    // in English, because they are the ones nobody demos.
    const required = [
      'waiting.noneYet',
      'waiting.noneYetHint',
      'waiting.widened',
      'waiting.noOffers',
      'accept.authorisedNotCharged',
      'tracking.autoConfirm',
      'errors.network',
      'errors.generic',
    ];
    for (const key of required) {
      const arabic = translate('ar', key);
      const english = translate('en', key);
      expect(arabic, `${key} is missing from Arabic`).not.toBe(key);
      expect(arabic, `${key} was never translated`).not.toBe(english);
      expect(arabic, `${key} has no Arabic script`).toMatch(/[؀-ۿ]/);
    }
  });

  it('leaves long Arabic strings room to wrap rather than truncating them', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      file.text.split('\n').forEach((line, index) => {
        // numberOfLines={1} on a translated string is where Arabic gets cut off:
        // it is routinely longer than the English it was translated from.
        if (/numberOfLines=\{1\}/.test(line)) offenders.push(`${file.path}:${index + 1}`);
      });
    }
    expect(offenders, 'a single-line clamp truncates Arabic that fits in English').toEqual([]);
  });
});
