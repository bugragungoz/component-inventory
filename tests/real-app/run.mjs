// The built Windows app in its own WebView2, driven over the DevTools protocol (CI on
// windows-latest, after `tauri build`). This is the part the Linux harness cannot prove: the Tauri
// shell, WebView2, the dialog plugin (B7, B8 came from it), the deep-link registration and the
// single-instance hand-over, and the owner's old database migrating in the real data folder.
//
// The app passes WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS to WebView2 itself (src-tauri/src/lib.rs),
// which is how the DevTools port is opened here.
//
// Usage: node tests/real-app/run.mjs [path-to-exe]. Writes screenshots to test-results/real-app/.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright-core';
import { ROOT } from '../ui/harness.mjs';

if (process.platform !== 'win32') {
  console.log('The real-app run needs Windows and WebView2; skipped.');
  process.exit(0);
}

// This run deletes the app's real data folder (it needs an empty first start). That is fine on a
// fresh CI runner and would destroy the owner's inventory on their laptop, so it refuses to run
// outside CI unless explicitly told to.
if (!process.env.CI && !process.argv.includes('--delete-my-app-data')) {
  console.log('Refusing: this run deletes %APPDATA%\\com.bugragungoz.component-inventory.');
  console.log('It runs in CI. On a real machine, back that folder up and pass --delete-my-app-data.');
  process.exit(2);
}

const exe = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(ROOT, 'target', 'release', 'component-inventory.exe');
const dataDir = path.join(process.env.APPDATA, 'com.bugragungoz.component-inventory');
const dbFile = path.join(dataDir, 'component_inventory.db');
const shots = path.join(ROOT, 'test-results', 'real-app');
fs.mkdirSync(shots, { recursive: true });
const PORT = 9333;
const ENV = { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` };

let failed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(cond ? 'ok  ' : 'FAIL', '|', name, extra ? `| ${extra}` : '');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => {});

/** Reads the app's database next to the running app (SQLite allows readers while it writes). */
function query(sql, ...params) {
  // The app may be writing (a restore replaces the file): wait for it instead of failing at once.
  const db = new DatabaseSync(dbFile, { readOnly: true, timeout: 5000 });
  try {
    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}
const quantityOf = (code) => query('SELECT quantity FROM components WHERE part_code = ?', code)[0]?.quantity ?? null;
const totalPieces = () => query('SELECT COALESCE(SUM(quantity), 0) AS n FROM components')[0].n;

const link = (items) => {
  const payload = { format: 'cinv', version: 1, source: { site: 'motorobit', kind: 'order', url: '' }, items };
  return `component-inventory://import?d=${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
};

