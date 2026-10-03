// Shared helpers for the brand tools: a headless Chromium to render SVG and HTML to PNG, and
// encoders for ICO, ICNS and BMP. Set BROWSER_PATH to use a specific Chromium-based browser.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const KNOWN = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'];

export async function launch() {
  const base = { args: ['--no-sandbox', '--font-render-hinting=none'] };
  if (process.env.BROWSER_PATH) return chromium.launch({ ...base, executablePath: process.env.BROWSER_PATH });
  for (const p of KNOWN) if (fs.existsSync(p)) return chromium.launch({ ...base, executablePath: p });
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ ...base, channel }); } catch { /* next */ }
  }
  return chromium.launch(base);
}

export async function newPage(browser) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  return ctx.newPage();
}

/** Renders markup into a w x h PNG with a transparent background. */
export async function renderHtml(page, html, w, h, { transparent = true } = {}) {
  await page.setViewportSize({ width: Math.max(w, 400), height: Math.max(h, 400) });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}

/** RGBA pixels of a PNG, decoded by the browser. */
export async function pngPixels(page, png) {
  const b64 = png.toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, data: Array.from(ctx.getImageData(0, 0, img.width, img.height).data) };
  }, b64);
}

/** 24-bit BMP (bottom-up rows) as WiX and NSIS expect. */
export function bmp24({ w, h, data }) {
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const size = 54 + rowSize * h;
  const buf = Buffer.alloc(size);
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(size, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(rowSize * h, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  for (let y = 0; y < h; y++) {
    const row = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      buf[row + x * 3] = data[i + 2];
      buf[row + x * 3 + 1] = data[i + 1];
      buf[row + x * 3 + 2] = data[i];
    }
  }
  return buf;
}

/** ICO with PNG-compressed frames (Windows Vista and later). */
export function ico(frames /* [{ size, png }] */) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const entries = frames.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...frames.map((f) => f.png)]);
}

export function icns(chunks /* [{ type, png }] */) {
  const parts = [];
  for (const { type, png } of chunks) {
    const h = Buffer.alloc(8);
    h.write(type, 0, 'ascii');
    h.writeUInt32BE(8 + png.length, 4);
    parts.push(h, png);
  }
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([head, body]);
}
