// Builds the extension into extension/dist ("Load unpacked" that folder). With --zip it also
// writes extension/component-inventory-extension-<version>.zip for the release.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { build } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of ['bridge', 'content']) {
  await build({
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: { '@cinv/core': path.join(root, '..', 'packages', 'cinv', 'src', 'index.ts') } },
    build: {
      outDir: out,
      emptyOutDir: false,
      minify: false,
      target: 'chrome110',
      lib: { entry: path.join(root, 'src', `${name}.ts`), formats: ['iife'], name: `cinv_${name}`, fileName: () => `${name}.js` },
    },
  });
}
fs.cpSync(path.join(root, 'manifest.json'), path.join(out, 'manifest.json'));
fs.cpSync(path.join(root, '_locales'), path.join(out, '_locales'), { recursive: true });
fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });
console.log('extension built ->', path.relative(process.cwd(), out));

if (process.argv.includes('--zip')) {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version_name;
  const files = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else files[path.relative(out, p).split(path.sep).join('/')] = fs.readFileSync(p);
    }
  };
  walk(out);
  const zip = path.join(root, `component-inventory-extension-${version}.zip`);
  fs.writeFileSync(zip, zipSync(files, { level: 9 }));
  console.log('zip ->', path.relative(process.cwd(), zip));
}
