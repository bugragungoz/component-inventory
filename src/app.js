import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { renderTable, applyFilters, initSelectionBarOnce } from './modules/table.js';
import { initModals } from './modules/modals.js';
import { initImport } from './modules/import.js';
import { initExport } from './modules/export.js';
import { initBackupUI } from './modules/backup.js';
import { initLabels }            from './modules/labels.js';
import { initBulkCategorize }    from './modules/bulk_categorize.js';
import { initI18n, t, setLocale, getLocale, applyTranslations } from './modules/i18n.js';
import { initBackupDiff }        from './modules/backup_diff.js';
import { initDriveSync, triggerDriveSync, triggerDriveSyncManual, getDriveStatus, onDriveStatusChange, DRIVE_DEFAULT_BASE_NAME } from './modules/drive_sync.js';
import { initSidebarFuzzySearch } from './modules/fuzzy_search.js';
import { initProjects } from './modules/projects.js';
import { UNCATEGORIZED_CATEGORY, STORAGE_KEYS, DEFAULTS } from './modules/constants.js';
import { inferImportRow } from './modules/component_inference.js';
import { repairPlaceholderComponents } from './modules/import_repair.js';

// Rename pencil SVG (inline, reused in tree rendering)
const RENAME_SVG = `<svg class="rename-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

// ============================================================
// State singleton
// ============================================================
export const state = {
  db: null,
  components: [],
  filtered: [],
  sortCol: 'part_code',
  sortDir: 'asc',
  searchQuery: '',
  filterCat: '',
  filterSub: '',
  filterLoc: '',
  filterLocSub: '',
  viewCompact: true,
  mutationBatchDepth: 0,
  mutationBatchDirty: false,
};

// ============================================================
// DB initialization
// ============================================================
async function initDB() {
  const db = await Database.load('sqlite:component_inventory.db');
  state.db = db;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS components (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      part_code     TEXT UNIQUE NOT NULL,
      category      TEXT DEFAULT '',
      subcategory   TEXT DEFAULT '',
      quantity      INTEGER DEFAULT 0,
      package       TEXT DEFAULT '',
      manufacturer  TEXT DEFAULT '',
      mpn           TEXT DEFAULT '',
      preferred_supplier TEXT DEFAULT '',
      location      TEXT DEFAULT '',
      voltage_max   REAL,
      current_max   REAL,
      description   TEXT DEFAULT '',
      datasheet_url TEXT DEFAULT '',
      unit_price    REAL,
      notes         TEXT DEFAULT '',
      image_path    TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id   INTEGER NOT NULL,
      part_code      TEXT NOT NULL,
      delta          INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      reason         TEXT DEFAULT '',
      created_at     TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      description    TEXT DEFAULT '',
      notes          TEXT DEFAULT '',
      schematic_path TEXT DEFAULT '',
      order_index    INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS project_components (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id   INTEGER NOT NULL,
      component_id INTEGER NOT NULL,
      required_qty INTEGER NOT NULL DEFAULT 1,
      missing_qty  INTEGER NOT NULL DEFAULT 0,
      note         TEXT DEFAULT '',
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, component_id)
    );
  `);

  // Migrations - each wrapped in try/catch so they are idempotent.
  // SQLite ALTER TABLE only supports ADD COLUMN, so each migration is a
  // single column add. Failures (column already exists) are swallowed.
  const migrations = [
    `ALTER TABLE components ADD COLUMN image_path   TEXT DEFAULT ''`,
    `ALTER TABLE components ADD COLUMN resistance   TEXT DEFAULT ''`,
    `ALTER TABLE components ADD COLUMN tolerance    TEXT DEFAULT ''`,
    `ALTER TABLE components ADD COLUMN power_rating REAL`,
    `ALTER TABLE components ADD COLUMN preferred_supplier TEXT DEFAULT ''`,
    // JSON attributes column - stores category-specific parameters
    // (e.g. rds_on/vgs_th for MOSFETs, hfe/vce_sat for BJTs).
    `ALTER TABLE components ADD COLUMN attributes   TEXT DEFAULT '{}'`,
    // Projects: notes (long-form free text in addition to description) and
    // order_index (manual sort order driven by the sidebar drag handles).
    `ALTER TABLE projects ADD COLUMN notes        TEXT DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN order_index  INTEGER NOT NULL DEFAULT 0`,
    // BOM: missing_qty captures a user-entered shortage value so the
    // missing column can stay manual instead of being derived from stock.
    `ALTER TABLE project_components ADD COLUMN missing_qty INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch (_) { /* column already exists */ }
  }
}

// ============================================================
// CRUD operations
// ============================================================
export async function loadComponents() {
  const rows = await state.db.select('SELECT * FROM components ORDER BY part_code ASC');
  state.components = rows;
  applyFilters();
  renderTable();
  updateStats();
  updateCategoryTree();
  updateLocationTree();
}

export async function addComponent(data) {
  const { part_code, category, subcategory, quantity, package: pkg,
    manufacturer, mpn, preferred_supplier, location, voltage_max, current_max,
    description, datasheet_url, unit_price, notes, image_path,
    resistance, tolerance, power_rating, attributes } = data;

  const attrsJson = attributes && typeof attributes === 'object'
    ? JSON.stringify(attributes)
    : (typeof attributes === 'string' ? attributes : '{}');

  await state.db.execute(
    `INSERT INTO components
      (part_code, category, subcategory, quantity, package, manufacturer, mpn, location,
       preferred_supplier,
       voltage_max, current_max, description, datasheet_url, unit_price, notes, image_path,
       resistance, tolerance, power_rating, attributes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [part_code, category || '', subcategory || '', quantity || 0, pkg || '',
     manufacturer || '', mpn || '', location || '', preferred_supplier || '',
     voltage_max ?? null, current_max ?? null,
     description || '', datasheet_url || '', unit_price ?? null, notes || '',
     image_path || '', resistance || '', tolerance || '', power_rating ?? null,
     attrsJson]
  );
  const inserted = await state.db.select(
    'SELECT id, quantity FROM components WHERE part_code = ? LIMIT 1',
    [part_code]
  );
  const row = inserted && inserted[0];
  if (row) {
    const qty = Number(row.quantity) || 0;
    await recordStockMovement(row.id, part_code, qty, qty, 'create');
  }
  await finalizeMutation();
}

