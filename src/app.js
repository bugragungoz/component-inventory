import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { renderTable, applyFilters } from './modules/table.js';
import { initModals } from './modules/modals.js';
import { initImport } from './modules/import.js';
import { initExport } from './modules/export.js';
import { initBackupUI } from './modules/backup.js';
import { initLabels }            from './modules/labels.js';
import { initBulkCategorize }    from './modules/bulk_categorize.js';

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

  // Migrations — each wrapped in try/catch so they are idempotent
  const migrations = [
    `ALTER TABLE components ADD COLUMN image_path   TEXT DEFAULT ''`,
    `ALTER TABLE components ADD COLUMN resistance   TEXT DEFAULT ''`,
    `ALTER TABLE components ADD COLUMN tolerance    TEXT DEFAULT ''`,
    `ALTER TABLE components ADD COLUMN power_rating REAL`,
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
    manufacturer, mpn, location, voltage_max, current_max,
    description, datasheet_url, unit_price, notes, image_path,
    resistance, tolerance, power_rating } = data;

  await state.db.execute(
    `INSERT INTO components
      (part_code, category, subcategory, quantity, package, manufacturer, mpn, location,
       voltage_max, current_max, description, datasheet_url, unit_price, notes, image_path,
       resistance, tolerance, power_rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [part_code, category || '', subcategory || '', quantity || 0, pkg || '',
     manufacturer || '', mpn || '', location || '',
     voltage_max ?? null, current_max ?? null,
     description || '', datasheet_url || '', unit_price ?? null, notes || '',
     image_path || '', resistance || '', tolerance || '', power_rating ?? null]
  );
  await triggerBackup();
  await loadComponents();
}

export async function updateComponent(id, data) {
  const { part_code, category, subcategory, quantity, package: pkg,
    manufacturer, mpn, location, voltage_max, current_max,
    description, datasheet_url, unit_price, notes, image_path,
    resistance, tolerance, power_rating } = data;

  await state.db.execute(
    `UPDATE components SET
      part_code=?, category=?, subcategory=?, quantity=?, package=?,
      manufacturer=?, mpn=?, location=?, voltage_max=?, current_max=?,
      description=?, datasheet_url=?, unit_price=?, notes=?, image_path=?,
      resistance=?, tolerance=?, power_rating=?,
      updated_at=datetime('now')
     WHERE id=?`,
    [part_code, category || '', subcategory || '', quantity || 0, pkg || '',
     manufacturer || '', mpn || '', location || '',
     voltage_max ?? null, current_max ?? null,
     description || '', datasheet_url || '', unit_price ?? null, notes || '',
     image_path || '', resistance || '', tolerance || '', power_rating ?? null, id]
  );
  await triggerBackup();
  await loadComponents();
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
  await triggerBackup();
  await loadComponents();
}

export async function deleteComponent(id) {
  await state.db.execute('DELETE FROM components WHERE id=?', [id]);
  await triggerBackup();
  await loadComponents();
}

export async function upsertComponents(rows, mode = 'merge') {
  if (mode === 'replace') {
    await state.db.execute('DELETE FROM components');
  }

  for (const row of rows) {
    const { part_code, category, subcategory, quantity, package: pkg,
      manufacturer, mpn, location, voltage_max, current_max,
      description, datasheet_url, unit_price, notes } = row;

    if (!part_code) continue;

    // New components without a category land in Uncategorized.
    // In merge mode, never overwrite an existing category/subcategory with an empty value.
    const catVal    = category    || 'Uncategorized';
    const subVal    = subcategory || '';
    const qtyVal    = parseLocaleNumber(quantity)   ?? 0;
    const vMaxVal   = parseLocaleNumber(voltage_max);
    const iMaxVal   = parseLocaleNumber(current_max);
    const priceVal  = parseLocaleNumber(unit_price);

    await state.db.execute(
      `INSERT INTO components
        (part_code, category, subcategory, quantity, package, manufacturer, mpn, location,
         voltage_max, current_max, description, datasheet_url, unit_price, notes, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(part_code) DO UPDATE SET
         category    = CASE WHEN excluded.category    != '' AND excluded.category != 'Uncategorized'
                            THEN excluded.category    ELSE components.category    END,
         subcategory = CASE WHEN excluded.subcategory != ''
                            THEN excluded.subcategory ELSE components.subcategory END,
         quantity    = excluded.quantity,
         package     = CASE WHEN excluded.package  != '' THEN excluded.package  ELSE components.package  END,
         manufacturer= CASE WHEN excluded.manufacturer != '' THEN excluded.manufacturer ELSE components.manufacturer END,
         mpn         = CASE WHEN excluded.mpn  != '' THEN excluded.mpn  ELSE components.mpn  END,
         location    = CASE WHEN excluded.location != '' THEN excluded.location ELSE components.location END,
         voltage_max = CASE WHEN excluded.voltage_max IS NOT NULL THEN excluded.voltage_max ELSE components.voltage_max END,
         current_max = CASE WHEN excluded.current_max IS NOT NULL THEN excluded.current_max ELSE components.current_max END,
         description = CASE WHEN excluded.description != '' THEN excluded.description ELSE components.description END,
         datasheet_url=CASE WHEN excluded.datasheet_url != '' THEN excluded.datasheet_url ELSE components.datasheet_url END,
         unit_price  = CASE WHEN excluded.unit_price IS NOT NULL THEN excluded.unit_price ELSE components.unit_price END,
         notes       = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE components.notes END,
         updated_at  = datetime('now')`,
      [part_code, catVal, subVal, isNaN(qtyVal) ? 0 : qtyVal, pkg || '',
       manufacturer || '', mpn || '', location || '',
       (vMaxVal != null && !isNaN(vMaxVal)) ? vMaxVal : null,
       (iMaxVal != null && !isNaN(iMaxVal)) ? iMaxVal : null,
       description || '', datasheet_url || '',
       (priceVal != null && !isNaN(priceVal)) ? priceVal : null, notes || '', '']
    );
  }
  await triggerBackup();
  await loadComponents();
}

async function triggerBackup() {
  try {
    await invoke('create_backup');
  } catch (_) {
    // Non-critical — backup failure should not block the UI
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

function updateCategoryTree() {
  const tree = document.getElementById('category-tree');
  const catSearch = document.getElementById('sidebar-search').value.toLowerCase();

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
    All Components
    <span class="tree-count">${state.components.length}</span>
  </div>`;

  const sortedCats = Object.keys(map).sort();
  for (const cat of sortedCats) {
    if (catSearch && !cat.toLowerCase().includes(catSearch)) continue;
    const catTotal = Object.values(map[cat]).reduce((a, b) => a + b, 0);
    const isActiveCat = state.filterCat === cat && !state.filterSub;
    html += `<div class="tree-group">
      <div class="tree-cat${isActiveCat ? ' active' : ''}" data-cat="${escHtml(cat)}" data-sub="">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="tree-label">${escHtml(cat)}</span>
        <span class="tree-count">${catTotal}</span>
        <button class="btn-rename-tree" data-rename-cat="${escHtml(cat)}" data-rename-sub="" title="Rename category">${RENAME_SVG}</button>
      </div>`;

    const sortedSubs = Object.keys(map[cat]).sort();
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
    ? `Rename subcategory "${sub}" (in ${cat})`
    : `Rename category "${cat}"`;
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

  if (!newName) { showToast('Name cannot be empty', 'warning'); return; }
  if (newName === (isSub ? oldSub : oldCat)) {
    overlay.style.display = 'none';
    return;
  }

  try {
    await renameCategory(isSub ? oldSub : oldCat, newName, isSub, oldCat);
    overlay.style.display = 'none';
    showToast(`Renamed to "${newName}"`, 'success');
  } catch (err) {
    showToast('Rename failed: ' + (err.message || err), 'error');
  }
}

function initRenameModal() {
  const overlay  = document.getElementById('overlay-rename-cat');
  const btnOk    = document.getElementById('btn-rename-cat-ok');
  const input    = document.getElementById('rename-cat-input');
  if (!overlay) return;

  const closeRename = () => { overlay.style.display = 'none'; };

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

  if (Object.keys(locationMap).length === 0) {
    tree.innerHTML = `<div class="tree-sub" style="cursor:default;opacity:0.5">No locations set</div>`;
    return;
  }

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
// View toggle (compact / detailed)
// ============================================================
function initViewToggle() {
  const btn       = document.getElementById('btn-view-toggle');
  const lblEl     = document.getElementById('view-label');
  const iconComp  = document.getElementById('icon-view-compact');
  const iconFull  = document.getElementById('icon-view-full');

  function applyView() {
    if (state.viewCompact) {
      document.body.classList.add('compact-view');
      lblEl.textContent      = 'Detailed';
      iconComp.style.display = 'none';
      iconFull.style.display = '';
    } else {
      document.body.classList.remove('compact-view');
      lblEl.textContent      = 'Compact';
      iconComp.style.display = '';
      iconFull.style.display = 'none';
    }
  }

  // Restore saved preference BEFORE first render to avoid layout flash
  const saved = localStorage.getItem('viewCompact');
  if (saved !== null) state.viewCompact = saved === '1';

  applyView();

  btn.addEventListener('click', () => {
    state.viewCompact = !state.viewCompact;
    localStorage.setItem('viewCompact', state.viewCompact ? '1' : '0');
    applyView();
  });
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

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// ============================================================
// Modal close helpers
// ============================================================
function initModalCloseHandlers() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlayId = btn.dataset.close;
      document.getElementById(overlayId).style.display = 'none';
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(o => {
        o.style.display = 'none';
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

// ============================================================
// Bootstrap
// ============================================================
async function main() {
  const bootLoader = document.getElementById('boot-loader');

  try {
    initTheme();
    initModalCloseHandlers();
    await initDB();
    await loadComponents();
    initModals();
    initLabels();
    initSearch();
    initViewToggle();
    initImport();
    initExport();
    initBackupUI();
    initBulkCategorize();
    initRenameModal();

    // Hide boot loader
    if (bootLoader) {
      bootLoader.classList.add('hidden');
      setTimeout(() => { bootLoader.style.display = 'none'; }, 350);
    }
  } catch (err) {
    console.error('Init error:', err);
    if (bootLoader) {
      bootLoader.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style="color:#c0392b;font-weight:600">Startup Error</span>
        <span style="max-width:360px;text-align:center;color:#b0aea5;font-size:12px">${escHtml(err.message || String(err))}</span>
        <button onclick="location.reload()" style="margin-top:8px;padding:8px 16px;background:#d97757;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:Arial;font-size:13px">Retry</button>
      `;
    }
  }
}

main();
