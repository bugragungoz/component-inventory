// ============================================================
// Backup diff module
// Compares two SQLite backup files row-by-row on the components table.
// Each backup is loaded as a separate read-only DB connection.
// ============================================================
import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { showToast, escHtml } from '../app.js';
import { t } from './i18n.js';

const FIELDS = [
  'category', 'subcategory', 'quantity', 'package', 'manufacturer', 'mpn',
  'location', 'voltage_max', 'current_max', 'description', 'datasheet_url',
  'unit_price', 'notes', 'resistance', 'tolerance', 'power_rating',
];

let _diffResult = null;
let _activeTab  = 'changed';

async function loadBackups() {
  try {
    return await invoke('list_backups_cmd');
  } catch (err) {
    showToast(t('backup.failed') + (err.message || err), 'error');
    return [];
  }
}

async function readSnapshot(absPath) {
  // tauri-plugin-sql accepts an absolute path with sqlite: prefix.
  // We open read-only by using a fresh connection then closing it.
  const db = await Database.load('sqlite:' + absPath);
  try {
    const rows = await db.select('SELECT * FROM components');
    const map  = new Map();
    for (const row of rows) {
      if (row.part_code) map.set(row.part_code, row);
    }
    return map;
  } finally {
    try { await db.close(); } catch (_) {}
  }
}

function computeDiff(mapA, mapB) {
  const added = [];
  const removed = [];
  const changed = [];

  for (const [pc, b] of mapB.entries()) {
    if (!mapA.has(pc)) {
      added.push(b);
    } else {
      const a = mapA.get(pc);
      const fields = [];
      for (const f of FIELDS) {
        const va = a[f] ?? '';
        const vb = b[f] ?? '';
        if (String(va) !== String(vb)) fields.push({ field: f, before: va, after: vb });
      }
      if (fields.length > 0) changed.push({ part_code: pc, fields });
    }
  }
  for (const [pc, a] of mapA.entries()) {
    if (!mapB.has(pc)) removed.push(a);
  }

  return { added, removed, changed };
}

function renderTabs() {
  if (!_diffResult) return;
  document.getElementById('diff-tab-add').textContent = _diffResult.added.length;
  document.getElementById('diff-tab-rem').textContent = _diffResult.removed.length;
  document.getElementById('diff-tab-chg').textContent = _diffResult.changed.length;

  document.getElementById('diff-count-add').textContent = _diffResult.added.length;
  document.getElementById('diff-count-rem').textContent = _diffResult.removed.length;
  document.getElementById('diff-count-chg').textContent = _diffResult.changed.length;

  document.querySelectorAll('.diff-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.diffTab === _activeTab);
  });
}

function renderTable() {
  const tbl = document.getElementById('diff-table');
  if (!tbl || !_diffResult) return;
  let html = '';

  if (_activeTab === 'changed') {
    html += `<thead><tr>
      <th>${t('diff.col.partCode')}</th>
      <th>${t('diff.col.field')}</th>
      <th>${t('diff.col.before')}</th>
      <th>${t('diff.col.after')}</th>
    </tr></thead><tbody>`;
    for (const item of _diffResult.changed) {
      for (let i = 0; i < item.fields.length; i++) {
        const f = item.fields[i];
        html += `<tr>
          <td class="diff-pc-cell">${i === 0 ? escHtml(item.part_code) : ''}</td>
          <td>${escHtml(f.field)}</td>
          <td class="diff-cell-before">${escHtml(String(f.before))}</td>
          <td class="diff-cell-after">${escHtml(String(f.after))}</td>
        </tr>`;
      }
    }
    html += '</tbody>';
  } else {
    const list = _activeTab === 'added' ? _diffResult.added : _diffResult.removed;
    html += `<thead><tr>
      <th>${t('diff.col.partCode')}</th>
      <th>${t('th.category')}</th>
      <th>${t('th.qty')}</th>
      <th>${t('th.description')}</th>
    </tr></thead><tbody>`;
    for (const r of list) {
      html += `<tr>
        <td class="diff-pc-cell">${escHtml(r.part_code || '')}</td>
        <td>${escHtml(r.category || '')}</td>
        <td>${escHtml(String(r.quantity ?? ''))}</td>
        <td>${escHtml(r.description || '')}</td>
      </tr>`;
    }
    html += '</tbody>';
  }
  tbl.innerHTML = html;
}

async function populatePickers() {
  const sels = [document.getElementById('diff-pick-a'), document.getElementById('diff-pick-b')];
  const backups = await loadBackups();
  const opts = backups.map(b => `<option value="${escHtml(b.path)}">${escHtml(b.filename)} (${escHtml(b.created_at)})</option>`).join('');
  for (const sel of sels) {
    if (!sel) continue;
    sel.innerHTML = opts || '<option value="">-</option>';
  }
  // Default selection: oldest in A, newest in B (list_backups returns newest-first)
  if (sels[0] && backups.length > 0) sels[0].value = backups[backups.length - 1].path;
  if (sels[1] && backups.length > 0) sels[1].value = backups[0].path;
}

async function runDiff() {
  const a = document.getElementById('diff-pick-a').value;
  const b = document.getElementById('diff-pick-b').value;
  if (!a || !b) { showToast(t('diff.empty'), 'warning'); return; }
  if (a === b) {
    document.getElementById('diff-result').style.display = 'none';
    document.getElementById('diff-summary').style.display = 'none';
    const empty = document.getElementById('diff-empty-hint');
    empty.style.display = '';
    empty.textContent = t('diff.same');
    return;
  }

  try {
    const [mapA, mapB] = await Promise.all([readSnapshot(a), readSnapshot(b)]);
    _diffResult = computeDiff(mapA, mapB);
    document.getElementById('diff-empty-hint').style.display = 'none';
    document.getElementById('diff-summary').style.display = '';
    document.getElementById('diff-result').style.display = '';
    _activeTab = 'changed';
    renderTabs();
    renderTable();
  } catch (err) {
    showToast(t('backup.failed') + (err.message || err), 'error');
  }
}

export function initBackupDiff() {
  const btnOpen = document.getElementById('btn-open-backup-diff');
  if (!btnOpen) return;

  btnOpen.addEventListener('click', async () => {
    document.getElementById('overlay-backup-diff').style.display = '';
    await populatePickers();
    document.getElementById('diff-empty-hint').style.display = '';
    document.getElementById('diff-empty-hint').textContent = t('diff.empty');
    document.getElementById('diff-summary').style.display = 'none';
    document.getElementById('diff-result').style.display = 'none';
    _diffResult = null;
  });

  document.getElementById('btn-run-diff')?.addEventListener('click', runDiff);

  document.querySelectorAll('.diff-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _activeTab = tab.dataset.diffTab;
      renderTabs();
      renderTable();
    });
  });
}
