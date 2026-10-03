// The built extension in a real Chromium, loaded as an unpacked extension (npm run test:ext builds
// first). The shop pages are served at their real host names from test-fixtures (no network):
// the panel must find every order line, save a .cinv.json the app accepts, and keep the "save as
// file" fallback after sending by link. Every request to a real host is answered locally or aborted.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { chromiumPath, ROOT } from '../../tests/ui/harness.mjs';

// The app's own validator, bundled from packages/cinv for this Node script.
const cinvJs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cinv-core-')), 'cinv.mjs');
await build({ entryPoints: [path.join(ROOT, 'packages/cinv/src/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile: cinvJs, logLevel: 'warning' });
const { parseCinvPayload } = await import(pathToFileURL(cinvJs).href);

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fixtures = path.join(ROOT, 'test-fixtures', 'orders');
const expected = JSON.parse(fs.readFileSync(path.join(fixtures, 'expected.json'), 'utf8'));
const PAGES = {
  'https://www.ozdisan.com/kontrol-paneli/siparis-durum-gecmisi/siparis-detay/1/ozet': ['ozdisan', 'ozdisan-order-detail.html'],
  'https://www.motorobit.com/uye-siparisleri#/detail/1': ['motorobit', 'motorobit-order-detail.html'],
  'https://www.robocombo.com/Hesabim.aspx#/Siparislerim': ['robocombo', 'robocombo-order-detail.html'],
};
const cart = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Sepet</title>
<script>window.dataLayer=[{event:'page_view'},{event:'view_cart',ecommerce:{items:[
 {item_id:'48213',item_name:"10K Direnç 1/4W 10'lu Paket",quantity:2},{item_id:'LM7805',item_name:'LM7805 Regülatör TO-220',quantity:3}]}}];</script></head><body><h1>Sepetim</h1></body></html>`;

let failed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(cond ? 'ok  ' : 'FAIL', '|', name, extra ? `| ${extra}` : '');
};

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cinv-ext-'));
const ctx = await chromium.launchPersistentContext(profile, {
  // Extensions need full Chromium; Playwright's default headless build (the "headless shell")
  // cannot load them, so the chromium channel is asked for when no browser path is configured.
  ...(chromiumPath() ? { executablePath: chromiumPath() } : { channel: 'chromium' }),
  headless: true,
  acceptDownloads: true,
  locale: 'tr-TR',
  // chrome.i18n follows the browser's UI language, which Chromium on Linux takes from LANGUAGE.
  env: { ...process.env, LANGUAGE: 'tr', LANG: 'tr_TR.UTF-8' },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--headless=new', '--lang=tr-TR'],
});
const external = [];
await ctx.route('**/*', (r) => {
  const url = r.request().url();
  const page = Object.entries(PAGES).find(([u]) => url === u.split('#')[0]);
  if (page) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(fixtures, page[1][1]), 'utf8') });
  if (url === 'https://www.robotistan.com/sepet') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: cart });
  if (url.startsWith('chrome-extension://') || url.startsWith('data:') || url.startsWith('blob:')) return r.continue();
  external.push(url);
  return r.abort();
});
const errors = [];

async function panelOf(page) {
  // The panel is in an open shadow root, which Playwright's locators pierce.
  await page.waitForFunction(() => !!document.querySelector('[data-cinv]'), null, { timeout: 15000 });
  return page.locator('[data-cinv]');
}

async function saveFrom(page) {
  const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  await page.getByRole('button', { name: /Dosya olarak kaydet/ }).first().click();
  const d = await dl;
  return d ? JSON.parse(fs.readFileSync(await d.path(), 'utf8')) : null;
}

for (const [url, [shop]] of Object.entries(PAGES)) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${shop}: ${e.message}`));
  await page.goto(url);
  await panelOf(page);
  await page.getByRole('status').filter({ hasText: /kalem bulundu/ }).waitFor({ timeout: 15000 });
  const status = await page.getByRole('status').filter({ hasText: /kalem bulundu/ }).textContent();
  const want = expected[shop];
  check(`${shop}: the panel finds ${want.length} lines`, status.includes(`${want.length} kalem`), status);
  const payload = await saveFrom(page);
  const parsed = payload ? parseCinvPayload(payload) : null;
  check(`${shop}: the saved file passes the app's validator`, parsed?.ok === true);
  if (parsed?.ok) {
    const pieces = parsed.payload.items.reduce((a, i) => a + i.qty * i.packSize, 0);
    check(`${shop}: pieces match expected.json`, pieces === want.reduce((a, i) => a + i.pieces, 0), `${pieces}`);
  }
  await page.close();
}

// A cart from the dataLayer, sent by link; the fallback stays one click away.
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`cart: ${e.message}`));
await page.goto('https://www.robotistan.com/sepet');
await panelOf(page);
await page.getByRole('status').filter({ hasText: /2 kalem bulundu/ }).waitFor({ timeout: 15000 });
await page.getByRole('button', { name: /Uygulamaya aktar/ }).click().catch(() => {});
await page.getByRole('alert').filter({ hasText: /gönderildi/ }).waitFor({ timeout: 5000 }).catch(() => {});
check('after sending, the fallback is offered', await page.getByRole('button', { name: /Açılmadı mı/ }).count() === 1);
const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
// The browser's "open component-inventory?" prompt swallows real mouse input in automation; a
// person answers it first. The click is dispatched to the element.
await page.getByRole('button', { name: /Açılmadı mı/ }).dispatchEvent('click');
const d = await dl;
const p2 = d ? JSON.parse(fs.readFileSync(await d.path(), 'utf8')) : null;
check("the fallback saves the cart; \"10'lu\" is not a pack at Robotistan", p2?.items?.map((i) => `${i.qty}x${i.packSize ?? 1}`).join(',') === '2x1,3x1', JSON.stringify(p2?.items));
check('no page errors', errors.length === 0, errors.join(' ; '));
check('no requests to other hosts', external.length === 0, external.slice(0, 5).join(' '));

await ctx.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
