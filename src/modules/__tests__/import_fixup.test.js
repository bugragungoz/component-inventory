import { describe, it, expect } from 'vitest';
import {
  isPlaceholderPartCode,
  looksLikeManufacturerMpn,
  extractMpnFromText,
  resolvePartCodeFromRow,
  isDiscardableImportRow,
} from '../import_fixup.js';
import { lookupComponent } from '../hardcoded_datasheet.js';

describe('import_fixup', () => {
  it('detects IMP placeholders', () => {
    expect(isPlaceholderPartCode('IMP-0003')).toBe(true);
    expect(isPlaceholderPartCode('CQ02WGF4700TCE')).toBe(false);
  });

  it('extracts MPN from description text', () => {
    expect(extractMpnFromText('Royal Ohm CQ02WGF4700TCE 47R 1%')).toBe('CQ02WGF4700TCE');
  });

  it('resolves part code from mpn column', () => {
    const out = resolvePartCodeFromRow(
      { part_code: '', mpn: 'WR04X1003FTL', description: '' },
      {},
      [],
    );
    expect(out).toBe('WR04X1003FTL');
  });

  it('discards empty IMP rows', () => {
    expect(isDiscardableImportRow({ part_code: 'IMP-0001', quantity: 0 })).toBe(true);
    expect(isDiscardableImportRow({ part_code: 'IMP-0001', quantity: 100, description: 'x' })).toBe(false);
  });
});

describe('ozdisan part patterns', () => {
  it('classifies Ozdisan screenshot part codes', () => {
    expect(lookupComponent('CQ02WGF4700TCE')?.category).toBe('Resistors');
    expect(lookupComponent('CRT03F7E4701')?.category).toBe('Resistors');
    expect(lookupComponent('MCF03KTB500103')?.category).toBe('Capacitors');
    expect(lookupComponent('RI0402L473JT')?.category).toBe('Resistors');
    expect(lookupComponent('WR04X1003FTL')?.category).toBe('Resistors');
    expect(lookupComponent('WH148-1A-2-2K')?.category).toBe('Potentiometers');
    expect(lookupComponent('RX24-50W-0R1')?.category).toBe('Resistors');
  });
});