export async function updateComponent(id, data) {
  const { part_code, category, subcategory, quantity, package: pkg,
    manufacturer, mpn, preferred_supplier, location, voltage_max, current_max,
    description, datasheet_url, unit_price, notes, image_path,
    resistance, tolerance, power_rating, attributes } = data;

  const attrsJson = attributes && typeof attributes === 'object'
    ? JSON.stringify(attributes)
    : (typeof attributes === 'string' ? attributes : '{}');

  const beforeRows = await state.db.select(
    'SELECT quantity, part_code FROM components WHERE id = ? LIMIT 1',
    [id]
  );
  const beforeQty = Number(beforeRows?.[0]?.quantity) || 0;
  const beforePartCode = String(beforeRows?.[0]?.part_code || '');

  await state.db.execute(
    `UPDATE components SET
      part_code=?, category=?, subcategory=?, quantity=?, package=?,
      manufacturer=?, mpn=?, location=?, preferred_supplier=?, voltage_max=?, current_max=?,
      description=?, datasheet_url=?, unit_price=?, notes=?, image_path=?,
      resistance=?, tolerance=?, power_rating=?, attributes=?,
      updated_at=datetime('now')
     WHERE id=?`,
    [part_code, category || '', subcategory || '', quantity || 0, pkg || '',
     manufacturer || '', mpn || '', location || '', preferred_supplier || '',
     voltage_max ?? null, current_max ?? null,
     description || '', datasheet_url || '', unit_price ?? null, notes || '',
     image_path || '', resistance || '', tolerance || '', power_rating ?? null,
     attrsJson, id]
  );
  const afterQty = Number(quantity) || 0;
  if (afterQty !== beforeQty) {
    await recordStockMovement(
      id,
      part_code || beforePartCode,
      afterQty - beforeQty,
      afterQty,
      'edit',
    );
  }
  await finalizeMutation();
}

/**
 * Rename a category or subcategory across all components in the DB.
 * If isSubcategory is true, only renames the subcategory within the given parentCat.
 */
export async function renameCategory(oldName, newName, isSubcategory = false, parentCat = '') {
  if (!newName.trim() || oldName === newName.trim()) return;
  const trimmed = newName.trim();
  if (isSubcategory) {
    await state.db.execute(
      `UPDATE components SET subcategory = ?, updated_at = datetime('now')
       WHERE subcategory = ? AND category = ?`,
      [trimmed, oldName, parentCat]
    );
  } else {
    await state.db.execute(
      `UPDATE components SET category = ?, updated_at = datetime('now')
       WHERE category = ?`,
      [trimmed, oldName]
    );
  }
  await finalizeMutation();
}

export async function deleteComponent(id) {
  const rows = await state.db.select(
    'SELECT part_code, quantity FROM components WHERE id = ? LIMIT 1',
    [id]
  );
  const old = rows && rows[0];
  if (old) {
    await recordStockMovement(id, old.part_code, -(Number(old.quantity) || 0), 0, 'delete');
  }
  await state.db.execute('DELETE FROM components WHERE id=?', [id]);
  await finalizeMutation();
}

export async function deleteComponents(ids) {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await state.db.select(
    `SELECT id, part_code, quantity FROM components WHERE id IN (${placeholders})`,
    ids
  );
  for (const r of rows) {
    await recordStockMovement(r.id, r.part_code, -(Number(r.quantity) || 0), 0, 'bulk-delete');
  }
  await state.db.execute(`DELETE FROM components WHERE id IN (${placeholders})`, ids);
  await finalizeMutation();
}

