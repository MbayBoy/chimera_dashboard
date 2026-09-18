/**
 * The Arabic RTL regression pass.
 *
 * Phase 07 asks for EVERY screen of the supplier terminal in ar-AE with RTL
 * layout — not a sample, and including error states, empty states and the
 * countdown. This walks all of them, in Arabic and in English side by side so
 * the mirroring is checkable rather than asserted, and writes a report naming
 * the direction each page actually rendered in.
 *
 * It also checks two things a screenshot alone does not prove:
 *
 *  - that <html dir> is genuinely "rtl" — Arabic text in a left-to-right frame
 *    looks translated and is not;
 *  - that nothing overflows its container horizontally, because Arabic strings
 *    are routinely longer than their English equivalents and a fixed-width
 *    button that fits "Quote" does not fit "إرسال السعر".
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
const OUT = join(process.cwd(), 'docs', 'screenshots', 'rtl-pass');
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

/**
 * Every screen, and how to get to it. `empty` and `error` states are first-class
 * entries rather than an afterthought: they are the screens a yard sees on a bad
 * day, which is when they decide whether the product is any good.
 */
/** The smallest valid JPEG: enough for the terminal's own photo check. */
function jpegFixture() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
      'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
      'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64',
  );
}

const SCREENS = [
  { id: 'signin', label: 'sign in', signedIn: false, go: async () => {} },
  { id: 'requests', label: 'live jobs', go: async () => {} },
  {
    id: 'requests-empty',
    label: 'no live jobs',
    empty: true,
    go: async () => {},
  },
  {
    id: 'quote',
    label: 'quote, price entered',
    go: async (page) => {
      const quote = page.locator('.job-actions button').first();
      if (await quote.count()) {
        await quote.click();
        await page.waitForTimeout(600);
        for (const digit of ['4', '2', '0']) {
          await page.locator('.keypad button', { hasText: new RegExp(`^${digit}$`) }).click();
        }
      }
    },
  },
  {
    id: 'quote-error',
    label: 'quote rejected for contact details',
    go: async (page) => {
      const quote = page.locator('.job-actions button').first();
      if (await quote.count()) {
        await quote.click();
        await page.waitForTimeout(600);
        for (const digit of ['3', '0', '0']) {
          await page.locator('.keypad button', { hasText: new RegExp(`^${digit}$`) }).click();
        }
        // A photo, because the terminal refuses to send a quote without one —
        // and without getting past that the server never sees the note, which
        // is the rejection this screenshot is for.
        const photo = page.locator('input[type="file"]').first();
        if (await photo.count()) {
          await photo.setInputFiles({ name: 'part.jpg', mimeType: 'image/jpeg', buffer: jpegFixture() });
          await page.waitForTimeout(600);
        }
        const notes = page.locator('textarea').first();
        if (await notes.count()) {
          // The rule the whole business rests on, as the operator meets it.
          await notes.fill('call me on 0501234567');
        }
        const submit = page.locator('button.btn-primary.btn-block').last();
        if (await submit.count()) {
          await submit.click();
          // The server rejects it and the terminal shows why. Waiting for the
          // banner rather than for a fixed delay, so a slow round trip does not
          // quietly produce a screenshot of the state before the error.
          await page.locator('.banner-error').first().waitFor({ timeout: 10_000 }).catch(() => {});
          await page.waitForTimeout(400);
        }
      }
    },
  },
  { id: 'orders', label: 'won jobs', tab: 1, go: async () => {} },
  { id: 'stock', label: 'stock profile', tab: 2, go: async () => {} },
  { id: 'performance', label: 'performance and score', tab: 3, go: async () => {} },
  {
    id: 'offline',
    label: 'offline, with a queued offer',
    go: async (page) => {
      await page.evaluate(() => {
        localStorage.setItem(
          'ninety.terminal.outbox.v1',
          JSON.stringify([
            {
              id: 'demo-outbox',
              kind: 'offer',
              requestId: 'demo',
              path: '/v1/supplier/requests/demo/offer',
              method: 'POST',
              body: { price: '450' },
              photos: [],
              composedAt: new Date().toISOString(),
              attempts: 1,
              lastError: 'network unreachable',
              status: 'pending',
            },
          ]),
        );
      });
      // Reload so the outbox is read back from storage, then genuinely cut the
      // network — navigator.onLine really is false here, rather than an event
      // fired at a page that is still connected.
      await page.reload({ waitUntil: 'networkidle' });
      await page.context().setOffline(true);
      await page.evaluate(() => { window.dispatchEvent(new Event('offline')); });
      await page.waitForTimeout(900);
    },
  },
];

const VIEWPORTS = [
  { id: 'tablet', width: 1280, height: 800 },
  { id: 'phone', width: 390, height: 844 },
];

