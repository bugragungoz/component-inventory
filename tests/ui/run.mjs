// UI checks on the built app against the real Rust core (docs/adr/0004). `npm run test:ui` builds
// the bridge and the frontend first. Each check prints ok or FAIL; the run fails if any failed, if
// the page threw, or if it tried to reach another origin.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import XLSX from 'xlsx';
import { ROOT, startHarness } from './harness.mjs';

const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
let failed = 0;
const results = [];
const check = (name, cond, extra = '') => {
  if (!cond) failed++;
  results.push({ name, ok: !!cond });
  console.log(cond ? 'ok  ' : 'FAIL', '|', name, extra ? `| ${extra}` : '');
};

async function scenario(name, opts, fn) {
  if (only && !only.test(name)) return;
  console.log(`\n# ${name}`);
  const h = await startHarness(opts);
  try {
    await fn(h);
  } catch (e) {
    const shot = path.join(ROOT, 'test-results', `${name.replace(/[^\w]+/g, '-').slice(0, 60)}.png`);
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    await h.page.screenshot({ path: shot }).catch(() => {});
    check(`${name}: finished without an exception`, false, `${String(e?.stack ?? e).split('\n').slice(0, 4).join(' / ')} (screenshot ${path.relative(ROOT, shot)})`);
  } finally {
    check(`${name}: no page errors`, h.state.errors.length === 0, h.state.errors.slice(0, 3).join(' ; '));
    check(`${name}: no requests to other origins`, h.state.external.length === 0, h.state.external.slice(0, 3).join(' '));
    await h.stop();
  }
}

const part = (code, extra = {}) => ({
  id: null, part_code: code, category: '', subcategory: '', quantity: 5, package: '', manufacturer: '', mpn: '', location: '', preferred_supplier: '',
  voltage_max: null, current_max: null, resistance: '', tolerance: '', power_rating: null, description: '', datasheet_url: '', unit_price: null, notes: '',
  image_path: '', attributes: {}, custom_fields: {}, ...extra,
});
const rowFor = (h, code) => h.page.locator('.tr', { has: h.page.locator('.code-cell', { hasText: code }) });
const confirmDialog = (h) => h.page.locator('.bg-dialog-question');
const toastText = (h) => h.page.locator('.snackbars').innerText();

// ---------------------------------------------------------------------------------------------

await scenario('parts: add, find, edit, delete with Cancel, undo', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  await h.open();
  check('an empty inventory says what to do', await page.getByRole('heading', { name: 'No parts yet' }).isVisible());

  await page.keyboard.press('Control+n');
  await page.fill('#edit-part-code', 'DİRENÇ-10K');
  await page.getByLabel('Quantity', { exact: true }).fill('1.250');
  await page.getByRole('button', { name: 'Add part', exact: true }).last().click();
  check('a count with a group mark is read in the UI language (1.250 is not 1250 in English)', await page.locator('#edit-form [aria-invalid="true"]').count() === 1);
  await page.getByLabel('Quantity', { exact: true }).fill('1,250');
  await page.getByRole('button', { name: 'Add part', exact: true }).last().click();
  await page.waitForSelector('.tr');
  const stored = (await h.call('list_components', {}))[0];
  check('the new part is in the database with 1250 pieces', stored?.part_code === 'DİRENÇ-10K' && stored?.quantity === 1250, JSON.stringify(stored?.quantity));

  await page.fill('#inventory-search', 'direnc');
  check('search folds Turkish letters (direnc finds DİRENÇ)', await page.locator('.tr').count() === 1);
  await page.fill('#inventory-search', 'IRF540');
  check('a search with no match shows the empty state', await page.getByRole('heading', { name: 'No parts match' }).isVisible());
  await page.fill('#inventory-search', '');

  // A code that exists already offers to add the pieces to it.
  await page.keyboard.press('Control+n');
  await page.fill('#edit-part-code', 'DİRENÇ-10K');
  await page.getByLabel('Quantity', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Add part', exact: true }).last().click();
  await page.getByRole('button', { name: /Add to the existing part/ }).click();
  check('adding an existing code adds to its stock', (await h.call('list_components', {}))[0]?.quantity === 1255);

  // Edit, then Escape with changes asks first; Cancel keeps the dialog.
  await rowFor(h, 'DİRENÇ-10K').click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Description').fill('Changed');
  await page.keyboard.press('Escape');
  check('closing an edited form asks first', await confirmDialog(h).isVisible());
  await confirmDialog(h).locator('[data-cancel]').click();
  check('Keep editing keeps the form open', await page.locator('#edit-form').isVisible());
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForSelector('#edit-form', { state: 'detached' });
  check('the edit is saved', (await h.call('list_components', {}))[0]?.description === 'Changed');

  // The stepper logs a movement.
  await page.getByRole('button', { name: 'Add one' }).click();
  await page.waitForTimeout(200);
  const detail = await h.call('get_component', { id: stored.id });
  check('the stepper adds one and logs it', detail.component.quantity === 1256 && detail.movements[0]?.reason === 'adjust');

  // Delete: Cancel must keep the part (B7, B8), Delete removes it, Undo brings it back with its id.
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  check('delete asks in the app', await confirmDialog(h).isVisible());
  check('the question focuses Cancel', await page.waitForFunction(() => document.activeElement?.hasAttribute('data-cancel'), null, { timeout: 2000 }).then(() => true, () => false));
  await confirmDialog(h).locator('[data-cancel]').click();
  await page.waitForTimeout(300);
  check('Cancel keeps the part', (await h.call('list_components', {})).length === 1);
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Escape keeps the part', (await h.call('list_components', {})).length === 1);
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  await confirmDialog(h).locator('[data-confirm]').click();
  await page.waitForTimeout(300);
  check('Delete removes it', (await h.call('list_components', {})).length === 0);
  await page.locator('.snackbar-action', { hasText: 'Undo' }).click();
  await page.waitForTimeout(400);
  const back = await h.call('list_components', {});
  check('Undo restores it with the same id and stock', back[0]?.id === stored.id && back[0]?.quantity === 1256);
  check('window.confirm, alert and prompt were never called', (await page.evaluate(() => window.__blockingDialogs ?? [])).length === 0);
});

