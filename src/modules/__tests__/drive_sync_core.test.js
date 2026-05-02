import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BASE_NAME,
  sanitizeBaseName,
  resolveBaseName,
  getDriveStatusSnapshot,
  formatCellValue,
} from '../drive_sync_core.js';

describe('drive_sync_core', () => {
  it('sanitizes invalid filename characters', () => {
    expect(sanitizeBaseName('my:bad/name*test')).toBe('my_bad_name_test');
  });

  it('resolves default basename when empty', () => {
    expect(resolveBaseName('')).toBe(DEFAULT_BASE_NAME);
  });

  it('builds status snapshots', () => {
    expect(getDriveStatusSnapshot({ enabled: false, folder: '', writeInFlight: false, lastError: null }).state).toBe('off');
    expect(getDriveStatusSnapshot({ enabled: true, folder: 'C:/x', writeInFlight: true, lastError: null }).state).toBe('syncing');
    expect(getDriveStatusSnapshot({ enabled: true, folder: 'C:/x', writeInFlight: false, lastError: 'fail' }).state).toBe('error');
  });

  it('formats quantity as number', () => {
    expect(formatCellValue('quantity', '3')).toBe(3);
  });
});