function diagnostics() {
  const ps = spawnSync('powershell', ['-NoProfile', '-Command',
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'component-inventory|msedgewebview2' } | Select-Object ProcessId, Name, CommandLine | Format-List | Out-String -Width 400"], { encoding: 'utf8' });
  console.log(ps.stdout || ps.stderr);
}

async function portOpen() {
  for (const host of ['127.0.0.1', 'localhost']) {
    try {
      const r = await fetch(`http://${host}:${PORT}/json/version`);
      if (r.ok) return host;
    } catch {
      /* not up */
    }
  }
  return null;
}

/** Starts the app, connects to its WebView2 and waits for the first screen. */
async function launch(name, args = []) {
  const t0 = Date.now();
  const app = spawn(exe, args, { env: ENV, stdio: 'inherit' });
  let exited = null;
  app.on('exit', (code) => { exited = code; });
  let host = null;
  for (let i = 0; i < 90 && !host; i++) {
    if (exited !== null) {
      diagnostics();
      throw new Error(`${name}: the app exited with code ${exited} before its window opened`);
    }
    host = await portOpen();
    if (!host) await sleep(1000);
  }
  if (!host) {
    diagnostics();
    throw new Error(`${name}: WebView2 did not open its DevTools port in 90 s`);
  }
  const browser = await chromium.connectOverCDP(`http://${host}:${PORT}`);
  const pages = browser.contexts()[0].pages();
  const page = pages.find((p) => !p.url().startsWith('devtools')) ?? pages[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('.app, .startup-error', { timeout: 60_000 });
  const startMs = Date.now() - t0;
  async function close() {
    await browser.close().catch(() => {});
    app.kill();
    spawnSync('taskkill', ['/IM', path.basename(exe), '/F'], { stdio: 'ignore' });
    for (let i = 0; i < 30 && (await portOpen()); i++) await sleep(500);
    await sleep(1000);
  }
  return { app, page, errors, startMs, close };
}

/** One part of the run; a failure is reported and the next part still runs. */
async function part(name, fn) {
  console.log(`\n# ${name}`);
  let s = null;
  try {
    s = await fn((x) => { s = x; return x; });
  } catch (e) {
    check(`${name}: finished`, false, String(e?.message ?? e).split('\n')[0]);
    if (s?.page) await shot(s.page, `${name.replace(/\W+/g, '-')}-failure`);
  } finally {
    if (s) {
      check(`${name}: no page errors`, s.errors.length === 0, s.errors.slice(0, 2).join(' ; '));
      await s.close();
    }
  }
}

// 1. A first start on an empty profile.
fs.rmSync(dataDir, { recursive: true, force: true });
await part('first start on an empty profile', async (keep) => {
  const s = keep(await launch('empty'));
  check('the app starts', await s.page.locator('.app').count() === 1, `${s.startMs} ms to the first screen`);
  check('the empty inventory says what to do', await s.page.locator('.empty-state').first().isVisible());
  check('a database was created in the data folder', fs.existsSync(dbFile));
  const backups = fs.existsSync(path.join(dataDir, 'backups')) ? fs.readdirSync(path.join(dataDir, 'backups')) : [];
  check('a new database needs no migration copy', !backups.some((f) => f.startsWith('pre-migration')), backups.join(', '));
  await shot(s.page, 'empty');
  return s;
});

// 2. The owner's situation: an old (schema 0) database.
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
const seed = new DatabaseSync(dbFile);
seed.exec(fs.readFileSync(path.join(ROOT, 'test-fixtures/db/v0-schema.sql'), 'utf8'));
seed.close();

await part('the old database, questions, backups, a deep link and single instance', async (keep) => {
  const s = keep(await launch('old database'));
  const { page } = s;
  check('the app starts', await page.locator('.app').count() === 1, `${s.startMs} ms to the first screen`);
  await page.waitForSelector('.tr', { timeout: 20_000 });
  check('the old database is migrated and every part is there', await page.locator('.tr').count() === 10);
  const backups = fs.readdirSync(path.join(dataDir, 'backups'));
  check('a copy of the old file was kept before the migration', backups.some((f) => f.startsWith('pre-migration-v0')), backups.join(', '));
  await shot(page, 'inventory');

  // Delete through the in-app question: Cancel must keep the part (B7, B8).
  const first = page.locator('.tr').first();
  const code = (await first.locator('.code-cell').innerText()).trim();
  await first.click();
  await page.locator('.detail-actions .bg-btn-danger').click();
  await page.waitForSelector('.bg-dialog-question');
  await shot(page, 'delete-question');
  await page.locator('.bg-dialog-question [data-cancel]').click();
  await page.waitForSelector('.bg-dialog-question', { state: 'detached' });
  check('Cancel in the delete question keeps the part (B7, B8)', query('SELECT COUNT(*) AS n FROM components WHERE part_code = ?', code)[0].n === 1);

  // A second copy started by hand hands over to this one and exits.
  const second = spawn(exe, [], { env: ENV, stdio: 'ignore' });
  const secondExit = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15_000);
    second.on('exit', (c) => { clearTimeout(timer); resolve(c); });
  });
  check('a second copy exits and leaves one app running (single instance)', secondExit !== null && s.app.exitCode === null, `second exit code ${secondExit}`);

  // Backup, change, restore with Cancel and with Restore, then undo the restore (B8).
  const before = quantityOf('BT139-800E');
  await page.locator('.nav-item').nth(3).click(); // Backups (the migration toast has a Backups button too)
  await page.getByRole('button', { name: 'Back up now' }).first().click();
  await page.waitForFunction(() => document.querySelectorAll('.data-table tbody tr').length >= 2, null, { timeout: 10_000 });
  await page.locator('.nav-item').first().click();
  await page.locator('.tr', { hasText: 'BT139-800E' }).click();
  await page.getByRole('button', { name: 'Add one' }).click();
  await sleep(500);
  check('the stepper writes to the database', quantityOf('BT139-800E') === before + 1, `${before} -> ${quantityOf('BT139-800E')}`);
  await page.locator('.nav-item').nth(3).click(); // Backups (the migration toast has a Backups button too)
  await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
  await page.locator('.bg-dialog-question [data-cancel]').click();
  await sleep(500);
  check('Cancel does not restore (B8)', quantityOf('BT139-800E') === before + 1);
  await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
  await page.locator('.bg-dialog-question [data-confirm]').click();
  await page.waitForSelector('.bg-dialog-question', { state: 'detached' });
  await sleep(1500);
  check('Restore brings the backup back', quantityOf('BT139-800E') === before, String(quantityOf('BT139-800E')));
  await shot(page, 'restored');
  await page.locator('.snackbar-action', { hasText: 'Undo' }).last().click();
  await sleep(1500);
  check('Undo of the restore brings the newer data back', quantityOf('BT139-800E') === before + 1, String(quantityOf('BT139-800E')));

  // A deep link while the app runs: Windows starts a second copy, single-instance hands the link
  // to this one, and the review screen opens.
  const pieces = totalPieces();
  spawnSync('cmd.exe', ['/c', 'start', '""', link([{ name: '91K 603 SMD Direnç - 10 Adet', qty: 10 }])], { stdio: 'inherit' });
  const opened = await page.waitForSelector('.review', { timeout: 30_000 }).then(() => true, () => false);
  check('a component-inventory:// link reaches the running app and opens the review', opened);
  if (opened) {
    check('the pack rule applies in the real app (10 x 10 = 100)', (await page.locator('.review-table tbody tr .why').first().innerText()).trim() === '100');
    await shot(page, 'deep-link-review');
    await page.getByRole('button', { name: /Import 1 line/ }).click();
    await page.getByRole('heading', { name: 'Imported' }).waitFor({ timeout: 15_000 });
    check('the import adds 100 pieces to the inventory', totalPieces() === pieces + 100, `${pieces} -> ${totalPieces()}`);
    await page.getByRole('button', { name: 'Import another file' }).click();
    await page.locator('.import-history').getByRole('button', { name: 'Undo import' }).first().click();
    await page.locator('.bg-dialog-question [data-confirm]').click();
    await sleep(1500);
    check('Undo import puts the count back', totalPieces() === pieces, String(totalPieces()));
  }
  return s;
});

