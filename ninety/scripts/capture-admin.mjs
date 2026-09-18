/** Capture the ops console against live data. */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API = 'http://localhost:3000';
const ADMIN = 'http://localhost:5174';
const OUT = join(process.cwd(), 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

function resolveChromium() {
  const root = '/opt/pw-browsers';
  const dir = readdirSync(root).find((e) => e.startsWith('chromium-'));
  const path = join(root, dir ?? '', 'chrome-linux', 'chrome');
  return existsSync(path) ? path : undefined;
}

const json = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text}`);
  return text === '' ? {} : JSON.parse(text);
};

const req = await json('/v1/auth/otp/request', { method: 'POST', body: JSON.stringify({ marketCode: 'AE', phone: '+9997000001' }) });
const admin = await json('/v1/auth/otp/verify', {
  method: 'POST',
  body: JSON.stringify({ marketCode: 'AE', phone: '+9997000001', code: req.devCode, role: 'admin' }),
});

const browser = await chromium.launch({ executablePath: resolveChromium() });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
const page = await context.newPage();
await page.addInitScript((s) => localStorage.setItem('ninety.admin.session.v1', JSON.stringify(s)), {
  accessToken: admin.accessToken,
  refreshToken: admin.refreshToken,
  displayName: admin.user.displayName,
});

const views = [
  ['board', 'Live board', 'admin-board'],
  ['metrics', 'Metrics', 'admin-metrics'],
  ['suppliers', 'Supply', 'admin-supply'],
  ['demand', 'Demand', 'admin-demand'],
  ['markets', 'Markets', 'admin-markets'],
];

await page.goto(ADMIN, { waitUntil: 'networkidle' });
for (const [, label, name] of views) {
  await page.locator('.bar nav button', { hasText: label }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  console.log(`  ${name}`);
}
await browser.close();
console.log('admin screenshots captured');