export async function upsertComponents(rows, mode = 'merge') {
  if (mode === 'replace') {
    await state.db.execute('DELETE FROM components');
  }

  for (const row of rows) {
    const inferred = inferImportRow(row);
    const { part_code, category, subcategory, quantity, package: pkg,
      manufacturer, mpn, preferred_supplier, location, voltage_max, current_max,
      description, datasheet_url, unit_price, notes } = inferred;

    if (!part_code) continue;

    // New components without a category land in Uncategorized.
    // In merge mode, never overwrite an existing category/subcategory with an empty value.
    const catVal    = category    || UNCATEGORIZED_CATEGORY;
    const subVal    = subcategory || '';
    const qtyVal    = parseLocaleNumber(quantity)   ?? 0;
    const vMaxVal   = parseLocaleNumber(voltage_max);
    const iMaxVal   = parseLocaleNumber(current_max);
    const priceVal  = parseLocaleNumber(unit_price);

    const existingRows = await state.db.select(
      'SELECT id, quantity FROM components WHERE part_code = ? LIMIT 1',
      [part_code]
    );
    const existing = existingRows && existingRows[0];
    const prevQty = Number(existing?.quantity) || 0;

    await state.db.execute(
      `INSERT INTO components
        (part_code, category, subcategory, quantity, package, manufacturer, mpn, location,
         preferred_supplier, voltage_max, current_max, description, datasheet_url, unit_price, notes, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(part_code) DO UPDATE SET
         category    = CASE WHEN excluded.category    != '' AND excluded.category != '${UNCATEGORIZED_CATEGORY}'
                            THEN excluded.category    ELSE components.category    END,
         subcategory = CASE WHEN excluded.subcategory != ''
                            THEN excluded.subcategory ELSE components.subcategory END,
         quantity    = excluded.quantity,
         package     = CASE WHEN excluded.package  != '' THEN excluded.package  ELSE components.package  END,
         manufacturer= CASE WHEN excluded.manufacturer != '' THEN excluded.manufacturer ELSE components.manufacturer END,
         mpn         = CASE WHEN excluded.mpn  != '' THEN excluded.mpn  ELSE components.mpn  END,
         location    = CASE WHEN excluded.location != '' THEN excluded.location ELSE components.location END,
        preferred_supplier = CASE WHEN excluded.preferred_supplier != '' THEN excluded.preferred_supplier ELSE components.preferred_supplier END,
         voltage_max = CASE WHEN excluded.voltage_max IS NOT NULL THEN excluded.voltage_max ELSE components.voltage_max END,
         current_max = CASE WHEN excluded.current_max IS NOT NULL THEN excluded.current_max ELSE components.current_max END,
         description = CASE WHEN excluded.description != '' THEN excluded.description ELSE components.description END,
         datasheet_url=CASE WHEN excluded.datasheet_url != '' THEN excluded.datasheet_url ELSE components.datasheet_url END,
         unit_price  = CASE WHEN excluded.unit_price IS NOT NULL THEN excluded.unit_price ELSE components.unit_price END,
         notes       = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE components.notes END,
         updated_at  = datetime('now')`,
      [part_code, catVal, subVal, isNaN(qtyVal) ? 0 : qtyVal, pkg || '',
       manufacturer || '', mpn || '', location || '', preferred_supplier || '',
       (vMaxVal != null && !isNaN(vMaxVal)) ? vMaxVal : null,
       (iMaxVal != null && !isNaN(iMaxVal)) ? iMaxVal : null,
       description || '', datasheet_url || '',
       (priceVal != null && !isNaN(priceVal)) ? priceVal : null, notes || '', '']
    );

    const finalRows = await state.db.select(
      'SELECT id, quantity FROM components WHERE part_code = ? LIMIT 1',
      [part_code]
    );
    const finalRow = finalRows && finalRows[0];
    const newQty = Number(finalRow?.quantity) || 0;
    if (finalRow && (!existing || newQty !== prevQty)) {
      await recordStockMovement(
        finalRow.id,
        part_code,
        existing ? (newQty - prevQty) : newQty,
        newQty,
        existing ? 'import-merge' : 'import-create',
      );
    }
  }
  await finalizeMutation();
}

async function triggerBackup() {
  try {
    const retention = parseInt(localStorage.getItem(STORAGE_KEYS.BACKUP_RETENTION) || String(DEFAULTS.BACKUP_RETENTION), 10);
    await invoke('create_backup', { retention: isNaN(retention) ? DEFAULTS.BACKUP_RETENTION : retention });
  } catch (_) {
    // Non-critical - backup failure must not block the UI
  }
  // Cloud sync (Drive / Dropbox / OneDrive) - fire-and-forget
  try { await triggerDriveSync(); } catch (_) { /* logged inside */ }
}

async function finalizeMutation() {
  if (state.mutationBatchDepth > 0) {
    state.mutationBatchDirty = true;
    return;
  }
  await triggerBackup();
  await loadComponents();
}

export function beginMutationBatch() {
  state.mutationBatchDepth += 1;
}

export async function endMutationBatch() {
  if (state.mutationBatchDepth > 0) state.mutationBatchDepth -= 1;
  if (state.mutationBatchDepth === 0 && state.mutationBatchDirty) {
    state.mutationBatchDirty = false;
    await triggerBackup();
    await loadComponents();
  }
}

function getConfiguredBackupIntervalMinutes() {
  const raw = parseInt(localStorage.getItem(STORAGE_KEYS.BACKUP_INTERVAL_MINUTES) || String(DEFAULTS.BACKUP_INTERVAL_MINUTES), 10);
  if (isNaN(raw) || raw <= 0) return DEFAULTS.BACKUP_INTERVAL_MINUTES;
  return raw;
}

async function applyBackupIntervalSetting() {
  const minutes = getConfiguredBackupIntervalMinutes();
  try {
    await invoke('set_backup_interval_minutes', { minutes });
  } catch (_) {
    // Backend scheduler fallback uses default interval.
  }
}

// ============================================================
// Stats & category tree
// ============================================================
function updateStats() {
  const total = state.components.length;
  const units = state.components.reduce((s, c) => s + (Number(c.quantity) || 0), 0);
  const cats  = new Set(state.components.map(c => c.category).filter(Boolean)).size;

  document.getElementById('stat-types').textContent = total;
  document.getElementById('stat-units').textContent = units;
  document.getElementById('stat-cats').textContent  = cats;

  const exportCount = document.getElementById('export-count');
  if (exportCount) exportCount.textContent = total;
}

/**
 * Locale-aware case-fold + Turkish-safe normalization for search.
 * Maps Turkish dotted/dotless I correctly and strips diacritics so that
 * typing "direnc" matches "DIRENC" or "Direnc".
 */
