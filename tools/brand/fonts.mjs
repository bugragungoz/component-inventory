// Geist and JetBrains Mono as data URLs, so headless renders use the brand fonts offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const file = (pkg, name) => path.join(root, 'node_modules', '@fontsource', pkg, 'files', name);
const face = (family, weight, f) =>
  `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2')}`;

export function brandFontCss() {
  return [
    face('Geist', 400, file('geist-sans', 'geist-sans-latin-400-normal.woff2')),
    face('Geist', 500, file('geist-sans', 'geist-sans-latin-500-normal.woff2')),
    face('Geist', 600, file('geist-sans', 'geist-sans-latin-600-normal.woff2')),
    face('JetBrains Mono', 400, file('jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff2')),
  ].join('\n');
}