await scenario('keyboard: table navigation, shortcuts, focus', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  await h.call('seed_components', { count: 50 });
  await h.open();
  await page.keyboard.press('/');
  // The search takes focus on the next animation frame.
  check('/ focuses the search', await page.waitForFunction(() => document.activeElement?.id === 'inventory-search', null, { timeout: 2000 }).then(() => true, () => false));
  const focusedRow = (n) => page.waitForFunction((r) => document.activeElement?.getAttribute('data-row') === r, String(n), { timeout: 2000 }).then(() => true, () => false);
  await page.keyboard.press('ArrowDown');
  check('ArrowDown from the search enters the table', await focusedRow(0));
  await page.keyboard.press('ArrowDown');
  await focusedRow(1);
  await page.keyboard.press('ArrowDown');
  check('arrows move between rows', await focusedRow(2));
  await page.keyboard.press('Enter');
  check('Enter opens the detail panel', await page.locator('.detail-panel h2', { hasText: 'PART-000002' }).waitFor({ timeout: 3000 }).then(() => true, () => false));
  await page.keyboard.press('?');
  check('? lists the shortcuts', await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor({ timeout: 2000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  check('Escape closes the dialog', await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 2000 }).then(() => true, () => false));
});

await scenario('projects: parts list, shortage, delete with Cancel and Undo', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  const c = await h.call('save_component', { component: part('NE555', { quantity: 2 }) });
  await h.open();
  await page.getByRole('button', { name: 'Projects' }).click();
  await page.getByPlaceholder('New project name').fill('Clock');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByPlaceholder('Search your parts').fill('ne5');
  await page.getByRole('option').first().click();
  await page.getByLabel('Needed', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForSelector('.data-table td');
  check('a line short on stock says how many are missing', await page.locator('.data-table', { hasText: '1 missing' }).isVisible());
  const [proj] = await h.call('list_projects', {});
  await page.getByRole('button', { name: 'Delete project' }).click();
  await confirmDialog(h).locator('[data-cancel]').click();
  await page.waitForTimeout(300);
  check('Cancel keeps the project (B7)', (await h.call('list_projects', {})).length === 1);
  await page.getByRole('button', { name: 'Delete project' }).click();
  await confirmDialog(h).locator('[data-confirm]').click();
  await page.waitForTimeout(300);
  check('Delete removes it', (await h.call('list_projects', {})).length === 0);
  await page.locator('.snackbar-action', { hasText: 'Undo' }).click();
  await page.waitForTimeout(400);
  const restored = await h.call('list_projects', {});
  const bom = restored[0] ? await h.call('list_bom', { id: restored[0].id }) : [];
  check('Undo brings the project and its line back', restored[0]?.name === 'Clock' && bom[0]?.component_id === c.id && bom[0]?.required_qty === 3, `${proj.id} -> ${restored[0]?.id}`);
});