// 3. A deep link while the app is closed: Windows starts the app with the link as its argument.
await part('a deep link while the app is closed', async (keep) => {
  const s = keep(await launch('closed', [link([{ code: 'NE555', name: 'NE555 Timer DIP-8', qty: 3 }])]));
  const opened = await s.page.waitForSelector('.review', { timeout: 30_000 }).then(() => true, () => false);
  check('the link opens the review when the app starts from it', opened);
  if (opened) check('the review shows the line from the link', await s.page.locator('.review-table tbody tr').count() === 1);
  await shot(s.page, 'deep-link-cold');
  return s;
});

// 4. 100,000 parts through the real IPC (the harness bridge cannot say how fast this is).
await part('100,000 parts in the real app', async (keep) => {
  const db = new DatabaseSync(dbFile);
  db.exec('BEGIN');
  const insert = db.prepare('INSERT INTO components (part_code, category, subcategory, quantity, package, description) VALUES (?, ?, ?, ?, ?, ?)');
  const cats = [['Resistors', 'SMD', '0603'], ['Capacitors', 'MLCC', '0805'], ['ICs', 'Op-Amp', 'SO-8'], ['Transistors', 'MOSFET N-Channel', 'TO-220']];
  for (let i = 0; i < 100_000; i++) {
    const [c, sub, pkg] = cats[i % cats.length];
    insert.run(`PERF-${String(i).padStart(6, '0')}`, c, sub, i % 500, pkg, `Synthetic part ${i}`);
  }
  db.exec('COMMIT');
  db.close();
  const s = keep(await launch('100k'));
  const { page } = s;
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelectorAll('.tr').length > 0 && /100[,.\s]?0\d\d/.test(document.querySelector('.statusbar')?.textContent ?? ''), null, { timeout: 60_000 });
  const listed = s.startMs + (Date.now() - t0);
  check('100,000 parts: the list is on screen within 10 s of starting', listed < 10_000, `${listed} ms (first screen ${s.startMs} ms)`);
  check('only the rows in view are in the DOM', (await page.locator('.tr').count()) < 80, `${await page.locator('.tr').count()} rows`);
  const searchStart = Date.now();
  await page.fill('#inventory-search', 'PERF-099999');
  await page.waitForFunction(() => document.querySelectorAll('.tr').length === 1, null, { timeout: 10_000 });
  check('a search over 100,000 parts answers in under 1.5 s', Date.now() - searchStart < 1500, `${Date.now() - searchStart} ms`);
  await shot(page, 'perf-100k');
  return s;
});

spawnSync('taskkill', ['/IM', path.basename(exe), '/F'], { stdio: 'ignore' });
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
