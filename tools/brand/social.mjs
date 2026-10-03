#!/usr/bin/env node
// Social images (1200x630) per the Bugra SocialCard rules: headline with the subject phrase in
// accent, a muted sub line, the address as an accent pill bottom-end, one soft green glow.
// English and Turkish.   npm run brand
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPage, renderHtml } from './render.mjs';
import { masterSvg, COLORS } from './mark.mjs';
import { brandFontCss } from './fonts.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cards = {
  en: { lead: 'Every part,', accent: 'counted exactly.', sub: 'A local inventory for electronic components, with imports from Turkish electronics shops.', size: 82 },
  tr: { lead: 'Her parça,', accent: 'tam adediyle.', sub: 'Elektronik bileşenler için yerel envanter; Türk elektronik mağazalarından içe aktarma.', size: 82 },
};
const browser = await launch();
const page = await newPage(browser);
for (const [lang, c] of Object.entries(cards)) {
  const html = `<style>${brandFontCss()} body{margin:0} .card{width:1200px;height:630px;position:relative;overflow:hidden;background:${COLORS.bg};color:${COLORS.ink};font-family:Geist,sans-serif;-webkit-font-smoothing:antialiased}
  .glow{position:absolute;width:760px;height:760px;right:-220px;top:-260px;border-radius:50%;background:radial-gradient(circle, color-mix(in srgb, ${COLORS.accent} 22%, transparent), transparent 62%)}
  .mark{position:absolute;left:80px;top:72px;display:flex;align-items:center;gap:14px;font-weight:600;font-size:22px;letter-spacing:-0.01em}
  h1{position:absolute;left:80px;top:170px;margin:0;max-width:17ch;font-weight:600;font-size:${c.size}px;line-height:1.08;letter-spacing:-0.035em}
  h1 span{color:${COLORS.accent}} p{position:absolute;left:80px;top:430px;margin:0;max-width:30ch;font-size:30px;line-height:1.4;color:${COLORS.muted}}
  .pill{position:absolute;right:80px;bottom:64px;padding:12px 26px;border-radius:999px;background:${COLORS.accent};color:${COLORS.bg};font-weight:600;font-size:24px}</style>
  <div class="card" lang="${lang}"><div class="glow"></div><div class="mark">${masterSvg(256).replace('width="256" height="256"', 'width="44" height="44"')}Component Inventory</div>
  <h1>${c.lead} <span>${c.accent}</span></h1><p>${c.sub}</p><div class="pill">github.com/bugragungoz</div></div>`;
  const png = await renderHtml(page, html, 1200, 630, { transparent: false });
  fs.writeFileSync(path.join(root, 'docs/brand', `social-${lang}.png`), png);
}
await browser.close();
console.log('social images written');