await scenario('backups: make, compare, restore with Cancel, undo the restore', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  await h.call('save_component', { component: part('BC547', { quantity: 10 }) });
  await h.open();
  await page.getByRole('button', { name: 'Backups' }).click();
  await page.getByRole('button', { name: 'Back up now' }).first().click();
  await page.waitForSelector('.data-table tbody tr');
  const [c] = await h.call('list_components', {});
  await h.call('adjust_quantity', { id: c.id, delta: 5 });
  await page.getByRole('button', { name: 'What changed' }).first().click();
  check('the comparison shows the changed count', await page.getByRole('dialog').locator('ins', { hasText: '15' }).first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
  await confirmDialog(h).locator('[data-cancel]').click();
  await page.waitForTimeout(300);
  check('Cancel does not restore (B8)', (await h.call('list_components', {}))[0].quantity === 15);
  await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
  await confirmDialog(h).locator('[data-confirm]').click();
  await page.waitForTimeout(800);
  check('Restore brings the backup back', (await h.call('list_components', {}))[0].quantity === 10);
  await page.locator('.snackbar-action', { hasText: 'Undo' }).click();
  await page.waitForTimeout(800);
  check('Undo of the restore brings the newer data back', (await h.call('list_components', {}))[0].quantity === 15);
});

await scenario('import: CSV review, pack size edit, apply, undo from history', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  await h.call('save_component', { component: part('LM7805', { quantity: 4 }) });
  const csv = path.join(h.state.outDir, 'order.csv');
  fs.writeFileSync(csv, 'Part Code;Description;Quantity\nLM7805;Regulator;3\nNE555;Timer;2\nBAD;Broken;iki\n');
  await h.open();
  await page.getByRole('button', { name: 'Import', exact: true }).first().click();
  await page.setInputFiles('input[type=file]', csv);
  await page.waitForSelector('.review');
  check('the review lists every line', await page.locator('.review-table tbody tr').count() === 3);
  check('a count it cannot read is flagged, not guessed', await page.locator('.review-table tbody tr', { hasText: 'Broken' }).locator('[aria-invalid="true"]').count() === 1);
  await page.getByLabel('Import LM7805').uncheck();
  const summary = (await page.locator('.review-head p').innerText()).trim();
  check('one line is "1 line", in the summary and on the button', summary.startsWith('1 line · 2 pieces') && await page.getByRole('button', { name: 'Import 1 line', exact: true }).count() === 1, summary);
  await page.getByLabel('Import LM7805').check();
  const ne = page.locator('.review-table tbody tr', { hasText: 'Timer' });
  await ne.getByLabel(/Pieces per unit/).fill('10');
  await ne.getByLabel(/Pieces per unit/).press('Enter');
  check('editing the pack size updates the pieces', (await ne.locator('.why').innerText()).trim() === '20');
  check('"why this number" explains it', (await ne.locator('.why').getAttribute('title'))?.includes('2 units x 10-piece pack = 20 pieces'));
  await page.getByRole('button', { name: /Import 2 lines/ }).click();
  await page.getByRole('heading', { name: 'Imported' }).waitFor();
  const after = Object.fromEntries((await h.call('list_components', {})).map((c) => [c.part_code, c.quantity]));
  check('add mode adds to stock and creates new parts', after.LM7805 === 7 && after.NE555 === 20 && !('BAD' in after), JSON.stringify(after));
  await page.getByRole('button', { name: 'Import another file' }).click();
  await page.locator('.import-history').getByRole('button', { name: 'Undo import' }).click();
  await confirmDialog(h).locator('[data-confirm]').click();
  await page.waitForTimeout(600);
  const undone = Object.fromEntries((await h.call('list_components', {})).map((c) => [c.part_code, c.quantity]));
  check('undo puts the counts back and removes what the import created', undone.LM7805 === 4 && !('NE555' in undone), JSON.stringify(undone));
});

