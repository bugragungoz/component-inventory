// Layout checks across languages: Turkish (the owner's), the pseudo-locale (accented, about 40 %
// longer), German (long words), Arabic (right to left), Chinese and Russian, in both themes, at the
// app's minimum window size.
// For each screen: no horizontal page overflow, and no button, tab or navigation label cut off.
// Screenshots go to test-results/visual/ for a person to look at. `npm run test:visual`.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startHarness } from './harness.mjs';

const out = path.join(ROOT, 'test-results', 'visual');
fs.mkdirSync(out, { recursive: true });
let failed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(cond ? 'ok  ' : 'FAIL', '|', name, extra ? `| ${extra}` : '');
};

const part = (code, category, subcategory, quantity, location = '') => ({
  id: null, part_code: code, category, subcategory, quantity, package: 'TO-220', manufacturer: 'Texas Instruments', mpn: '', location, preferred_supplier: 'Özdisan',
  voltage_max: 35, current_max: 1.5, resistance: '', tolerance: '', power_rating: null, description: 'Long description of a part to see how the table copes with it',
  datasheet_url: '', unit_price: null, notes: '', image_path: '', attributes: {}, custom_fields: {},
});

/** Elements whose text is wider than their box, outside the places meant to truncate. */
const CLIPPED = () => [...document.querySelectorAll('.wordmark-text, .bg-btn, .tab, .nav-item span, .bg-chip, .badge, .bg-field-label, .choice-text strong, .menu-item, h1, h2')]
  .filter((el) => el.offsetParent !== null && !el.closest('.truncate, .sr-only') && el.scrollWidth > el.clientWidth + 1)
  .map((el) => `${el.className || el.tagName}: "${el.textContent.trim().slice(0, 30)}"`);

const SCREENS = [
  ['inventory', async () => {}],
  ['add-dialog', async (page) => { await page.keyboard.press('Control+n'); await page.waitForTimeout(400); }],
  ['import', async (page) => { await page.locator('.nav-item').nth(2).click(); }],
  ['review', async (page, h) => {
    const payload = { format: 'cinv', version: 1, source: { site: 'motorobit', kind: 'order', url: '' },
      items: [{ name: '91K 603 SMD Direnç - 10 Adet', qty: 10 }, { name: 'IRFZ44N - 55V 49A Mosfet - TO220', qty: 8 }, { name: 'ST-Link V2 Mini Programlayıcı', qty: 1 }] };
    h.state.deepLinks.push(`component-inventory://import?d=${Buffer.from(JSON.stringify(payload)).toString('base64url')}`);
    await h.emit('deep-link-pending', null);
    await page.waitForSelector('.review');
  }],
  ['projects', async (page) => { await page.locator('.nav-item').nth(1).click(); }],
  ['backups', async (page) => { await page.locator('.nav-item').nth(3).click(); }],
  ['settings', async (page) => { await page.locator('.nav-item').nth(4).click(); }],
];

for (const [language, theme] of [['tr', 'dark'], ['en-XA', 'dark'], ['de', 'light'], ['ar', 'dark'], ['zh-CN', 'light'], ['ru', 'dark']]) {
  const h = await startHarness({ locale: 'en-US', theme, viewport: { width: 960, height: 640 } });
  await h.call('update_settings', { patch: { language } });
  for (const p of [part('LM7805', 'ICs', 'LDO Regulator', 7, 'Drawer C1'), part('IRFZ44N', 'Transistors', 'MOSFET N-Channel - Logic-Level', 1), part('R-10K', 'Resistors', 'SMD', 400),
    part('X-1', 'Uncategorized', '', 2), part('PASTE', 'Consumables', '', 1)]) {
    await h.call('save_component', { component: p });
  }
  await h.open();
  for (const [name, go] of SCREENS) {
    await h.page.keyboard.press('Escape');
    await go(h.page, h);
    await h.page.waitForTimeout(300);
    const overflow = await h.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${language} ${name}: no horizontal page overflow`, overflow <= 0, `${overflow}px`);
    if (name === 'inventory' && language === 'tr') {
      // The owner's language: the toolbar keeps one line at the smallest window.
      const height = await h.page.locator('.toolbar').first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
      check('tr inventory: the toolbar keeps one line', height < 70, `${height}px high`);
    }
    if (name === 'review') {
      const wide = await h.page.locator('.review-table-wrap').evaluate((el) => el.scrollWidth - el.clientWidth);
      check(`${language} review: units, pack and pieces fit without scrolling sideways`, wide <= 1, `${wide}px`);
    }
    const clipped = await h.page.evaluate(CLIPPED);
    check(`${language} ${name}: no label is cut off`, clipped.length === 0, clipped.slice(0, 4).join(' ; '));
    await h.page.screenshot({ path: path.join(out, `${language}-${theme}-${name}.png`) });
  }
  check(`${language}: dir is ${language === 'ar' ? 'rtl' : 'ltr'}`, (await h.page.evaluate(() => document.documentElement.dir)) === (language === 'ar' ? 'rtl' : 'ltr'));
  check(`${language}: no page errors`, h.state.errors.length === 0, h.state.errors.slice(0, 2).join(' ; '));
  await h.stop();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