export function normalizeForSearch(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function updateCategoryTree() {
  const tree = document.getElementById('category-tree');
  const catSearch = document.getElementById('sidebar-search').value.toLowerCase().trim();

  const map = {};
  for (const c of state.components) {
    const cat = c.category || '';
    const sub = c.subcategory || '';
    if (!map[cat]) map[cat] = {};
    if (!map[cat][sub]) map[cat][sub] = 0;
    map[cat][sub]++;
  }

  let html = `<div class="tree-item${!state.filterCat ? ' active' : ''}" data-cat="" data-sub="">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    ${t('sidebar.allComponents')}
    <span class="tree-count">${state.components.length}</span>
  </div>`;

  // Locale-aware sort handles Turkish 'I/i' correctly
  const sortedCats = Object.keys(map).sort((a, b) =>
    a.localeCompare(b, getLocale(), { sensitivity: 'base' })
  );
  for (const cat of sortedCats) {
    // Locale-insensitive substring match (handles Turkish dotless/dotted i for filter)
    if (catSearch && !normalizeForSearch(cat).includes(normalizeForSearch(catSearch))) continue;
    const catTotal = Object.values(map[cat]).reduce((a, b) => a + b, 0);
    const isActiveCat = state.filterCat === cat && !state.filterSub;
    html += `<div class="tree-group">
      <div class="tree-cat${isActiveCat ? ' active' : ''}" data-cat="${escHtml(cat)}" data-sub="">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="tree-label">${escHtml(cat)}</span>
        <span class="tree-count">${catTotal}</span>
        <button class="btn-rename-tree" data-rename-cat="${escHtml(cat)}" data-rename-sub="" title="Rename category">${RENAME_SVG}</button>
      </div>`;

    const sortedSubs = Object.keys(map[cat]).sort((a, b) =>
      a.localeCompare(b, getLocale(), { sensitivity: 'base' })
    );
    for (const sub of sortedSubs) {
      if (!sub) continue;
      const isActiveSub = state.filterCat === cat && state.filterSub === sub;
      html += `<div class="tree-sub${isActiveSub ? ' active' : ''}" data-cat="${escHtml(cat)}" data-sub="${escHtml(sub)}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/></svg>
        <span class="tree-label">${escHtml(sub)}</span>
        <span class="tree-count">${map[cat][sub]}</span>
        <button class="btn-rename-tree" data-rename-cat="${escHtml(cat)}" data-rename-sub="${escHtml(sub)}" title="Rename subcategory">${RENAME_SVG}</button>
      </div>`;
    }

    html += '</div>';
  }

  tree.innerHTML = html;

  tree.querySelectorAll('[data-cat]').forEach(el => {
    el.addEventListener('click', e => {
      // Rename button click must not trigger filter selection
      if (e.target.closest('.btn-rename-tree')) return;
      state.filterCat = el.dataset.cat;
      state.filterSub = el.dataset.sub;
      // Reset location filter when switching category selection
      state.filterLoc    = '';
      state.filterLocSub = '';
      applyFilters();
      renderTable();
      updateCategoryTree();
      updateLocationTree();
    });
  });

  // Rename button handlers
  tree.querySelectorAll('.btn-rename-tree').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openRenameModal(
        btn.dataset.renameCat,
        btn.dataset.renameSub
      );
    });
  });
}

// ============================================================
// Category / Subcategory rename modal
// ============================================================
function openRenameModal(cat, sub) {
  const overlay = document.getElementById('overlay-rename-cat');
  const input   = document.getElementById('rename-cat-input');
  const label   = document.getElementById('rename-cat-label');
  if (!overlay || !input) return;

  const isSub = sub !== '';
  label.textContent = isSub
    ? t('rename.sub', { sub, cat })
    : t('rename.cat', { name: cat });
  input.value = isSub ? sub : cat;
  overlay.dataset.renameCat = cat;
  overlay.dataset.renameSub = sub;
  overlay.style.display = 'flex';
  input.focus();
  input.select();
}

async function applyRename() {
  const overlay  = document.getElementById('overlay-rename-cat');
  const input    = document.getElementById('rename-cat-input');
  if (!overlay || !input) return;

  const newName  = input.value.trim();
  const oldCat   = overlay.dataset.renameCat;
  const oldSub   = overlay.dataset.renameSub;
  const isSub    = oldSub !== '';

  if (!newName) { showToast(t('toast.nameEmpty'), 'warning'); return; }
  if (newName === (isSub ? oldSub : oldCat)) {
    window.closeModal(overlay);
    return;
  }

  try {
    await renameCategory(isSub ? oldSub : oldCat, newName, isSub, oldCat);
    window.closeModal(overlay);
    showToast(t('toast.renamed', { name: newName }), 'success');
  } catch (err) {
    showToast(t('toast.renameFailed') + (err.message || err), 'error');
  }
}

function initRenameModal() {
  const overlay  = document.getElementById('overlay-rename-cat');
  const btnOk    = document.getElementById('btn-rename-cat-ok');
  const input    = document.getElementById('rename-cat-input');
  if (!overlay) return;

  const closeRename = () => { window.closeModal(overlay); };

  btnOk?.addEventListener('click', applyRename);
  document.getElementById('btn-rename-cat-cancel')?.addEventListener('click', closeRename);
  document.getElementById('btn-rename-cat-cancel-footer')?.addEventListener('click', closeRename);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeRename(); });
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyRename();
    if (e.key === 'Escape') closeRename();
  });
}