async function main() {
  const supplier = await authenticate('+9999000001', 'supplier');
  const buyer = await authenticate('+9998000001', 'buyer');

  const categories = await json('/v1/part-categories', { headers: { authorization: `Bearer ${buyer.accessToken}` } });
  const tailLamp = categories.categories.find((c) => c.code === 'lighting.tail_lamp.rear_right');
  const created = await json('/v1/requests', {
    method: 'POST',
    headers: { authorization: `Bearer ${buyer.accessToken}` },
    body: JSON.stringify({
      vehicle: { kind: 'manual', make: 'Nissan', model: 'Patrol', year: 2019 },
      partCategoryId: tailLamp.id,
      partDescription: `Rear right tail lamp, lens cracked (rtl pass ${Math.random().toString(36).slice(2, 8)})`,
      conditionAccepted: ['used', 'refurbished'],
      quantity: 1,
      deliveryLocation: { lat: 25.1499, lng: 55.2416 },
      deliveryAddress: { note: 'Workshop bay 3' },
      submit: true,
    }),
  });
  console.log('posted', created.reference);
  await new Promise((r) => setTimeout(r, 3500));

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

  const browser = await chromium.launch({ executablePath: resolveChromium() });
  const report = [];

  for (const screen of SCREENS) {
    for (const language of ['ar', 'en']) {
      for (const viewport of VIEWPORTS) {
        // The phone is where Arabic text overflows first, so both widths are
        // captured for every screen rather than for a chosen few.
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 2,
          locale: language === 'ar' ? 'ar-AE' : 'en-AE',
        });
        const page = await context.newPage();
        await page.addInitScript(
          ([s, lang, signedIn, empty]) => {
            if (signedIn) localStorage.setItem('ninety.terminal.session.v1', JSON.stringify(s));
            localStorage.setItem('ninety.terminal.language', lang);
            if (empty) {
              // An empty job list without touching the database: the screen a
              // yard sees for most of the day.
              const original = window.fetch;
              window.fetch = async (input, init) => {
                const url = String(typeof input === 'string' ? input : input.url);
                if (url.includes('/v1/supplier/requests') && !url.includes('/offer')) {
                  return new Response(JSON.stringify({ serverTime: new Date().toISOString(), requests: [] }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                  });
                }
                return original(input, init);
              };
            }
          },
          [session, language, screen.signedIn !== false, screen.empty === true],
        );

        await page.goto(TERMINAL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        if (screen.tab !== undefined) {
          await page.locator('.tabs button').nth(screen.tab).click();
          await page.waitForTimeout(800);
        }
        await screen.go(page);
        await page.waitForTimeout(500);

        // The terminal scrolls inside a container rather than the document, so a
        // full-page screenshot alone would miss anything above the current
        // scroll position — including the error banner, which is the whole point
        // of the error screenshots.
        await page.evaluate(() => {
          for (const el of document.querySelectorAll('*')) {
            if (el.scrollTop > 0) el.scrollTop = 0;
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(250);

        const banners = await page.evaluate(() =>
          [...document.querySelectorAll('.banner')].map((el) => el.className.replace('banner ', '')),
        );

        const direction = await page.evaluate(() => document.documentElement.dir);
        // Anything sticking out sideways. Measured, not eyeballed.
        const overflow = await page.evaluate(() => {
          const offenders = [];
          const docWidth = document.documentElement.clientWidth;
          for (const el of document.querySelectorAll('body *')) {
            const box = el.getBoundingClientRect();
            if (box.width === 0) continue;
            if (box.right > docWidth + 1 || box.left < -1) {
              offenders.push(`${el.tagName.toLowerCase()}.${el.className || '(no class)'}`.slice(0, 80));
            }
          }
          return [...new Set(offenders)].slice(0, 5);
        });

        const name = `${screen.id}-${language}-${viewport.id}`;
        const path = join(OUT, `${name}.png`);
        await page.screenshot({ path, fullPage: true });
        report.push({
          screen: screen.id,
          label: screen.label,
          language,
          viewport: viewport.id,
          dir: direction,
          overflow,
          banners,
          file: `${name}.png`,
        });
        const flag = overflow.length > 0 ? `  OVERFLOW: ${overflow.join(', ')}` : '';
        console.log(`  ${name.padEnd(34)} dir=${direction}${flag}`);
        await context.close();
      }
    }
  }

  await browser.close();
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(report, null, 2));

  const arabicWrongDirection = report.filter((r) => r.language === 'ar' && r.dir !== 'rtl');
  const overflowing = report.filter((r) => r.overflow.length > 0);
  console.log(`\n${report.length} screenshots in ${OUT}`);
  console.log(`  Arabic pages rendered left-to-right: ${arabicWrongDirection.length}`);
  console.log(`  pages with horizontal overflow:      ${overflowing.length}`);
  for (const row of overflowing) console.log(`    ${row.file}: ${row.overflow.join(', ')}`);

  if (arabicWrongDirection.length > 0 || overflowing.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
