export const DEFAULT_BASE_NAME = 'croxz';

export function sanitizeBaseName(name) {
  return String(name || '')
    .replace(/[\\\/:*?"<>|\s]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 64);
}

export function resolveBaseName(rawName) {
  return sanitizeBaseName(rawName) || DEFAULT_BASE_NAME;
}

export function getDriveStatusSnapshot({ enabled, folder, writeInFlight, lastError }) {
  if (!enabled || !folder) return { state: 'off', folder: '' };
  if (lastError) return { state: 'error', folder, error: lastError };
  if (writeInFlight) return { state: 'syncing', folder };
  return { state: 'ok', folder };
}

export function formatCellValue(key, value) {
  if (value == null) return '';
  if (key === 'unit_price' && typeof value === 'number') return value;
  if (key === 'voltage_max' || key === 'current_max' || key === 'power_rating') {
    return typeof value === 'number' ? value : (value === '' ? '' : value);
  }
  if (key === 'quantity') return Number(value) || 0;
  return value;
}
