// The Component Inventory mark: an IC package (warm black body, Android-green outline and pins) on a
// transparent canvas. No full-bleed tile: the 2026 taskbar report (B9) showed the old dark square
// filling the whole icon and disappearing on a dark taskbar. The body keeps the mark readable on a
// light taskbar, the green outline and pins on a dark one, and the margins match other Windows icons.
//
// Small sizes are drawn on the pixel grid (crisp 1 and 2 px edges); 40 px and up use the vector
// master. Colors come from the Bugra tokens.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/bugra/tokens.json'), 'utf8'));
const tok = (name, theme = 'dark') => {
  const t = tokens.color.tokens.find((x) => x.name === name);
  return typeof t.value === 'string' ? t.value : t.value[theme];
};

export const COLORS = {
  accent: tok('accent'),
  body: tok('surface'),
  bg: tok('bg'),
  ink: tok('ink'),
  muted: tok('muted'),
  lightBg: tok('bg', 'light'),
  lightInk: tok('ink', 'light'),
};

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">${body}</svg>`;

/** Vector master on a 256 grid (used for 40 px and up). */
export function masterSvg(size = 256) {
  const { accent, body } = COLORS;
  const pins = [92, 128, 164];
  const p = (d) => `<path d="${d}" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>`;
  const lines = [
    ...pins.map((y) => p(`M24 ${y}H54`)),
    ...pins.map((y) => p(`M202 ${y}H232`)),
    ...pins.map((x) => p(`M${x} 24V54`)),
    ...pins.map((x) => p(`M${x} 202V232`)),
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="none">
  ${lines}
  <rect x="61" y="61" width="134" height="134" rx="26" fill="${body}" stroke="${accent}" stroke-width="14"/>
  <circle cx="96" cy="96" r="11" fill="${accent}"/>
</svg>`;
}

/** Pixel-grid drawings for the sizes Windows shows in the taskbar, title bar and lists. */
export function pixelSvg(size) {
  const { accent, body } = COLORS;
  const r = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" shape-rendering="crispEdges"/>`;
  const box = (x0, w, t) => {
    // Body with a t-pixel green edge; the corners are cut by one pixel to read as rounded.
    const x1 = x0 + w;
    return [
      r(x0 + 1, x0, w - 2, t, accent), r(x0 + 1, x1 - t, w - 2, t, accent),
      r(x0, x0 + 1, t, w - 2, accent), r(x1 - t, x0 + 1, t, w - 2, accent),
      r(x0 + t, x0 + t, w - 2 * t, w - 2 * t, body),
    ].join('');
  };
  const pinsAt = (centers, thick, from, to, size) => {
    const out = [];
    for (const c of centers) {
      const a = c - thick / 2;
      out.push(r(from, a, to - from, thick, accent));               // left
      out.push(r(size - to, a, to - from, thick, accent));          // right
      out.push(r(a, from, thick, to - from, accent));               // top
      out.push(r(a, size - to, thick, to - from, accent));          // bottom
    }
    return out.join('');
  };
  switch (size) {
    case 16:
      return svg(16, pinsAt([6.5, 9.5], 1, 1, 3, 16) + box(3, 10, 1) + r(5, 5, 1, 1, accent));
    case 20:
      return svg(20, pinsAt([8, 12], 2, 1, 4, 20) + box(4, 12, 1) + r(6, 6, 2, 2, accent));
    case 24:
      return svg(24, pinsAt([10, 14], 2, 1, 5, 24) + box(5, 14, 2) + r(8, 8, 2, 2, accent));
    case 32:
      return svg(32, pinsAt([12, 16, 20], 2, 2, 7, 32) + box(7, 18, 2) + r(10, 10, 2, 2, accent));
    default:
      return masterSvg(size);
  }
}

export function svgFor(size) {
  return [16, 20, 24, 32].includes(size) ? pixelSvg(size) : masterSvg(size);
}

/** Single-color mark for in-app use (sidebar), drawn in currentColor on a 24 grid. */
export const INLINE_MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5"/><circle cx="9.3" cy="9.3" r="0.9" fill="currentColor" stroke="none"/></svg>`;
