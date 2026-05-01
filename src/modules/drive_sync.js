// ============================================================
// Cloud sync (Google Drive for Desktop).
// Strategy: after every save, write <baseName>.xlsx + <baseName>.json
// + <baseName>.db snapshots into the user-chosen Drive-synced folder.
// Mobile clients open the .xlsx via Google Sheets.
//
// Writes go through Rust (`write_external_file`) so they bypass the
// JS-side fs plugin scope and work for any user-chosen folder.
//
// XLSX layout:
//   - Sheet "Summary": all components, sortable
//   - One sheet per main category, columns tailored to that category
//   - Header row frozen + auto-filter + auto-sized columns
// ============================================================
import { invoke } from '@tauri-apps/api/core';
import { state, showToast } from '../app.js';
import { t } from './i18n.js';

const DEFAULT_BASE_NAME = 'croxz';

// Columns for the Summary sheet (label + accessor key)
const COLUMNS_FULL = [
  { key: 'part_code',    label: 'Part Code' },
  { key: 'category',     label: 'Category' },
  { key: 'subcategory',  label: 'Subcategory' },
  { key: 'quantity',     label: 'Quantity' },
  { key: 'package',      label: 'Package' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'mpn',          label: 'MPN' },
  { key: 'location',     label: 'Location' },
  { key: 'voltage_max',  label: 'V Max' },
  { key: 'current_max',  label: 'I Max' },
  { key: 'resistance',   label: 'Resistance' },
  { key: 'tolerance',    label: 'Tolerance' },
  { key: 'power_rating', label: 'Power (W)' },
  { key: 'description',  label: 'Description' },
  { key: 'datasheet_url',label: 'Datasheet' },
  { key: 'unit_price',   label: 'Unit Price' },
  { key: 'notes',        label: 'Notes' },
  { key: 'updated_at',   label: 'Updated At' },
];

// Compact per-category column sets (drop irrelevant cols per type)
const COLUMNS_BY_CATEGORY = {
  Resistors:    ['part_code', 'subcategory', 'package', 'resistance', 'tolerance', 'power_rating', 'quantity', 'location', 'manufacturer', 'unit_price', 'datasheet_url'],
  Capacitors:   ['part_code', 'subcategory', 'package', 'voltage_max', 'tolerance', 'quantity', 'location', 'manufacturer', 'unit_price', 'datasheet_url', 'description'],
  Inductors:    ['part_code', 'subcategory', 'package', 'current_max', 'tolerance', 'quantity', 'location', 'manufacturer', 'unit_price', 'datasheet_url', 'description'],
  Transistors:  ['part_code', 'subcategory', 'package', 'voltage_max', 'current_max', 'power_rating', 'quantity', 'location', 'manufacturer', 'mpn', 'unit_price', 'datasheet_url'],
  Diodes:       ['part_code', 'subcategory', 'package', 'voltage_max', 'current_max', 'quantity', 'location', 'manufacturer', 'unit_price', 'datasheet_url', 'description'],
  ICs:          ['part_code', 'subcategory', 'package', 'voltage_max', 'current_max', 'quantity', 'location', 'manufacturer', 'mpn', 'unit_price', 'datasheet_url', 'description'],
  Connectors:   ['part_code', 'subcategory', 'package', 'quantity', 'location', 'manufacturer', 'unit_price', 'description'],
  Sensors:      ['part_code', 'subcategory', 'package', 'voltage_max', 'current_max', 'quantity', 'location', 'manufacturer', 'mpn', 'unit_price', 'datasheet_url', 'description'],
  Crystals:     ['part_code', 'subcategory', 'package', 'tolerance', 'quantity', 'location', 'manufacturer', 'unit_price', 'description'],
};

let _writeInFlight = false;
let _pendingWrite  = false;
let _lastError     = null;
const _statusListeners = new Set();

export function getBaseName() {
  const raw = (localStorage.getItem('driveSyncBaseName') || '').trim();
  return sanitizeBaseName(raw) || DEFAULT_BASE_NAME;
}