// ============================================================
// Location hierarchy tree
// ============================================================
function updateLocationTree() {
  const tree = document.getElementById('location-tree');
  if (!tree) return;

  // Parse location field: "Cabinet-A / Shelf-3 / Bin-7" → hierarchy levels
  const locationMap = {};
  for (const c of state.components) {
    const loc = (c.location || '').trim();
    if (!loc) continue;
    // Support separators: " / ", " > ", " \ ", "|"
    const parts = loc.split(/\s*[\/\\|>]\s*/).map(p => p.trim()).filter(Boolean);
    const top   = parts[0];
    if (!locationMap[top]) locationMap[top] = { children: {}, count: 0 };
    locationMap[top].count++;
    if (parts[1]) {
      const sub = parts.slice(1).join(' / ');
      locationMap[top].children[sub] = (locationMap[top].children[sub] || 0) + 1;
    }
  }

  const hint = document.getElementById('location-empty-hint');
  if (Object.keys(locationMap).length === 0) {
    tree.querySelectorAll(':not(#location-empty-hint)').forEach(el => el.remove());
    if (hint) hint.style.display = '';
    return;
  }
  if (hint) hint.style.display = 'none';

  let html = '';
  const sortedLocs = Object.keys(locationMap).sort();
  for (const loc of sortedLocs) {
    const isActive = state.filterLoc === loc && !state.filterLocSub;
    html += `<div class="tree-cat${isActive ? ' active' : ''}" data-loc="${escHtml(loc)}" data-loc-sub="">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      ${escHtml(loc)}
      <span class="tree-count">${locationMap[loc].count}</span>
    </div>`;
    const subs = Object.keys(locationMap[loc].children).sort();
    for (const sub of subs) {
      const isActiveSub = state.filterLoc === loc && state.filterLocSub === sub;
      html += `<div class="tree-sub${isActiveSub ? ' active' : ''}" data-loc="${escHtml(loc)}" data-loc-sub="${escHtml(sub)}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg>
        ${escHtml(sub)}
        <span class="tree-count">${locationMap[loc].children[sub]}</span>
      </div>`;
    }
  }

  tree.innerHTML = html;

  tree.querySelectorAll('[data-loc]').forEach(el => {
    el.addEventListener('click', () => {
      const loc    = el.dataset.loc;
      const locSub = el.dataset.locSub;
      if (state.filterLoc === loc && state.filterLocSub === locSub) {
        // Toggle off — clear both filters
        state.filterLoc    = '';
        state.filterLocSub = '';
      } else {
        // Reset category filter when switching to location filter (M-6)
        state.filterCat = '';
        state.filterSub = '';
        state.filterLoc    = loc;
        state.filterLocSub = locSub;
      }
      applyFilters();
      renderTable();
      updateLocationTree();
      updateCategoryTree();
    });
  });
}

// ============================================================
// Theme toggle
// ============================================================
function initTheme() {
  const stored = localStorage.getItem('theme') || 'dark';
  applyTheme(stored);

  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

// ============================================================
// Locations visibility
// ============================================================
export function applyLocationsVisibility() {
  const enabled = localStorage.getItem('locationsEnabled') === 'true';
  ['locations-divider', 'locations-label', 'location-tree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = enabled ? '' : 'none';
  });
}

function initSettings() {
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    openSettingsModal();
  });

  // ---- Language ----
  document.getElementById('s-language')?.addEventListener('change', e => {
    setLocale(e.target.value);
    // Re-render dynamic UI parts that build text in JS
    renderTable();
    updateStats();
    updateCategoryTree();
    updateLocationTree();
  });

  // ---- Form mode (simple / detailed) ----
  document.getElementById('s-form-mode')?.addEventListener('change', e => {
    localStorage.setItem('formMode', e.target.value);
    applyFormMode();
  });

  // ---- Locations toggle ----
  document.getElementById('s-locations-enabled')?.addEventListener('change', e => {
    localStorage.setItem('locationsEnabled', e.target.checked ? 'true' : 'false');
    applyLocationsVisibility();
  });

  // ---- Low stock threshold ----
  document.getElementById('s-low-stock')?.addEventListener('change', e => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 0) {
      localStorage.setItem('lowStockThreshold', String(val));
      renderTable();
    }
  });

  // ---- Default quantity ----
  document.getElementById('s-default-qty')?.addEventListener('change', e => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 0) localStorage.setItem('defaultQty', String(val));
  });

  // ---- Backup retention ----
  document.getElementById('s-backup-retention')?.addEventListener('change', e => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 0) localStorage.setItem(STORAGE_KEYS.BACKUP_RETENTION, String(val));
  });

  // ---- Backup interval (functional) ----
  document.getElementById('s-backup-interval')?.addEventListener('change', e => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      localStorage.setItem(STORAGE_KEYS.BACKUP_INTERVAL_MINUTES, String(val));
      applyBackupIntervalSetting().catch(() => {});
    }
  });

  // ---- Export folder ----
  document.getElementById('s-export-browse')?.addEventListener('click', async () => {
    try {
      const { open: openDir } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDir({ directory: true, title: t('settings.exportFolder') });
      if (selected) {
        localStorage.setItem('exportFolder', selected);
        const inp = document.getElementById('s-export-folder');
        if (inp) inp.value = selected;
      }
    } catch (err) {
      showToast(t('toast.folderFailed') + (err.message || err), 'error');
    }
  });
  document.getElementById('s-export-clear')?.addEventListener('click', () => {
    localStorage.removeItem('exportFolder');
    const inp = document.getElementById('s-export-folder');
    if (inp) inp.value = '';
  });

  // ---- Drive / cloud sync ----
  document.getElementById('s-drive-enabled')?.addEventListener('change', e => {
    localStorage.setItem('driveSyncEnabled', e.target.checked ? 'true' : 'false');
  });
  document.getElementById('s-drive-browse')?.addEventListener('click', async () => {
    try {
      const { open: openDir } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDir({ directory: true, title: t('settings.driveFolder') });
      if (selected) {
        localStorage.setItem('driveSyncFolder', selected);
        const inp = document.getElementById('s-drive-folder');
        if (inp) inp.value = selected;
      }
    } catch (err) {
      showToast(t('toast.folderFailed') + (err.message || err), 'error');
    }
  });
  document.getElementById('s-drive-clear')?.addEventListener('click', () => {
    localStorage.removeItem('driveSyncFolder');
    const inp = document.getElementById('s-drive-folder');
    if (inp) inp.value = '';
  });

  // ---- Sync file base name (default: croxz) ----
  const baseInp = document.getElementById('s-drive-basename');
  if (baseInp) {
    baseInp.value = localStorage.getItem('driveSyncBaseName') || DRIVE_DEFAULT_BASE_NAME;
    baseInp.placeholder = DRIVE_DEFAULT_BASE_NAME;
    baseInp.addEventListener('change', () => {
      const v = baseInp.value.trim();
      if (v) localStorage.setItem('driveSyncBaseName', v);
      else   localStorage.removeItem('driveSyncBaseName');
    });
  }
  document.getElementById('s-drive-basename-reset')?.addEventListener('click', () => {
    localStorage.removeItem('driveSyncBaseName');
    if (baseInp) baseInp.value = DRIVE_DEFAULT_BASE_NAME;
  });

  // ---- GitHub links ----
  const openGitHub = async (e) => {
    e.preventDefault();
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl('https://github.com/bugragungoz/component-inventory');
    } catch {
      window.open('https://github.com/bugragungoz/component-inventory', '_blank');
    }
  };
  document.getElementById('btn-github-link')?.addEventListener('click', openGitHub);
  document.getElementById('btn-github-sidebar')?.addEventListener('click', openGitHub);

  // ---- Check for updates ----
  document.getElementById('btn-check-update')?.addEventListener('click', checkForUpdates);
}