await scenario('labels, export, a KiCad parts list and auto-categorize', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  for (const p of [part('NE555', { category: 'ICs', quantity: 4, description: 'Timer DIP-8' }), part('LM7805', { category: 'ICs', quantity: 2, description: 'Regulator' }),
    part('BC547', { quantity: 30, description: 'NPN transistor TO-92' })]) {
    await h.call('save_component', { component: p });
  }
  await h.open();
  const menu = async (name) => {
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name }).click();
  };
  const pdfPages = (file) => (fs.readFileSync(file, 'latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  // Labels: a sheet PDF for the shown parts.
  await menu('Print labels for the shown parts');
  await page.getByRole('dialog', { name: /Labels for 3 parts/ }).waitFor();
  await page.getByRole('button', { name: 'Save PDF' }).click();
  await page.waitForFunction(() => !document.querySelector('.bg-dialog'), null, { timeout: 10_000 }).catch(() => {});
  const labels = h.state.saved.find((f) => f.endsWith('.pdf'));
  check('labels: a PDF with one page is saved', !!labels && fs.readFileSync(labels).subarray(0, 4).toString() === '%PDF' && pdfPages(labels) === 1, labels ? `${pdfPages(labels)} page(s)` : 'nothing saved');

  // Export: Excel, CSV and JSON through the core, the PDF list drawn in the page.
  const exportAs = async (title) => {
    await menu('Export');
    await page.getByRole('dialog', { name: 'Export the inventory' }).waitFor();
    await page.getByRole('radio', { name: new RegExp(title) }).check();
    const before = h.state.saved.length;
    await page.getByRole('dialog').getByRole('button', { name: 'Export', exact: true }).click();
    for (let i = 0; i < 40 && h.state.saved.length === before; i++) await page.waitForTimeout(250);
    await page.keyboard.press('Escape');
    return h.state.saved[before] ?? null;
  };
  const csv = await exportAs('CSV');
  const csvLines = csv ? fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/) : [];
  check('export: CSV has a header and every part', csvLines.length === 4 && csvLines.some((l) => l.includes('NE555')), `${csvLines.length} lines`);
  const json = await exportAs('JSON');
  const parsed = json ? JSON.parse(fs.readFileSync(json, 'utf8')) : null;
  const items = Array.isArray(parsed) ? parsed : parsed?.components ?? [];
  check('export: JSON holds every part with its count', items.length === 3 && items.find((c) => c.part_code === 'BC547')?.quantity === 30, `${items.length} parts`);
  const xlsx = await exportAs('Excel workbook');
  const wb = xlsx ? XLSX.read(fs.readFileSync(xlsx)) : null;
  const summaryRows = wb ? XLSX.utils.sheet_to_json(wb.Sheets.Summary ?? {}) : [];
  check('export: the Excel workbook has a summary and a sheet per category', !!wb && wb.SheetNames.join(',') === 'Summary,ICs,Uncategorized' && summaryRows.length === 3,
    wb ? wb.SheetNames.join(', ') : 'nothing saved');
  const pdf = await exportAs('PDF list');
  check('export: the PDF list is saved', !!pdf && pdf.endsWith('.pdf') && pdfPages(pdf) >= 1, pdf ?? 'nothing saved');

  // A KiCad schematic builds the project's parts list: two NE555 and one LM7805 match, R1 does not.
  const sym = (ref, value, x) => `  (symbol (lib_id "Device:U") (at ${x} 20 0) (unit 1)
    (property "Reference" "${ref}" (at ${x} 19 0))
    (property "Value" "${value}" (at ${x} 21 0)))`;
  const sch = path.join(h.state.outDir, 'amp.kicad_sch');
  fs.writeFileSync(sch, `(kicad_sch (version 20231120) (generator eeschema)\n${sym('U1', 'NE555', 10)}\n${sym('U2', 'NE555', 30)}\n${sym('U3', 'LM7805', 50)}\n${sym('R1', '4.7K', 70)}\n)\n`);
  await page.getByRole('button', { name: 'Projects' }).click();
  await page.getByPlaceholder('New project name').fill('Amp');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('tab', { name: 'Schematic' }).click();
  h.state.nextSchematic = sch;
  await page.getByRole('button', { name: 'Choose a file' }).click();
  await page.getByRole('button', { name: 'Build parts list from it' }).click();
  const bomDialog = page.getByRole('dialog', { name: 'Parts list from the schematic' });
  check('the schematic matches two parts and reports one it cannot match', await bomDialog.getByText('2 parts on the schematic match your inventory; 1 do not.').isVisible());
  await bomDialog.getByRole('button', { name: 'Add 2 lines' }).click();
  await page.waitForTimeout(500);
  const [project] = await h.call('list_projects', {});
  const bom = await h.call('list_bom', { id: project.id });
  const need = Object.fromEntries(bom.map((l) => [l.part_code, l.required_qty]));
  check('the parts list needs 2 x NE555 and 1 x LM7805', need.NE555 === 2 && need.LM7805 === 1, JSON.stringify(need));

  // Auto-categorize: BC547 has no category; the suggestion files it, and a backup is taken first.
  await page.locator('.nav-item').first().click();
  await menu('Auto-categorize');
  const bulk = page.getByRole('dialog', { name: 'Auto-categorize' });
  await bulk.waitFor();
  const backupsBefore = (await h.call('list_backups', {})).length;
  await bulk.getByRole('button', { name: /^Apply [1-9]/ }).click();
  await page.waitForTimeout(600);
  const bc = (await h.call('list_components', {})).find((c) => c.part_code === 'BC547');
  check('auto-categorize files BC547 under Transistors', bc?.category === 'Transistors', `${bc?.category} / ${bc?.subcategory}`);
  check('auto-categorize takes a backup first', (await h.call('list_backups', {})).length === backupsBefore + 1);
});