function sanitizeBaseName(name) {
  // Strip path separators and anything Windows or POSIX would refuse.
  return String(name || '').replace(/[\\\/:*?"<>|\s]+/g, '_').replace(/^\.+/, '').slice(0, 64);
}

export function getDriveStatus() {
  const enabled = localStorage.getItem('driveSyncEnabled') === 'true';
  const folder  = localStorage.getItem('driveSyncFolder') || '';
  if (!enabled || !folder) return { state: 'off',     folder: '' };
  if (_lastError)           return { state: 'error',  folder, error: _lastError };
  if (_writeInFlight)       return { state: 'syncing',folder };
  return                          { state: 'ok',     folder };
}

export function onDriveStatusChange(fn) {
  _statusListeners.add(fn);
  return () => _statusListeners.delete(fn);
}

function emitStatus() {
  const status = getDriveStatus();
  for (const fn of _statusListeners) {
    try { fn(status); } catch (_) {}
  }
}

async function writeExternal(folder, name, bytes) {
  return await invoke('write_external_file', { folder, name, contents: Array.from(bytes) });
}

function formatCell(key, value) {
  if (value == null) return '';
  if (key === 'unit_price' && typeof value === 'number') return value;
  if (key === 'voltage_max' || key === 'current_max' || key === 'power_rating') {
    return typeof value === 'number' ? value : (value === '' ? '' : value);
  }
  if (key === 'quantity') return Number(value) || 0;
  return value;
}

function buildSheet(rows, columnKeys, sheetTitle) {
  const header = columnKeys.map(k => COLUMNS_FULL.find(c => c.key === k)?.label || k);
  const dataRows = rows.map(r => columnKeys.map(k => formatCell(k, r[k])));

  const aoa = [header, ...dataRows];
  const ws  = XLSX.utils.aoa_to_sheet(aoa);

  // Freeze header + autofilter
  ws['!freeze']     = { xSplit: 0, ySplit: 1 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: header.length - 1 } }) };

  // Column widths: use longest content (capped) per column
  ws['!cols'] = columnKeys.map((k, i) => {
    const max = aoa.reduce((m, row) => Math.max(m, String(row[i] ?? '').length), 8);
    return { wch: Math.min(Math.max(max + 2, 10), 40) };
  });

  // Bold + filled header row
  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'D97757' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  return { ws, name: sheetTitle };
}

async function writeSnapshot() {
  const folder  = localStorage.getItem('driveSyncFolder');
  const enabled = localStorage.getItem('driveSyncEnabled') === 'true';
  if (!enabled || !folder) return;

  const baseName = getBaseName();
  const allRows  = state.components || [];

  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();

    // 1. Summary sheet (all components, full columns)
    const summary = buildSheet(allRows, COLUMNS_FULL.map(c => c.key), 'Summary');
    XLSX.utils.book_append_sheet(wb, summary.ws, summary.name);

    // 2. Per-category sheets
    const grouped = {};
    for (const r of allRows) {
      const cat = (r.category || 'Uncategorized').trim() || 'Uncategorized';
      (grouped[cat] = grouped[cat] || []).push(r);
    }
    const sortedCats = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'tr-TR'));
    for (const cat of sortedCats) {
      const cols = COLUMNS_BY_CATEGORY[cat] || COLUMNS_FULL.map(c => c.key);
      const safeName = String(cat).replace(/[\\/?*\[\]:]/g, '_').slice(0, 31) || 'Uncategorized';
      const built = buildSheet(grouped[cat], cols, safeName);
      XLSX.utils.book_append_sheet(wb, built.ws, built.name);
    }

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
    await writeExternal(folder, baseName + '.xlsx', new Uint8Array(buf));
  }

  // JSON snapshot (lightweight, full schema)
  const jsonRows = allRows.map(row => {
    const obj = {};
    for (const col of COLUMNS_FULL) obj[col.key] = row[col.key] ?? null;
    return obj;
  });
  const jsonBytes = new TextEncoder().encode(JSON.stringify(jsonRows, null, 2));
  await writeExternal(folder, baseName + '.json', jsonBytes);

  // Raw .db copy for forensic / restore use cases
  try {
    await invoke('copy_db_to_external', { folder, name: baseName + '.db' });
  } catch (err) {
    console.warn('drive sync .db copy skipped:', err);
  }
}

export async function triggerDriveSync() {
  const enabled = localStorage.getItem('driveSyncEnabled') === 'true';
  const folder  = localStorage.getItem('driveSyncFolder');
  if (!enabled || !folder) { _lastError = null; emitStatus(); return; }

  if (_writeInFlight) { _pendingWrite = true; return; }
  _writeInFlight = true;
  emitStatus();
  try {
    await writeSnapshot();
    _lastError = null;
  } catch (err) {
    _lastError = err.message || String(err);
    console.error('drive sync error:', err);
    showToast(t('toast.driveFailed') + _lastError, 'error');
  } finally {
    _writeInFlight = false;
    emitStatus();
    if (_pendingWrite) {
      _pendingWrite = false;
      setTimeout(() => triggerDriveSync(), 100);
    }
  }
}

/**
 * Manual trigger that surfaces a confirmation toast on success.
 * Wired to the sidebar Drive pill click handler when sync is enabled.
 */
export async function triggerDriveSyncManual() {
  const status = getDriveStatus();
  if (status.state === 'off') return false;
  await triggerDriveSync();
  if (!_lastError) {
    showToast(t('toast.driveSynced'), 'success');
    return true;
  }
  return false;
}

export function initDriveSync() {
  setTimeout(() => triggerDriveSync(), 1500);
}

export const DRIVE_DEFAULT_BASE_NAME = DEFAULT_BASE_NAME;