function openSettingsModal() {
  populateSettings();
  const overlay = document.getElementById('overlay-settings');
  if (overlay) overlay.style.display = '';
}

// ============================================================
// In-app update checker (GitHub Releases API)
// ============================================================
const CURRENT_VERSION_FALLBACK = '0.3.0';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/bugragungoz/component-inventory/releases/latest';

async function getCurrentVersion() {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch {
    return CURRENT_VERSION_FALLBACK;
  }
}

async function syncSettingsVersionLabel() {
  const el = document.getElementById('settings-about-version');
  if (!el) return;
  const currentVersion = await getCurrentVersion();
  el.textContent = `v${currentVersion}`;
}

function renderUpdateStatus(el, mode, payload = {}) {
  if (!el) return;
  el.style.display = '';

  if (mode === 'available') {
    const latestTag = payload.latestTag || '-';
    const currentVersion = payload.currentVersion || '-';
    const downloadLabel = t('update.download');
    el.style.background = 'var(--accent-dim)';
    el.style.color = 'var(--accent)';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span>${t('update.available', { latest: latestTag, current: currentVersion })}</span>
        <a href="#" id="${payload.buttonId || 'btn-download-update'}" class="btn btn-add" style="font-size:0.74rem;padding:4px 12px;white-space:nowrap">${escHtml(downloadLabel)}</a>
      </div>
      ${payload.body ? `<div style="margin-top:6px;font-size:0.72rem;color:var(--text-muted);max-height:60px;overflow-y:auto;white-space:pre-wrap">${escHtml((payload.body || '').slice(0, 300))}</div>` : ''}
    `;
    return;
  }

  if (mode === 'latest') {
    el.style.background = 'var(--bg-hover)';
    el.style.color = 'var(--text-secondary)';
    el.innerHTML = t('update.latest', { current: payload.currentVersion || '-' });
    return;
  }

  if (mode === 'error') {
    el.style.background = 'var(--bg-hover)';
    el.style.color = 'var(--text-muted)';
    el.innerHTML = t('update.failed', { err: payload.error || '' });
  }
}

async function checkForUpdates() {
  const btn = document.getElementById('btn-check-update');
  const statusEl = document.getElementById('update-status');
  if (!btn || !statusEl) return;

  btn.disabled = true;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
    ${escHtml(t('update.checking'))}`;

  const currentVersion = await getCurrentVersion();

  try {
    const res = await fetch(GITHUB_RELEASES_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const data = await res.json();

    const latestTag = (data.tag_name || '').replace(/^v/, '');
    const isNewer = compareVersions(latestTag, currentVersion) > 0;

    statusEl.style.display = '';
    if (isNewer) {
      // Find download assets
      const assets = (data.assets || []);
      const exeAsset = assets.find(a => a.name.endsWith('.exe'));
      const msiAsset = assets.find(a => a.name.endsWith('.msi'));
      const downloadUrl = exeAsset?.browser_download_url || msiAsset?.browser_download_url || data.html_url;

      renderUpdateStatus(statusEl, 'available', {
        latestTag,
        currentVersion,
        body: data.body || '',
        buttonId: 'btn-download-update',
      });

      document.getElementById('btn-download-update')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const { openUrl } = await import('@tauri-apps/plugin-opener');
          await openUrl(downloadUrl);
        } catch {
          window.open(downloadUrl, '_blank');
        }
      });
    } else {
      renderUpdateStatus(statusEl, 'latest', { currentVersion });
    }
  } catch (err) {
    renderUpdateStatus(statusEl, 'error', { error: escHtml(err.message || String(err)) });
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      ${escHtml(t('settings.updates.check'))}`;
  }
}

/** Compare two semver strings. Returns >0 if a > b, <0 if a < b, 0 if equal. */
function compareVersions(a, b) {
  const pa = (a || '0').split('.').map(Number);
  const pb = (b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/** Silent update check on app launch — shows a toast if a newer version exists. */
async function autoCheckForUpdates() {
  try {
    const currentVersion = await getCurrentVersion();
    const res = await fetch(GITHUB_RELEASES_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const latestTag = (data.tag_name || '').replace(/^v/, '');
    if (compareVersions(latestTag, currentVersion) > 0) {
      const assets = (data.assets || []);
      const exeAsset = assets.find(a => a.name.endsWith('.exe'));
      const msiAsset = assets.find(a => a.name.endsWith('.msi'));
      const downloadUrl = exeAsset?.browser_download_url
        || msiAsset?.browser_download_url
        || data.html_url;
      showToast(
        t('update.toast', { latest: latestTag, current: currentVersion }),
        'info',
        10000,
        {
          actionLabel: t('update.download'),
          onAction: async () => {
            try {
              const { openUrl } = await import('@tauri-apps/plugin-opener');
              await openUrl(downloadUrl);
            } catch {
              window.open(downloadUrl, '_blank');
            }
          },
          onClick: () => openSettingsModal(),
        },
      );
      openSettingsModal();
      // Also populate the settings update-status area so the user can act
      const statusEl = document.getElementById('update-status');
      if (statusEl) {
        renderUpdateStatus(statusEl, 'available', {
          latestTag,
          currentVersion,
          buttonId: 'btn-download-update-auto',
        });
        document.getElementById('btn-download-update-auto')?.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(downloadUrl);
          } catch {
            window.open(downloadUrl, '_blank');
          }
        });
      }
    }
  } catch (e) {
    // Silent — do not disturb the user on network errors
    console.debug('Auto update check failed:', e);
  }
}

function populateSettings() {
  const lang = document.getElementById('s-language');
  if (lang) lang.value = getLocale();

  const fm = document.getElementById('s-form-mode');
  if (fm) fm.value = localStorage.getItem('formMode') || 'detailed';

  const locCb = document.getElementById('s-locations-enabled');
  if (locCb) locCb.checked = localStorage.getItem('locationsEnabled') === 'true';

  const ls = document.getElementById('s-low-stock');
  if (ls) ls.value = localStorage.getItem('lowStockThreshold') || '1';

  const dq = document.getElementById('s-default-qty');
  if (dq) dq.value = localStorage.getItem('defaultQty') || '1';

  const br = document.getElementById('s-backup-retention');
  if (br) br.value = localStorage.getItem(STORAGE_KEYS.BACKUP_RETENTION) || String(DEFAULTS.BACKUP_RETENTION);
  const bi = document.getElementById('s-backup-interval');
  if (bi) bi.value = String(getConfiguredBackupIntervalMinutes());

  const ef = document.getElementById('s-export-folder');
  if (ef) ef.value = localStorage.getItem('exportFolder') || '';

  const drvOn = document.getElementById('s-drive-enabled');
  if (drvOn) drvOn.checked = localStorage.getItem('driveSyncEnabled') === 'true';
  const drv = document.getElementById('s-drive-folder');
  if (drv) drv.value = localStorage.getItem('driveSyncFolder') || '';
  const drvBase = document.getElementById('s-drive-basename');
  if (drvBase) drvBase.value = localStorage.getItem('driveSyncBaseName') || DRIVE_DEFAULT_BASE_NAME;

  // DB path (async)
  try {
    import('@tauri-apps/api/path').then(({ appDataDir }) => appDataDir()).then(dir => {
      const el = document.getElementById('s-db-path');
      if (el) el.textContent = dir + 'component_inventory.db';
    }).catch(() => {});
  } catch (_) {}

  syncSettingsVersionLabel().catch(() => {});
}

/** Apply simple/detailed form mode to <body>. */
export function applyFormMode() {
  const mode = localStorage.getItem('formMode') || 'detailed';
  document.body.classList.toggle('simple-form', mode === 'simple');
}

function applyTheme(theme) {
  const html = document.documentElement;
  const body = document.body;
  const sun  = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');

  if (theme === 'light') {
    html.classList.remove('dark');
    html.classList.add('light');
    body.classList.remove('dark');
    body.classList.add('light');
    sun.style.display  = 'none';
    moon.style.display = '';
  } else {
    html.classList.remove('light');
    html.classList.add('dark');
    body.classList.remove('light');
    body.classList.add('dark');
    sun.style.display  = '';
    moon.style.display = 'none';
  }
  localStorage.setItem('theme', theme);
}

// ============================================================
// Drive sync sidebar pill
// Shows live state (off/syncing/ok/error). Click opens settings or
// retries the last failed sync depending on state.
// ============================================================
function initDriveStatusPill() {
  const btn   = document.getElementById('drive-status-btn');
  const label = document.getElementById('drive-status-text');
  if (!btn || !label) return;

  function paint(status) {
    btn.dataset.state = status.state;
    btn.classList.remove(
      'drive-state-off', 'drive-state-ok', 'drive-state-syncing', 'drive-state-error'
    );
    btn.classList.add('drive-state-' + status.state);
    label.textContent = t('drive.status.' + status.state);
    let title;
    if      (status.state === 'off')     title = t('drive.tooltip.off');
    else if (status.state === 'syncing') title = t('drive.tooltip.syncing');
    else if (status.state === 'error')   title = t('drive.tooltip.error', { err: status.error || '' });
    else                                 title = t('drive.tooltip.ok',    { folder: status.folder || '' });
    btn.setAttribute('title', title);
  }

  paint(getDriveStatus());
  onDriveStatusChange(paint);
  document.addEventListener('locale-changed', () => paint(getDriveStatus()));

  btn.addEventListener('click', async () => {
    const status = getDriveStatus();
    if (status.state === 'off') {
      openSettingsModal();
      return;
    }
    // Manual sync trigger - shows toast confirmation on success
    await triggerDriveSyncManual();
  });
}

// ============================================================
// View mode (compact only - detailed toggle was removed for clarity)
// The body always renders in compact mode; layout is consistent
// across sessions with no extra UI to manage.
// ============================================================
function initViewToggle() {
  state.viewCompact = true;
  document.body.classList.add('compact-view');
}

// ============================================================
// Search
// ============================================================
function initSearch() {
  let debounceTimer;
  const input = document.getElementById('search-input');
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = input.value.trim().toLowerCase();
      applyFilters();
      renderTable();
    }, 200);
  });

  document.getElementById('sidebar-search').addEventListener('input', () => {
    updateCategoryTree();
  });

  // Re-apply translations after locale change (also re-renders dynamic strings)
  document.addEventListener('locale-changed', () => {
    applyFilters();
    renderTable();
    updateCategoryTree();
    updateLocationTree();
  });
}

// ============================================================
// Toast
// ============================================================
// Parses numbers in both English (1,234.56) and Turkish/European (1.234,56 or 3,90) formats.
export function parseLocaleNumber(str) {
  if (str === undefined || str === null || str === '') return null;
  const s = String(str).trim().replace(/\s/g, '');
  if (s === '' || s === '-') return null;
  const hasDot   = s.includes('.');
  const hasComma = s.includes(',');
  let normalized = s;
  if (hasDot && hasComma) {
    // Determine decimal separator by which appears last
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Turkish/European: "1.234,56" → 1234.56
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      // English: "1,234.56" → 1234.56
      normalized = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(',');
    // If only two parts and last part has 1-3 digits, treat comma as decimal
    if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 3) {
      normalized = s.replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

export function showToast(message, type = 'info', duration = 3000, opts = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  const actionLabel = opts.actionLabel ? String(opts.actionLabel).trim() : '';
  let removed = false;
  const removeToast = () => {
    if (removed) return;
    removed = true;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  };

  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-add btn-sm';
    btn.style.marginLeft = '10px';
    btn.textContent = actionLabel;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (typeof opts.onAction === 'function') {
        try { await opts.onAction(); } catch (err) { console.warn('toast action failed:', err); }
      }
      removeToast();
    });
    toast.appendChild(btn);
  }

  if (typeof opts.onClick === 'function') {
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
      try { opts.onClick(); } catch (err) { console.warn('toast click failed:', err); }
      removeToast();
    });
  }

  container.appendChild(toast);
  setTimeout(() => {
    removeToast();
  }, duration);
}

async function recordStockMovement(componentId, partCode, delta, quantityAfter, reason = '') {
  try {
    const d = Number(delta);
    const q = Number(quantityAfter);
    if (!componentId || !partCode || isNaN(d) || isNaN(q) || d === 0) return;
    await state.db.execute(
      `INSERT INTO stock_movements (component_id, part_code, delta, quantity_after, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [componentId, partCode, d, q, reason || '']
    );
  } catch (_) {
    // Non-critical insert
  }
}

