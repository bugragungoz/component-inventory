// ============================================================
// Cloud sync (Drive for Desktop / Dropbox / OneDrive compatible).
// Strategy: after every save, write inventory.xlsx + inventory.json
// snapshots into the user-chosen synced folder. Mobile clients can
// then open the .xlsx directly via Google Sheets, Excel for iOS, etc.
// No OAuth, no API keys - purely filesystem based.
//
// Writes go through Rust (`write_external_file`) so they bypass the
// JS-side fs plugin scope and work for any user-chosen folder.
// ============================================================
import { invoke } from '@tauri-apps/api/core';
import { state, showToast } from '../app.js';
import { t } from './i18n.js';

const SNAPSHOT_NAME_XLSX = 'component_inventory.xlsx';
const SNAPSHOT_NAME_JSON = 'component_inventory.json';
const SNAPSHOT_NAME_DB   = 'component_inventory.db';

const COLUMNS = [
  { key: 'part_code',    label: 'Part Code' },
  { key: 'category',     label: 'Category' },
  { key: 'subcategory',  label: 'Subcategory' },
  { key: 'quantity',     label: 'Quantity' },
  { key: 'package',      label: 'Package' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'mpn',          label: 'MPN' },
  { key: 'location',     label: 'Location' },
  { key: 'voltage_max',  label: 'Voltage Max (V)' },
  { key: 'current_max',  label: 'Current Max (A)' },
  { key: 'resistance',   label: 'Resistance' },
  { key: 'tolerance',    label: 'Tolerance' },
  { key: 'power_rating', label: 'Power Rating (W)' },
  { key: 'description',  label: 'Description' },
  { key: 'datasheet_url',label: 'Datasheet URL' },
  { key: 'unit_price',   label: 'Unit Price' },
  { key: 'notes',        label: 'Notes' },
  { key: 'updated_at',   label: 'Updated At' },
];

let _writeInFlight = false;
let _pendingWrite  = false;
let _lastError     = null;
let _statusListeners = new Set();

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

async function writeSnapshot() {
  const folder  = localStorage.getItem('driveSyncFolder');
  const enabled = localStorage.getItem('driveSyncEnabled') === 'true';
  if (!enabled || !folder) return;

  const rows = state.components.map(row => {
    const obj = {};
    for (const col of COLUMNS) {
      obj[col.label] = row[col.key] ?? '';
    }
    return obj;
  });

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    ws['!cols'] = COLUMNS.map(col => ({ wch: Math.max(col.label.length + 2, 14) }));
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    await writeExternal(folder, SNAPSHOT_NAME_XLSX, new Uint8Array(buf));
  }

  const jsonRows = state.components.map(row => {
    const obj = {};
    for (const col of COLUMNS) {
      obj[col.key] = row[col.key] ?? null;
    }
    return obj;
  });
  const jsonBytes = new TextEncoder().encode(JSON.stringify(jsonRows, null, 2));
  await writeExternal(folder, SNAPSHOT_NAME_JSON, jsonBytes);

  // Also keep a copy of the raw .db beside the snapshots so Sheets users
  // who want forensic access (or restoring) get it for free.
  try {
    await invoke('copy_db_to_external', { folder, name: SNAPSHOT_NAME_DB });
  } catch (err) {
    // Non-fatal - XLSX/JSON are the primary payload.
    console.warn('drive sync .db copy skipped:', err);
  }
}

/**
 * Trigger a snapshot write, coalescing rapid back-to-back calls.
 * Errors are surfaced via toast but never thrown.
 */
export async function triggerDriveSync() {
  const enabled = localStorage.getItem('driveSyncEnabled') === 'true';
  const folder  = localStorage.getItem('driveSyncFolder');
  if (!enabled || !folder) { _lastError = null; emitStatus(); return; }

  if (_writeInFlight) {
    _pendingWrite = true;
    return;
  }
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

export function initDriveSync() {
  setTimeout(() => triggerDriveSync(), 1500);
}
