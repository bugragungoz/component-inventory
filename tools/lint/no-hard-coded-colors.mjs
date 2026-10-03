// Fails when a color is written outside the design tokens. Colors come from src/styles/tokens.css
// (generated from the Bugra tokens); everything else uses var(--token). Print output (labels, the
// PDF list) is black on white whatever the theme and uses CSS color names, which this allows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SCAN = ['src', 'extension/src'];
const SKIP = new Set(['src/styles/tokens.css']);
/** Files allowed one specific literal, with the reason. */
const ALLOWED = {
  'src/features/labels/render.ts': { pattern: /#000000ff|#ffffffff/g, why: 'the QR library takes hex colors; print output is black on white' },
};
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|ts|tsx|js|mjs|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

const problems = [];
for (const base of SCAN) {
  const abs = path.join(root, base);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (SKIP.has(rel) || rel.endsWith('.test.ts')) continue;
    let text = fs.readFileSync(file, 'utf8');
    if (ALLOWED[rel]) text = text.replace(ALLOWED[rel].pattern, '');
    text.split('\n').forEach((line, i) => {
      // Inline SVG path data and URL fragments are not colors.
      const scrubbed = line.replace(/href="#[^"]*"/g, '').replace(/url\(#[^)]*\)/g, '').replace(/['"`]#[a-z][\w-]*['"`]/gi, '');
      for (const m of scrubbed.matchAll(COLOR)) problems.push(`${rel}:${i + 1}: ${m[0]}`);
    });
  }
}
if (problems.length) {
  console.error(`Colors outside the design tokens (use var(--...)):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('no hard-coded colors');