export async function listStockMovementsFor(componentId, limit = 20) {
  if (!componentId) return [];
  return state.db.select(
    `SELECT id, component_id, part_code, delta, quantity_after, reason, created_at
       FROM stock_movements
      WHERE component_id = ?
      ORDER BY id DESC
      LIMIT ?`,
    [componentId, limit]
  );
}

// ============================================================
// Modal close helpers
// ============================================================
window.closeModal = function(overlay) {
  if (!overlay) return;
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.remove('closing');
    overlay.style.display = 'none';
  }, 140);
};

function initModalCloseHandlers() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlayId = btn.dataset.close;
      window.closeModal(document.getElementById(overlayId));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) window.closeModal(overlay);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(o => {
        if (o.style.display !== 'none') {
          window.closeModal(o);
        }
      });
    }
  });
}

// ============================================================
// Utility
// ============================================================
export function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getAutocompleteValues(field) {
  return [...new Set(state.components.map(c => c[field]).filter(Boolean))].sort();
}

function populateDatalist(id, values) {
  const dl = document.getElementById(id);
  if (!dl) return;
  dl.innerHTML = values.map(v => `<option value="${escHtml(v)}">`).join('');
}

export function refreshDatalistsGlobal() {
  populateDatalist('list-category',     getAutocompleteValues('category'));
  populateDatalist('list-subcategory',  getAutocompleteValues('subcategory'));
  populateDatalist('list-package',      getAutocompleteValues('package'));
  populateDatalist('list-manufacturer', getAutocompleteValues('manufacturer'));
  populateDatalist('list-location',     getAutocompleteValues('location'));
}

