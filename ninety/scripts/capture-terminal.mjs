/**
 * Capture the supplier terminal, as a real browser renders it.
 *
 * Phase 01 asks for the terminal at 1280x800 and at 390px wide, and for Arabic
 * with a mirrored layout — not Arabic text in a left-to-right frame. Screenshots
 * are the evidence, so they are produced by a script anyone can re-run rather
 * than pasted in once.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function resolveChromium() {
  const root = '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const candidates = readdirSync(root)
    .filter((entry) => entry.startsWith('chromium-'))
    .map((entry) => join(root, entry, 'chrome-linux', 'chrome'))
    .filter((path) => existsSync(path));
  return candidates[0];
}

const API = process.env.API_BASE ?? 'http://localhost:3000';
const TERMINAL = process.env.TERMINAL_BASE ?? 'http://localhost:5173';
const OUT = join(process.cwd(), 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const json = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text}`);
  return text === '' ? {} : JSON.parse(text);
};

async function authenticate(phone, role) {
  const request = await json('/v1/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ marketCode: 'AE', phone }),
  });
  return json('/v1/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ marketCode: 'AE', phone, code: request.devCode, role }),
  });
}

async function main() {
  const supplier = await authenticate('+9999000001', 'supplier');
  const buyer = await authenticate('+9998000001', 'buyer');
  console.log('authenticated supplier and buyer');

  // A live job for the terminal to show.
  const categories = await json('/v1/part-categories', { headers: { authorization: `Bearer ${buyer.accessToken}` } });
  const tailLamp = categories.categories.find((c) => c.code === 'lighting.tail_lamp.rear_right');
  const created = await json('/v1/requests', {
    method: 'POST',
    headers: { authorization: `Bearer ${buyer.accessToken}` },
    body: JSON.stringify({
      vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
      partCategoryId: tailLamp.id,
      // Unique per run: duplicate detection is working as designed and would
      // otherwise reject the second capture.
      partDescription: `Rear right tail lamp, lens cracked (run ${Math.random().toString(36).slice(2, 8)})`,
      conditionAccepted: ['used', 'refurbished'],
      quantity: 1,
      deliveryLocation: { lat: 25.1499, lng: 55.2416 },
      deliveryAddress: { note: 'Workshop bay 3' },
      submit: true,
    }),
  });
  console.log('posted request', created.reference);
  await new Promise((r) => setTimeout(r, 3000));

  const live = await json('/v1/supplier/requests', { headers: { authorization: `Bearer ${supplier.accessToken}` } });
  console.log(`terminal sees ${live.requests.length} live job(s)`);
  if (live.requests.length === 0) console.warn('WARNING: no live job reached this yard; screenshots will show the empty state');

  // The sandbox pins a specific Chromium build; resolve it rather than assuming
  // a version-less path, so this keeps working when the image is updated.
  const browser = await chromium.launch({ executablePath: resolveChromium() });

  // Built exactly as the sign-in screen builds it, from the server.
  const me = await json('/v1/auth/me', { headers: { authorization: `Bearer ${supplier.accessToken}` } });
  const session = {
    accessToken: supplier.accessToken,
    refreshToken: supplier.refreshToken,
    locale: supplier.user.locale,
    rtl: supplier.user.rtl,
    marketCode: supplier.user.marketCode,
    currency: me.market.currency,
    currencyExponent: me.market.currencyMinorUnitExponent,
    commissionRate: me.terms?.commissionRate ?? 0,
    timezone: me.market.timezone,
    displayName: supplier.user.displayName,
  };

  const shots = [
    { name: 'terminal-requests-ar-tablet', width: 1280, height: 800, language: 'ar', screen: 'requests' },
    { name: 'terminal-requests-en-tablet', width: 1280, height: 800, language: 'en', screen: 'requests' },
    { name: 'terminal-requests-ar-phone', width: 390, height: 844, language: 'ar', screen: 'requests' },
    { name: 'terminal-requests-en-phone', width: 390, height: 844, language: 'en', screen: 'requests' },
    { name: 'terminal-quote-ar-tablet', width: 1280, height: 800, language: 'ar', screen: 'quote' },
    { name: 'terminal-quote-en-phone', width: 390, height: 844, language: 'en', screen: 'quote' },
    { name: 'terminal-performance-ar-phone', width: 390, height: 844, language: 'ar', screen: 'performance' },
    { name: 'terminal-stock-en-tablet', width: 1280, height: 800, language: 'en', screen: 'stock' },
  ];

  const report = [];
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
      locale: shot.language === 'ar' ? 'ar-AE' : 'en-AE',
    });
    const page = await context.newPage();
    await page.addInitScript(
      ([s, lang]) => {
        localStorage.setItem('ninety.terminal.session.v1', JSON.stringify(s));
        localStorage.setItem('ninety.terminal.language', lang);
      },
      [session, shot.language],
    );
    await page.goto(TERMINAL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    if (shot.screen === 'quote') {
      const quote = page.locator('.job-actions button').first();
      if (await quote.count()) {
        await quote.click();
        await page.waitForTimeout(700);
        // Type a price so the payout line — the commercial point of this screen
        // — is visible rather than an empty field.
        for (const digit of ['4', '2', '0']) {
          await page.locator('.keypad button', { hasText: new RegExp(`^${digit}$`) }).click();
        }
        await page.waitForTimeout(300);
      }
    } else if (shot.screen !== 'requests') {
      const index = shot.screen === 'performance' ? 3 : 2;
      await page.locator('.tabs button').nth(index).click();
      await page.waitForTimeout(900);
    }

    const direction = await page.evaluate(() => document.documentElement.dir);
    const path = join(OUT, `${shot.name}.png`);
    await page.screenshot({ path, fullPage: true });
    report.push({ ...shot, dir: direction, path });
    console.log(`  ${shot.name}  ${shot.width}x${shot.height}  dir=${direction}`);
    await context.close();
  }

  await browser.close();
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(report, null, 2));
  console.log(`\nwrote ${report.length} screenshots to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
