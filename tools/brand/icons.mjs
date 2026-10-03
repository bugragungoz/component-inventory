#!/usr/bin/env node
// Writes every icon from tools/brand/mark.mjs: the app's PNGs, icon.ico (16, 20, 24, 32, 40, 48,
// 64, 256 px frames) and icon.icns, the extension icons, and two previews for the owner:
// docs/brand/icon-sizes.png and docs/brand/taskbar-preview.png (light and dark taskbars).
//   npm run icons
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPage, renderHtml, ico, icns } from './render.mjs';
import { svgFor, masterSvg, COLORS } from './mark.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const out = (...p) => path.join(root, ...p);
const write = (file, buf) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
};

const browser = await launch();
const page = await newPage(browser);
const cache = new Map();
const png = async (size) => {
  if (!cache.has(size)) cache.set(size, await renderHtml(page, svgFor(size), size, size));
  return cache.get(size);
};

// App (Tauri bundle).
const appFiles = { '32x32.png': 32, '64x64.png': 64, '128x128.png': 128, '128x128@2x.png': 256, 'icon.png': 512 };
for (const [f, s] of Object.entries(appFiles)) write(out('src-tauri/icons', f), await png(s));
const icoSizes = [16, 20, 24, 32, 40, 48, 64, 256];
// One page renders one thing at a time: never Promise.all over renders.
const icoFrames = [];
for (const size of icoSizes) icoFrames.push({ size, png: await png(size) });
write(out('src-tauri/icons/icon.ico'), ico(icoFrames));
const icnsTypes = [['ic11', 32], ['ic12', 64], ['ic07', 128], ['ic13', 256], ['ic08', 256], ['ic14', 512], ['ic09', 512], ['ic10', 1024]];
const icnsChunks = [];
for (const [type, s] of icnsTypes) icnsChunks.push({ type, png: await png(s) });
write(out('src-tauri/icons/icon.icns'), icns(icnsChunks));
write(out('src-tauri/icons/source.svg'), masterSvg(1024));

// Extension.
for (const s of [16, 32, 48, 128]) write(out('extension/icons', `icon-${s}.png`), await png(s));

// Previews for the owner: every frame at 1:1 and enlarged with pixels visible.
{
  const sizes = icoSizes;
  const cells = [];
  for (const s of sizes) {
    const b64 = (await png(s)).toString('base64');
    cells.push( `<figure><div class="real"><img src="data:image/png;base64,${b64}" width="${s}" height="${s}"></div><div class="zoom"><img src="data:image/png;base64,${b64}" style="width:${Math.min(s * 4, 256)}px;image-rendering:pixelated"></div><figcaption>${s} px</figcaption></figure>`);
  }
  const html = `<style>body{font:13px system-ui;background:${COLORS.bg};color:${COLORS.muted};padding:24px;display:flex;gap:28px;align-items:flex-end;flex-wrap:wrap;width:1352px}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:10px}.zoom{background:${COLORS.lightBg};padding:8px;border-radius:10px}</style>${cells.join('')}`;
  write(out('docs/brand/icon-sizes.png'), await renderHtml(page, html, 1400, 380, { transparent: false }));
}
{
  const icon24 = (await png(24)).toString('base64');
  const icon32 = (await png(32)).toString('base64');
  // Neutral stand-ins for other apps, so the margins can be compared.
  const other = (fill, stroke) => `<svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></svg>`;
  const bar = (bg, fg, label) => `<div class="bar" style="background:${bg};color:${fg}"><span class="lbl">${label}</span>
    <span class="slot">${other('#3a7bd5', '#3a7bd5')}</span><span class="slot">${other('#f2c94c', '#c9a227')}</span>
    <span class="slot active"><img src="data:image/png;base64,${icon24}" width="24" height="24"></span>
    <span class="slot">${other('#6fcf97', '#27ae60')}</span>
    <span class="sep"></span><span class="lbl">125 %</span><span class="slot big"><img src="data:image/png;base64,${icon32}" width="32" height="32"></span></div>`;
  const html = `<style>body{margin:0;font:12px system-ui;background:#808080;padding:16px;display:flex;flex-direction:column;gap:12px;width:568px}
.bar{display:flex;align-items:center;gap:6px;height:48px;padding:0 14px;border-radius:8px}.slot{display:grid;place-items:center;width:40px;height:40px;border-radius:6px}
.big{width:48px;height:48px}.active{box-shadow:inset 0 -3px 0 ${COLORS.accent}}.sep{flex:1}.lbl{opacity:.7;width:60px}</style>
${bar('#f3f3f3', '#1b1b1b', 'Light')}${bar('#202020', '#f3f3f3', 'Dark')}`;
  write(out('docs/brand/taskbar-preview.png'), await renderHtml(page, html, 600, 152, { transparent: false }));
}

await browser.close();
console.log('icons written');