async function runImportPlaceholderRepair() {
  try {
    const { deleted, fixed } = await repairPlaceholderComponents({
      components: state.components,
      updateComponent,
      deleteComponent,
      useOzdisan: false,
    });
    if (deleted > 0 || fixed > 0) {
      await loadComponents();
      showToast(t('toast.importRepair', { deleted, fixed }), 'success', 6000);
    }
  } catch (err) {
    console.warn('import placeholder repair:', err);
  }
}

// ============================================================
// Bootstrap
// ============================================================
async function main() {
  const bootLoader = document.getElementById('boot-loader');

  try {
    // i18n must run BEFORE building any dynamic UI so all data-i18n nodes get populated
    initI18n();
    initTheme();
    applyFormMode();
    initSettings();
    applyLocationsVisibility();
    initModalCloseHandlers();
    await initDB();
    await loadComponents();
    await runImportPlaceholderRepair();
    initModals();
    initLabels();
    initSearch();
    initViewToggle();
    initImport();
    initExport();
    initBackupUI();
    initBulkCategorize();
    initRenameModal();
    initSelectionBarOnce();
    initBackupDiff();
    initDriveSync();
    initDriveStatusPill();
    initSidebarFuzzySearch();
    initProjects();
    syncSettingsVersionLabel().catch(() => {});
    applyBackupIntervalSetting().catch(() => {});

    // Re-apply translations after dynamic content (datalists already rebuilt by loadComponents)
    applyTranslations();

    if (bootLoader) {
      bootLoader.classList.add('hidden');
      setTimeout(() => { bootLoader.style.display = 'none'; }, 350);
    }

    // Silent auto-check for updates (non-blocking)
    autoCheckForUpdates();
  } catch (err) {
    console.error('Init error:', err);
    if (bootLoader) {
      bootLoader.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style="color:#c0392b;font-weight:600">${t('boot.error')}</span>
        <span style="max-width:360px;text-align:center;color:#b0aea5;font-size:12px">${escHtml(err.message || String(err))}</span>
        <button onclick="location.reload()" style="margin-top:8px;padding:8px 16px;background:#d97757;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:Arial;font-size:13px">${t('boot.retry')}</button>
      `;
    }
  }
}

main();
