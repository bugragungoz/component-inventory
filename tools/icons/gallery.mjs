#!/usr/bin/env node
// Renders every category and subcategory icon, grouped as in the taxonomy, to
// docs/design/category-icons.png (dark) and category-icons-light.png, for the owner to review.
//   node tools/icons/gallery.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPage, renderHtml } from '../brand/render.mjs';
import { brandFontCss } from '../brand/fonts.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/bugra/tokens.json'), 'utf8'));
const tok = (n, theme) => { const t = tokens.color.tokens.find((x) => x.name === n); return typeof t.value === 'string' ? t.value : t.value[theme]; };

const out = await build({
  stdin: { contents: "export { CATEGORY_ICONS } from './src/components/categoryIcons.ts'; export { TAXONOMY } from './src/domain/taxonomy.ts';", resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral',
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const { CATEGORY_ICONS, TAXONOMY } = mod;

const svg = (name, color) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${(CATEGORY_ICONS[name] || []).map((d) => `<path d="${d}"/>`).join('')}</svg>`;
const missing = [];
const browser = await launch();
const page = await newPage(browser);
for (const theme of ['dark', 'light']) {
  const ink = tok('ink', theme), muted = tok('muted', theme), accent = tok('accent-ink', theme), bg = tok('bg', theme), surface = tok('surface', theme), line = tok('line', theme);
  const groups = TAXONOMY.map((c) => {
    if (!CATEGORY_ICONS[c.icon]) missing.push(c.icon);
    const subs = c.subcategories.map((s) => { if (!CATEGORY_ICONS[s.icon]) missing.push(s.icon); return `<div class="cell">${svg(s.icon, muted)}<span>${s.name}</span></div>`; }).join('');
    return `<section><h2>${svg(c.icon, accent)}<span>${c.name}</span></h2><div class="grid">${subs}</div></section>`;
  }).join('');
  const html = `<style>${brandFontCss()} body{margin:0;background:${bg};color:${ink};font-family:Geist,sans-serif;width:1600px;padding:28px;box-sizing:border-box}
  .cols{columns:3;column-gap:28px} section{break-inside:avoid;background:${surface};border:1px solid ${line};border-radius:14px;padding:14px 16px;margin:0 0 20px}
  h2{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:16px;font-weight:600} .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px}
  .cell{display:flex;align-items:center;gap:10px;font-size:12.5px;color:${muted}} .cell svg{flex:none}</style><div class="cols">${groups}</div>`;
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.setContent(html);
  const height = await page.evaluate(() => document.body.scrollHeight);
  const png = await renderHtml(page, html, 1600, height, { transparent: false });
  fs.writeFileSync(path.join(root, `docs/design/category-icons${theme === 'light' ? '-light' : ''}.png`), png);
}
await browser.close();
if (missing.length) { console.error('missing icons:', [...new Set(missing)].join(', ')); process.exit(1); }
console.log('category icon gallery written');
