#!/usr/bin/env node
// Captures the HTML structure of a page you already have open in Brave (or Chrome, Edge) so shop
// extractors can be written and tested without a login. Read-only: it never reads cookies,
// storage or passwords, and it only clicks selectors you pass with --click.
//
//   node tools/capture/capture.mjs list
//   node tools/capture/capture.mjs outline --tab motorobit
//   node tools/capture/capture.mjs snap --tab "uye-siparisleri" --shop motorobit --name order-detail \
//        --click "button.open-order" --redact "Ad Soyad" --redact "Mahalle Sokak No"
//
// Output goes to .captures/ (git-ignored). Read the result, then copy it into test-fixtures/
// only if nothing personal is left. See tools/capture/README.md.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, many = false) => {
  const vals = [];
  for (let i = 1; i < args.length; i++) if (args[i] === `--${name}` && args[i + 1] !== undefined) vals.push(args[++i]);
  return many ? vals : vals[0];
};
const flag = (name) => args.includes(`--${name}`);
const port = opt('port') || '9222';

function usage(code = 0) {
  console.log(`Usage:
  capture.mjs list                         list the open tabs
  capture.mjs outline --tab <n|text>       print the structure of a page (tables, quantity cells, classes)
  capture.mjs snap --tab <n|text> --shop <id> --name <name> [options]

snap options:
  --click <css>      click this element before capturing (repeatable): expand an order, open a tab
  --wait <ms>        wait after clicking (default 800)
  --scroll           scroll to the bottom first, for lazy lists
  --redact <text>    also mask this exact text, e.g. your name or street (repeatable)
  --screenshot       also save a PNG (it shows everything on screen, so review it before sharing)
  --port <n>         debugging port (default 9222)`);
  process.exit(code);
}
if (!cmd || cmd === '-h' || cmd === '--help') usage(0);

let browser;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
} catch (e) {
  console.error(`Cannot reach a browser on port ${port}: ${e.message.split('\n')[0]}

Start Brave with a debugging port and a DEDICATED profile folder, then sign in to the shops in it once:
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" --remote-debugging-port=${port} --user-data-dir="%USERPROFILE%\\brave-capture-profile"
(Chromium 136 and later ignore the debugging port for the default profile, so the dedicated folder is required.)`);
  process.exit(2);
}

const pages = browser.contexts().flatMap(c => c.pages()).filter(p => !p.url().startsWith('devtools://'));
const label = (p, i) => `${String(i).padStart(2)}  ${p.url().replace(/^https?:\/\//, '').slice(0, 90)}`;

if (cmd === 'list') {
  for (const [i, p] of pages.entries()) console.log(label(p, i), '|', (await p.title()).slice(0, 50));
  await browser.close();
  process.exit(0);
}

const tabArg = opt('tab');
if (tabArg === undefined) usage(1);
const page = /^\d+$/.test(tabArg) ? pages[Number(tabArg)] : pages.find(p => p.url().includes(tabArg));
if (!page) { console.error(`No tab matches "${tabArg}". Run: capture.mjs list`); await browser.close(); process.exit(1); }

// ---------------------------------------------------------------- outline
if (cmd === 'outline') {
  const info = await page.evaluate(() => {
    const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
    const chain = (el) => { const o = []; for (let e = el, k = 0; e && k < 6; e = e.parentElement, k++) o.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '')); return o.join(' < '); };
    const tables = [...document.querySelectorAll('table')].map((t, i) => ({ i, class: String(t.className).slice(0, 80), rows: t.querySelectorAll('tr').length, headers: [...t.querySelectorAll('th')].map(x => clean(x.textContent)).slice(0, 10) })).filter(t => t.rows > 1);
    const qtyCells = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /^\s*\d{1,5}\s*(adet|pcs)?\s*$/i.test(e.textContent) && !e.closest('script,style')).slice(0, 12).map(e => ({ text: clean(e.textContent), path: chain(e) }));
    const qtyInputs = [...document.querySelectorAll('input')].filter(i => i.type === 'number' || /qty|adet|quantity|miktar/i.test(`${i.name} ${i.id} ${i.className}`)).slice(0, 8).map(i => ({ name: i.name, id: i.id, class: String(i.className).slice(0, 60), value: i.value, path: chain(i.parentElement) }));
    const classCount = {};
    document.querySelectorAll('[class]').forEach(el => { if (typeof el.className === 'string') el.className.split(/\s+/).forEach(c => { if (/(^|[-_:])(cart|basket|sepet|order|siparis|product|urun|qty|adet)/i.test(c)) classCount[c] = (classCount[c] || 0) + 1; }); });
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent)['@type'] || (JSON.parse(s.textContent)['@graph'] || []).map(n => n['@type']).join('+'); } catch { return 'unparsable'; } });
    const dl = (window.dataLayer || []).map(e => (e && e.event) || (Array.isArray(e) ? e[1] : '')).filter(Boolean).slice(0, 20);
    return { title: document.title, tables, qtyCells, qtyInputs, repeatedClasses: Object.entries(classCount).sort((a, b) => b[1] - a[1]).slice(0, 20), jsonLdTypes: ld, dataLayerEvents: dl };
  });
  const u = new URL(page.url());
  console.log(JSON.stringify({ page: u.origin + u.pathname + u.hash.split('?')[0], ...info }, null, 2));
  await browser.close();
  process.exit(0);
}

