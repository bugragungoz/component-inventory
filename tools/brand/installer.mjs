#!/usr/bin/env node
// Installer bitmaps in the Bugra look: WiX banner (493x58) and dialog (493x312), NSIS header
// (150x57) and sidebar (164x314). The installers draw their own text on the light areas, so the
// light parts stay plain. Writes 24-bit BMPs into src-tauri/installer/ and PNG copies into
// docs/brand/ for review.   npm run brand
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPage, renderHtml, pngPixels, bmp24 } from './render.mjs';
import { masterSvg, COLORS } from './mark.mjs';
import { brandFontCss } from './fonts.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fonts = brandFontCss();
const mark = (px) => masterSvg(256).replace('width="256" height="256"', `width="${px}" height="${px}"`);
const base = `<style>${fonts} *{box-sizing:border-box} body{margin:0;font-family:Geist,sans-serif;-webkit-font-smoothing:antialiased}</style>`;

const designs = {
  'wix-banner': [493, 58, `<div style="width:493px;height:58px;background:${COLORS.lightBg};position:relative;border-bottom:1px solid rgba(19,17,16,.1)">
      <div style="position:absolute;right:14px;top:9px;width:40px;height:40px;border-radius:10px;background:${COLORS.bg};display:grid;place-items:center">${mark(30)}</div></div>`],
  'wix-dialog': [493, 312, `<div style="width:493px;height:312px;background:${COLORS.lightBg};display:flex">
      <div style="width:164px;height:312px;background:${COLORS.bg};padding:28px 18px;display:flex;flex-direction:column;justify-content:space-between">
        <div>${mark(56)}</div>
        <div style="color:${COLORS.ink};font-weight:600;font-size:17px;line-height:1.2;letter-spacing:-0.01em">Component<br>Inventory</div>
      </div></div>`],
  'nsis-header': [150, 57, `<div style="width:150px;height:57px;background:${COLORS.lightBg};display:flex;align-items:center;justify-content:flex-end;padding-right:12px">
      <div style="width:38px;height:38px;border-radius:10px;background:${COLORS.bg};display:grid;place-items:center">${mark(28)}</div></div>`],
  'nsis-sidebar': [164, 314, `<div style="width:164px;height:314px;background:${COLORS.bg};padding:28px 18px;display:flex;flex-direction:column;justify-content:space-between">
      <div>${mark(56)}</div>
      <div style="color:${COLORS.ink};font-weight:600;font-size:17px;line-height:1.2;letter-spacing:-0.01em">Component<br>Inventory<div style="margin-top:8px;color:${COLORS.muted};font-weight:400;font-size:12px;letter-spacing:0">Electronic parts, counted exactly</div></div></div>`],
};

const browser = await launch();
const page = await newPage(browser);
for (const [name, [w, h, html]] of Object.entries(designs)) {
  const png = await renderHtml(page, base + html, w, h, { transparent: false });
  const px = await pngPixels(page, png);
  fs.mkdirSync(path.join(root, 'src-tauri/installer'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src-tauri/installer', `${name}.bmp`), bmp24(px));
  fs.mkdirSync(path.join(root, 'docs/brand'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/brand', `installer-${name}.png`), png);
}
await browser.close();
console.log('installer bitmaps written');