await scenario('import: 2,000 lines from file to inventory in under 3 s', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  const csv = path.join(h.state.outDir, 'big.csv');
  const lines = ['Part Code;Description;Quantity'];
  for (let i = 0; i < 2000; i++) lines.push(`BULK-${String(i).padStart(4, '0')};Resistor ${i} ohm 0805;${(i % 50) + 1}`);
  fs.writeFileSync(csv, `${lines.join('\n')}\n`);
  await h.open();
  await page.getByRole('button', { name: 'Import', exact: true }).first().click();
  const start = Date.now();
  await page.setInputFiles('input[type=file]', csv);
  await page.waitForSelector('.review');
  const toReview = Date.now() - start;
  const drawn = await page.locator('.review-table tbody tr:not(.review-more)').count();
  await page.locator('.review-table-wrap').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const more = await page.waitForFunction((n) => document.querySelectorAll('.review-table tbody tr:not(.review-more)').length > n, drawn, { timeout: 3000 }).then(() => true, () => false);
  check('a long review is drawn in steps and scrolling draws more', drawn < 2000 && more, `${drawn} drawn first`);
  // Timed inside the page, from the click to the result screen, so the locator's own search through
  // the long list is not counted.
  const button = page.getByRole('button', { name: /Import 2,000 lines/ });
  await button.waitFor();
  const toApply = Math.round(await button.evaluate((btn) => new Promise((resolve) => {
    const t0 = performance.now();
    const done = () => [...document.querySelectorAll('h2')].some((el) => el.textContent?.trim() === 'Imported');
    const obs = new MutationObserver(() => {
      if (done()) {
        obs.disconnect();
        resolve(performance.now() - t0);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    btn.click();
  })));
  check('2,000 lines: file to review and review to inventory together under 3 s', toReview + toApply < 3000, `review ${toReview} ms, apply ${toApply} ms`);
  check('every line reached the inventory', (await h.call('list_components', {})).length === 2000);
});

await scenario('import: a deep link from the extension opens the review', { locale: 'tr-TR' }, async (h) => {
  const { page } = h;
  await h.open();
  const link = await page.evaluate(async () => {
    const payload = { format: 'cinv', version: 1, source: { site: 'motorobit', kind: 'order', url: '' }, items: [{ name: '91K 603 SMD Direnç - 10 Adet', qty: 10 }, { name: 'IRFZ44N - 55V 49A Mosfet - TO220', qty: 8 }] };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return `component-inventory://import?d=${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  });
  // One send can reach the app more than once (seen on the owner's laptop): it is one review.
  h.state.deepLinks.push(link, link);
  await h.emit('deep-link-pending', null);
  await page.waitForSelector('.review', { timeout: 10_000 });
  h.state.deepLinks.push(link);
  await h.emit('deep-link-pending', null);
  await page.waitForTimeout(600);
  check('a repeated delivery of the same link is not queued', (await page.locator('.bg-snackbar', { hasText: 'başka bir liste bekliyor' }).count()) === 0);
  check('the review opens in Turkish', await page.locator('.review-head h2', { hasText: 'İnceleme' }).isVisible());
  check('the pack rule applies (10 x 10 = 100)', (await page.locator('.review-table tbody tr').first().locator('.why').innerText()).trim() === '100');
  check('html lang follows the language', (await page.evaluate(() => document.documentElement.lang)) === 'tr');

  // A list that arrives while a review is open waits its turn; a broken link is reported.
  const second = await page.evaluate(async () => {
    const payload = { format: 'cinv', version: 1, source: { site: 'robocombo', kind: 'order', url: '' }, items: [{ name: '2N2222 NPN Tip Transistör', code: '1905300001', qty: 2 }] };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return `component-inventory://import?d=${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  });
  h.state.deepLinks.push('component-inventory://import?d=not-json', second);
  await h.emit('deep-link-pending', null);
  await page.locator('.bg-snackbar', { hasText: 'başka bir liste bekliyor' }).waitFor({ timeout: 8000 });
  check('a second list waits while a review is open', (await page.locator('.review-head h2').innerText()).includes('Motorobit'));
  await page.locator('.review-head').getByRole('button', { name: 'Vazgeç' }).click();
  await page.locator('.review-head h2', { hasText: 'Robocombo' }).waitFor({ timeout: 8000 });
  check('after Cancel the waiting list opens', true);
  check('the unreadable link is reported, not dropped silently', (await page.locator('.bg-snackbar', { hasText: 'okunamadı' }).count()) > 0);
  await page.locator('.review-head').getByRole('button', { name: 'Vazgeç' }).click();
  await page.waitForTimeout(800);
  check('after the last Cancel no review opens again', (await page.locator('.review').count()) === 0);
});

await scenario('the update check only shows a toast (B6)', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  h.state.update = () => ({ status: 'available', current: '1.0.0-beta.1', latest: '1.0.0-beta.2', url: 'https://github.com/bugragungoz/component-inventory/releases/tag/v1.0.0-beta.2' });
  await h.open();
  await page.locator('.bg-snackbar', { hasText: '1.0.0-beta.2' }).waitFor({ timeout: 8000 });
  check('a new version shows a toast', true);
  check('Settings did not open by itself', await page.getByRole('button', { name: /^Inventory/ }).first().getAttribute('aria-current') === 'page');
  await page.locator('.snackbar-action', { hasText: 'Download' }).click();
  check('Download opens the release page in the browser', h.state.opened.some((u) => u.includes('/releases/tag/v1.0.0-beta.2')));
});

await scenario('the owner\'s old database opens, migrated, with a copy kept', {
  locale: 'tr-TR',
  dataDir: (() => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'cinv-v0-'));
    const db = new DatabaseSync(path.join(dir, 'component_inventory.db'));
    db.exec(fs.readFileSync(path.join(ROOT, 'test-fixtures/db/v0-schema.sql'), 'utf8'));
    db.close();
    return dir;
  })(),
}, async (h) => {
  const { page } = h;
  // The old app kept its settings in WebView storage, which the new app shares (same identifier).
  await page.context().addInitScript(() => {
    const old = { locale: 'tr', theme: 'light', defaultQty: '5', lowStockThreshold: '3', formMode: 'simple', driveSyncBaseName: 'Envanterim' };
    for (const [k, v] of Object.entries(old)) localStorage.setItem(k, v);
  });
  await h.open();
  const s = await h.call('get_settings', {});
  check("the old app's settings are carried over once", s.legacy_imported && s.language === 'tr' && s.theme === 'light' && s.default_quantity === 5
    && s.low_stock_threshold === 3 && s.form_mode === 'simple' && s.drive_base_name === 'Envanterim', JSON.stringify({ ...s, table_columns: undefined }));
  check('every old part is listed', await page.locator('.tr').count() === 10);
  check('the migration toast offers the backups', (await toastText(h)).includes('yeni biçime'));
  const backups = await h.call('list_backups', {});
  check('a pre-migration copy exists', backups.some((b) => b.kind === 'pre-migration'));
});

