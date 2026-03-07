import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { renderTable, applyFilters } from './modules/table.js';
import { initModals } from './modules/modals.js';
import { initImport } from './modules/import.js';
import { initExport } from './modules/export.js';
import { initAI, pollOllamaStatus } from './modules/ai.js';
import { initBackupUI } from './modules/backup.js';

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
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      role       TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
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
}

export async function addComponent(data) {
  const { part_code, category, subcategory, quantity, package: pkg,
    manufacturer, mpn, location, voltage_max, current_max,
    description, datasheet_url, unit_price, notes } = data;

  await state.db.execute(
    `INSERT INTO components
      (part_code, category, subcategory, quantity, package, manufacturer, mpn, location,
       voltage_max, current_max, description, datasheet_url, unit_price, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [part_code, category || '', subcategory || '', quantity || 0, pkg || '',
     manufacturer || '', mpn || '', location || '',
     voltage_max || null, current_max || null,
     description || '', datasheet_url || '', unit_price || null, notes || '']
  );
  await triggerBackup();
  await loadComponents();
}

export async function updateComponent(id, data) {
  const { part_code, category, subcategory, quantity, package: pkg,
    manufacturer, mpn, location, voltage_max, current_max,
    description, datasheet_url, unit_price, notes } = data;

  await state.db.execute(
    `UPDATE components SET
      part_code=?, category=?, subcategory=?, quantity=?, package=?,
      manufacturer=?, mpn=?, location=?, voltage_max=?, current_max=?,
      description=?, datasheet_url=?, unit_price=?, notes=?,
      updated_at=datetime('now')
     WHERE id=?`,
    [part_code, category || '', subcategory || '', quantity || 0, pkg || '',
     manufacturer || '', mpn || '', location || '',
     voltage_max || null, current_max || null,
     description || '', datasheet_url || '', unit_price || null, notes || '',
     id]
  );
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

    await state.db.execute(
      `INSERT INTO components
        (part_code, category, subcategory, quantity, package, manufacturer, mpn, location,
         voltage_max, current_max, description, datasheet_url, unit_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(part_code) DO UPDATE SET
         category=excluded.category,
         subcategory=excluded.subcategory,
         quantity=excluded.quantity,
         package=excluded.package,
         manufacturer=excluded.manufacturer,
         mpn=excluded.mpn,
         location=excluded.location,
         voltage_max=excluded.voltage_max,
         current_max=excluded.current_max,
         description=excluded.description,
         datasheet_url=excluded.datasheet_url,
         unit_price=excluded.unit_price,
         notes=excluded.notes,
         updated_at=datetime('now')`,
      [part_code, category || '', subcategory || '', Number(quantity) || 0, pkg || '',
       manufacturer || '', mpn || '', location || '',
       voltage_max ? Number(voltage_max) : null,
       current_max ? Number(current_max) : null,
       description || '', datasheet_url || '',
       unit_price ? Number(unit_price) : null, notes || '']
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
      <div class="tree-cat${isActiveCat ? ' active' : ''}" data-cat="${cat}" data-sub="">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        ${escHtml(cat)}
        <span class="tree-count">${catTotal}</span>
      </div>`;

    const sortedSubs = Object.keys(map[cat]).sort();
    for (const sub of sortedSubs) {
      if (!sub) continue;
      const isActiveSub = state.filterCat === cat && state.filterSub === sub;
      html += `<div class="tree-sub${isActiveSub ? ' active' : ''}" data-cat="${cat}" data-sub="${sub}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/></svg>
        ${escHtml(sub)}
        <span class="tree-count">${map[cat][sub]}</span>
      </div>`;
    }

    html += '</div>';
  }

  tree.innerHTML = html;

  tree.querySelectorAll('[data-cat]').forEach(el => {
    el.addEventListener('click', () => {
      state.filterCat = el.dataset.cat;
      state.filterSub = el.dataset.sub;
      applyFilters();
      renderTable();
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
      lblEl.textContent     = 'Detailed';
      iconComp.style.display = 'none';
      iconFull.style.display = '';
    } else {
      document.body.classList.remove('compact-view');
      lblEl.textContent     = 'Compact';
      iconComp.style.display = '';
      iconFull.style.display = 'none';
    }
  }

  applyView();

  btn.addEventListener('click', () => {
    state.viewCompact = !state.viewCompact;
    localStorage.setItem('viewCompact', state.viewCompact ? '1' : '0');
    applyView();
  });

  // Restore saved preference
  const saved = localStorage.getItem('viewCompact');
  if (saved !== null) {
    state.viewCompact = saved === '1';
    applyView();
  }
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

export function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit'
  });
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
    initSearch();
    initViewToggle();
    initImport();
    initExport();
    initAI();
    initBackupUI();
    pollOllamaStatus();

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
        <span style="max-width:360px;text-align:center;color:#b0aea5;font-size:12px">${err.message || String(err)}</span>
        <button onclick="location.reload()" style="margin-top:8px;padding:8px 16px;background:#d97757;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:Arial;font-size:13px">Retry</button>
      `;
    }
  }
}

main();