// ---------------------------------------------------------------- snap
if (cmd !== 'snap') usage(1);
const shop = (opt('shop') || '').replace(/[^\w-]/g, '');
const name = (opt('name') || '').replace(/[^\w-]/g, '');
if (!shop || !name) usage(1);

for (const sel of opt('click', true)) {
  const n = await page.evaluate(s => { const els = [...document.querySelectorAll(s)]; els.forEach(e => e.click()); return els.length; }, sel);
  console.log(`clicked ${n} x ${sel}`);
  await page.waitForTimeout(Number(opt('wait') || 800));
}
if (flag('scroll')) {
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
}

// Serialise the live DOM without anything that is not structure.
let html = await page.evaluate(() => {
  const root = document.documentElement.cloneNode(true);
  root.querySelectorAll('script, style, link, noscript, iframe, svg, template, meta[http-equiv], object, embed').forEach(n => n.remove());
  root.querySelectorAll('*').forEach(el => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || a.name === 'srcset' || a.name === 'style' || a.name === 'nonce') el.removeAttribute(a.name);
      else if ((a.name === 'src' || a.name === 'href') && /^data:/i.test(a.value)) el.removeAttribute(a.name);
    }
    if (el.tagName === 'IMG') { const alt = el.getAttribute('alt'); [...el.attributes].forEach(a => el.removeAttribute(a.name)); if (alt) el.setAttribute('alt', alt); }
    if (el.tagName === 'INPUT') { const t = (el.getAttribute('type') || 'text').toLowerCase(); if (['password', 'email', 'tel', 'hidden', 'text', 'search', 'url'].includes(t) && !/qty|adet|quantity|miktar|count/i.test(`${el.name} ${el.id} ${el.className}`)) el.removeAttribute('value'); }
  });
  return '<!doctype html>\n' + root.outerHTML.replace('<head>', '<head><meta charset="utf-8">');
});

// Redaction: patterns that are personal wherever they appear, plus your own --redact texts.
const counts = {};
const mask = (re, tag) => { html = html.replace(re, () => { counts[tag] = (counts[tag] || 0) + 1; return `[${tag}]`; }); };
mask(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, 'email');
mask(/\bTR\d{2}(?:[ ]?\d{4}){5}[ ]?\d{2}\b/g, 'iban');
// A number inside a price (1.234,56) must survive, so only a digit right after a separator blocks a match;
// a comma that ends a sentence does not.
mask(/(?<!\d|\d[.,])(?:\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d|[.,]\d)/g, 'phone');
mask(/(?<!\d|\d[.,])\d{11}(?!\d|[.,]\d)/g, 'id-number');
for (const text of opt('redact', true)) {
  const re = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  mask(re, 'redacted-text');
}

const outDir = path.join('.captures', shop);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${name}.html`), html);
const u = new URL(page.url());
fs.writeFileSync(path.join(outDir, `${name}.meta.json`), JSON.stringify({
  shop, name, capturedAt: new Date().toISOString(),
  page: u.origin + u.pathname + u.hash.split('?')[0],   // no query string
  title: (await page.title()).slice(0, 120),
  redactions: counts, bytes: html.length,
}, null, 2));
if (flag('screenshot')) await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });

console.log(`saved ${path.join(outDir, name)}.html (${Math.round(html.length / 1024)} KB)`);
console.log('masked:', Object.keys(counts).length ? JSON.stringify(counts) : 'nothing matched');
console.log('Now open the file and search it for names, addresses, order numbers and anything else that is yours');
console.log('before it goes anywhere near git. Addresses and names are NOT detected automatically.');
await browser.close();
