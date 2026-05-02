import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  normalizeHeader,
  normalizeRowsCore,
  validateRowsCore,
} from '../import_core.js';

function parseNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

describe('import_core', () => {
  it('detects semicolon delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('maps Turkish header aliases', () => {
    expect(normalizeHeader('Parca Kodu')).toBe('part_code');
    expect(normalizeHeader('Adet')).toBe('quantity');
  });

  it('normalizes rows with mapped headers', () => {
    const rows = normalizeRowsCore([{ 'Parca Kodu': 'LM7805', 'Adet': '3' }]);
    expect(rows[0].part_code).toBe('LM7805');
    expect(rows[0].quantity).toBe('3');
  });

  it('validates invalid numeric and url fields', () => {
    const result = validateRowsCore([
      { part_code: 'A', quantity: '-1', unit_price: '-2', datasheet_url: 'ftp://bad' }
    ], parseNumber);
    expect(result.warnCount).toBeGreaterThan(0);
    expect(result.rows[0]._warnings).toContain('quantity');
    expect(result.rows[0]._warnings).toContain('unit_price');
    expect(result.rows[0]._warnings).toContain('datasheet_url');
  });
});