await scenario('a database from a newer app version shows the startup screen', {
  locale: 'en-US', startup: { ok: false, error: { code: 'newer_schema', detail: 'schema 9 > 1' }, data_dir: 'C:/Users/owner/AppData/Roaming/com.bugragungoz.component-inventory' },
}, async (h) => {
  const { page } = h;
  await h.open();
  check('the screen says nothing was changed', await page.getByText('Nothing was changed').isVisible());
  await page.getByRole('button', { name: 'Open the data folder' }).click();
  check('it offers the data folder', h.state.opened.includes('folder:data'));
});

await scenario('Google Drive copy: choose a folder, turn it on, write now', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  await h.call('save_component', { component: part('NE555', { quantity: 3 }) });
  const folder = fs.mkdtempSync(path.join(h.state.outDir, 'drive-'));
  await h.open();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const drive = page.locator('section[aria-labelledby="settings-drive"]');
  check('Drive cannot be turned on before a folder is chosen', await drive.getByRole('switch').isDisabled());
  h.state.nextFolder = folder;
  await drive.getByRole('button', { name: 'Choose folder' }).click();
  await drive.getByText(folder).waitFor({ timeout: 5000 });
  await drive.getByRole('switch').click();
  await page.waitForTimeout(600);
  const beforeWrite = (await page.locator('.statusbar').innerText()).replace(/\s+/g, ' ');
  check('before the first copy the status bar does not claim one was written', !/Drive synced/.test(beforeWrite), beforeWrite);
  await drive.getByRole('button', { name: 'Write now' }).click();
  await drive.getByText(/Last written/).waitFor({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(400);
  const afterWrite = (await page.locator('.statusbar').innerText()).replace(/\s+/g, ' ');
  check('after a copy the status bar shows its time', /Drive synced \d/.test(afterWrite), afterWrite);
  const files = fs.readdirSync(folder).sort();
  check('the Excel, JSON and database copies are written', ['croxz.db', 'croxz.json', 'croxz.xlsx'].every((f) => files.includes(f)), files.join(', '));
  const json = JSON.parse(fs.readFileSync(path.join(folder, 'croxz.json'), 'utf8'));
  const list = Array.isArray(json) ? json : json.components ?? [];
  check('the JSON copy holds the inventory', JSON.stringify(list).includes('NE555'));
});

await scenario('a saved column order keeps the part code first and the count in view', { locale: 'en-US', viewport: { width: 1440, height: 900 } }, async (h) => {
  const { page } = h;
  const long = 'LM2596 Ayarlanabilir Voltaj Regülatör Kartı (1.25-30V) ile uzun bir açıklama, gerçek envanterdeki gibi';
  await h.call('save_component', { component: part('LM2596-MODULE', { description: long, category: 'Modules' }) });
  // What the Columns dialog saves: the fixed columns (part code, quantity) are not in the list.
  await h.call('update_settings', { patch: { table_columns: [
    { key: 'category', visible: true }, { key: 'subcategory', visible: true }, { key: 'description', visible: true },
    { key: 'package', visible: true }, { key: 'voltage_max', visible: true },
  ] } });
  await h.open();
  const heads = await page.locator('.thead .th').allInnerTexts();
  check('the part code is the first column', heads.map((s) => s.trim()).filter(Boolean)[0] === 'Part code', heads.join(' | '));
  const fits = await page.evaluate(() => { const t = document.querySelector('.table'); return t.scrollWidth <= t.clientWidth + 1; });
  check('no sideways scrolling at 1440 px with a long description', fits);
  const qty = await page.locator('.thead .th', { hasText: 'Quantity' }).boundingBox();
  check('the quantity column is on screen', !!qty && qty.x + qty.width <= 1440, JSON.stringify(qty));
  // The sort chosen last time comes back at start.
  await h.call('save_component', { component: part('AAA-FIRST', { category: 'Resistors' }) });
  await h.call('update_settings', { patch: { table_sort: { column: 'category', direction: 'desc' } } });
  await h.open();
  const sortedBy = await page.locator('.th-sort .sort-icon.is-active').locator('xpath=..').innerText();
  check('the saved sort is restored at start', sortedBy.trim() === 'Category', sortedBy);
});

await scenario('storage places: put chosen parts in a box, then rename the box', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  for (const code of ['LM358', 'NE555', 'BC547']) await h.call('save_component', { component: part(code) });
  await h.open();
  await page.getByRole('checkbox', { name: 'Select LM358' }).check();
  await page.getByRole('checkbox', { name: 'Select NE555' }).check();
  await page.getByRole('button', { name: 'Move to storage place' }).click();
  await page.getByRole('dialog').getByLabel('Storage place').fill('Kutu 1');
  await page.getByRole('dialog').getByRole('button', { name: 'Move', exact: true }).click();
  await page.locator('.bg-snackbar', { hasText: 'are now in Kutu 1' }).waitFor({ timeout: 8000 });
  const places = async () => Object.fromEntries((await h.call('list_components', {})).map((c) => [c.part_code, c.location]));
  check('the two chosen parts are in Kutu 1, the third is not', JSON.stringify(await places()) === JSON.stringify({ BC547: '', LM358: 'Kutu 1', NE555: 'Kutu 1' }), JSON.stringify(await places()));
  check('the sidebar lists the new place with its count', (await page.locator('.tree-row', { hasText: 'Kutu 1' }).innerText()).includes('2'));
  await page.locator('.tree-line', { hasText: 'Kutu 1' }).hover();
  await page.getByRole('button', { name: 'Rename Kutu 1' }).click();
  await page.getByRole('dialog').getByLabel('New name').fill('Raf A / Kutu 1');
  await page.getByRole('dialog').getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('.tree-row', { hasText: 'Raf A / Kutu 1' }).waitFor({ timeout: 8000 });
  const after = await places();
  check('renaming the box moves every part in it', after.LM358 === 'Raf A / Kutu 1' && after.NE555 === 'Raf A / Kutu 1' && after.BC547 === '', JSON.stringify(after));
});

