// One version everywhere (docs/adr/0006): package.json, the Cargo workspace, tauri.conf.json, the
// cinv package and the extension manifest. MSI needs numbers only, so 1.0.0-beta.N is 1.0.0.N there.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const found = {};
found['package.json'] = JSON.parse(read('package.json')).version;
found['packages/cinv/package.json'] = JSON.parse(read('packages/cinv/package.json')).version;
const cargo = /\[workspace\.package\][^[]*?version\s*=\s*"([^"]+)"/s.exec(read('Cargo.toml'));
found['Cargo.toml'] = cargo?.[1];
const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));
found['src-tauri/tauri.conf.json'] = tauri.version;
if (fs.existsSync(path.join(root, 'extension/manifest.json'))) {
  const m = JSON.parse(read('extension/manifest.json'));
  found['extension/manifest.json (version_name)'] = m.version_name ?? m.version;
}

const problems = [];
const want = found['package.json'];
if (!/^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(want ?? '')) problems.push(`package.json version "${want}" is not X.Y.Z or X.Y.Z-beta.N`);
for (const [file, v] of Object.entries(found)) if (v !== want) problems.push(`${file} has ${v}, package.json has ${want}`);

const [, base, beta] = /^(\d+\.\d+\.\d+)(?:-beta\.(\d+))?$/.exec(want ?? '') ?? [];
const wix = tauri.bundle?.windows?.wix?.version;
const expectedWix = beta ? `${base}.${beta}` : base;
if (wix !== expectedWix) problems.push(`tauri.conf.json bundle.windows.wix.version is ${wix}, expected ${expectedWix}`);
if (fs.existsSync(path.join(root, 'extension/manifest.json'))) {
  const m = JSON.parse(read('extension/manifest.json'));
  if (m.version !== expectedWix) problems.push(`extension/manifest.json version is ${m.version}, expected ${expectedWix} (Chrome takes numbers only)`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`version ${want} everywhere (MSI and extension ${expectedWix})`);