await scenario('Drive on at start: the status bar does not claim a copy before one is written', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  const folder = fs.mkdtempSync(path.join(h.state.outDir, 'drive-'));
  await h.call('set_folder_for_test', { kind: 'drive', path: folder });
  await h.call('update_settings', { patch: { drive_enabled: true } });
  await h.open();
  await page.waitForTimeout(800);
  const text = (await page.locator('.statusbar').innerText()).replace(/\s+/g, ' ');
  check('the status bar says Drive is on, not "synced -"', /Drive sync on/.test(text) && !/Drive synced/.test(text), text);
});

await scenario('accessibility (axe) in both themes', { locale: 'en-US' }, async (h) => {
  const { page } = h;
  await h.call('seed_components', { count: 40 });
  await h.open();
  const axe = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axe });
  const run = async (label) => {
    const r = await page.evaluate(async () => {
      const res = await window.axe.run(document, { resultTypes: ['violations'] });
      return res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target}`);
    });
    check(`axe: no serious issues on ${label}`, r.length === 0, r.slice(0, 4).join(' ; '));
  };
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForTimeout(400); // let color transitions finish before measuring contrast
    await run(`the inventory (${theme})`);
    await page.locator('.tr').first().click();
    await run(`the detail panel (${theme})`);
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(400); // the dialog fades in
    await run(`the add dialog (${theme})`);
    await page.keyboard.press('Escape');
    for (const v of ['Projects', 'Import', 'Backups', 'Settings']) {
      await page.getByRole('button', { name: v, exact: true }).first().click();
      await page.waitForTimeout(400);
      await run(`${v} (${theme})`);
    }
    await page.getByRole('button', { name: /^Inventory/ }).first().click();
  }
});

await scenario('performance with 100,000 parts', { locale: 'en-US' }, async (h) => {
  // The load time here includes the harness transport (the bridge and Playwright's binding), which
  // is far slower than Tauri's IPC, so it is reported, not judged. Rendering, scrolling and search
  // run in the page and are judged.
  const { page } = h;
  await h.call('seed_components', { count: 100_000 });
  const t0 = Date.now();
  await h.open('', 240_000);
  await page.waitForSelector('.tr', { timeout: 240_000 });
  console.log(`     load through the harness: ${Date.now() - t0} ms`);
  check('only the rows in view are in the DOM', (await page.locator('.tr').count()) < 80, `${await page.locator('.tr').count()} rows`);
  // Each jump scrolls 80 rows and waits two frames (about 33 ms at 60 Hz when the render fits in
  // a frame). Smooth means the typical jump stays near that and none stalls.
  const scroll = await page.evaluate(async () => {
    const el = document.querySelector('.table');
    const times = [];
    for (let i = 0; i < 60; i++) {
      const s = performance.now();
      el.scrollTop += 2900;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      times.push(performance.now() - s);
    }
    times.sort((a, b) => a - b);
    return { median: times[30], p95: times[57] };
  });
  check('scrolling 100,000 rows: a jump takes under 50 ms (median) and none stalls over 120 ms (95th percentile)', scroll.median < 50 && scroll.p95 < 120,
    `median ${scroll.median.toFixed(1)} ms, p95 ${scroll.p95.toFixed(1)} ms`);
  const s0 = Date.now();
  await page.fill('#inventory-search', 'part 099999');
  await page.waitForFunction(() => document.querySelectorAll('.tr').length === 1, null, { timeout: 10_000 });
  const search = Date.now() - s0;
  check('a search over 100,000 parts answers in under 1.5 s', search < 1500, `${search} ms`);
  const sortStart = Date.now();
  await page.fill('#inventory-search', '');
  await page.locator('.th-sort', { hasText: 'Quantity' }).click();
  await page.waitForTimeout(50);
  check('sorting 100,000 parts takes under 2 s', Date.now() - sortStart < 2000, `${Date.now() - sortStart} ms`);
});

const summary = `${results.filter((r) => r.ok).length} of ${results.length} checks passed`;
console.log(`\n${summary}`);
fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'test-results', 'ui.json'), JSON.stringify({ summary, results }, null, 2));
process.exit(failed ? 1 : 0);
