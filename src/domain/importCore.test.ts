import { describe, expect, it } from 'vitest';
import type { RawRow } from './importCore';
import { applyColumnMap, cropPdfTableRows, detectDelimiter, guessColumnMap, isSummaryRow, normalizeHeader, tableToRows } from './importCore';
import { extractMpnFromText, isDiscardableImportRow, isPlaceholderPartCode, resolvePartCodeFromRow } from './importFixup';
import { lookupComponent } from './classify/datasheetDb';

describe('header mapping', () => {
  it('maps Turkish and English names', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(normalizeHeader('Parca Kodu')).toBe('part_code');
    expect(normalizeHeader('Ürün Kodu:')).toBe('part_code');
    expect(normalizeHeader('Adet')).toBe('quantity');
    expect(normalizeHeader('Tedarikçi')).toBe('preferred_supplier');
    expect(normalizeHeader('Brand')).toBe('manufacturer');
    expect(normalizeHeader('Seri No')).toBeNull();
    expect(normalizeHeader('URL')).toBeNull();
    expect(normalizeHeader('Datasheet')).toBe('datasheet_url');
  });
  it('merges sheets with different header names', () => {
    const raw: RawRow[] = [{ 'Parca Kodu': 'LM7805', Adet: '3' }, { 'Part Code': 'NE555P', Qty: '2' }];
    const rows = applyColumnMap(raw, guessColumnMap(raw));
    expect(rows.map((r) => [r.part_code, r.quantity])).toEqual([['LM7805', '3'], ['NE555P', '2']]);
  });
  it('a second column for the same field does not overwrite the first', () => {
    const raw: RawRow[] = [{ Code: 'A1', 'Stok Kodu': 'X', Qty: '1' }, { Code: '', 'Stok Kodu': 'B2', Qty: '1' }];
    const rows = applyColumnMap(raw, guessColumnMap(raw));
    expect(rows.map((r) => r.part_code)).toEqual(['A1', 'B2']);
  });
  it('finds the header row below a title block', () => {
    const { rows, recognized } = tableToRows([['Özdisan Elektronik'], ['Sipariş', '1234'], ['Ürün Kodu', 'Açıklama', 'Adet'], ['LM358ADT', 'IC-358', '10']]);
    expect(recognized).toBe(3);
    expect(rows[0]).toEqual({ 'Ürün Kodu': 'LM358ADT', Açıklama: 'IC-358', Adet: '10' });
  });
});

describe('PDF table cropping', () => {
  it('stops at the first totals row and drops repeated page headers', () => {
    const rows: RawRow[] = [
      { 'Urun Kodu': 'LM7805', Adet: '3' },
      { 'Urun Kodu': 'Urun Kodu', Adet: 'Adet' },
      { 'Urun Kodu': 'NE555P', Adet: '2' },
      { 'Urun Kodu': 'Ara Toplam', Adet: '' },
      { 'Urun Kodu': 'Benzer Urunler', Adet: '5' },
    ];
    expect(cropPdfTableRows(rows).map((r) => r['Urun Kodu'])).toEqual(['LM7805', 'NE555P']);
  });
  it('knows total labels but not part names', () => {
    expect(isSummaryRow(['KDV Toplam:', '10'])).toBe(true);
    expect(isSummaryRow(['Genel Toplam', '99'])).toBe(true);
    expect(isSummaryRow(['Grand Total'])).toBe(true);
    expect(isSummaryRow(['TOTAL-1234 kondansator'])).toBe(false);
    expect(isSummaryRow(['LM7805'])).toBe(false);
  });
});

describe('part numbers from names', () => {
  it.each([
    ['IRFZ44N - 55V 49A Mosfet - TO220', 'IRFZ44N'],
    ['MCP6002T-I/SN SOIC-8 Smd OpAmp Entegresi', 'MCP6002T-I/SN'],
    ['BAT54S SMD Schottky Diyot', 'BAT54S'],
    ['2N2222 NPN Tip Transistör', '2N2222'],
    ['Ad620 Yüksek Hassasiyetli Mikrovolt', 'AD620'],
    ['Royal Ohm CQ02WGF4700TCE 47R 1%', 'CQ02WGF4700TCE'],
    ['91K 603 SMD Direnç - 10 Adet', null],
    ['Panel Tipi 0-100V Voltmetre', null],
    ['4x100mm Düz Uçlu Elektronikçi Tornavida', null],
    ['40 pin Erkek B Tipi Header 23mm (180 Derece)', null],
    ['5mR 2512 3W SMD Şönt Direnç', null],
  ])('%s -> %s', (name, code) => {
    expect(extractMpnFromText(name)).toBe(code);
  });
  it('placeholders and mpn columns', () => {
    expect(isPlaceholderPartCode('IMP-0003')).toBe(true);
    expect(resolvePartCodeFromRow({ part_code: '', mpn: 'WR04X1003FTL', description: '' }, {}, [])).toBe('WR04X1003FTL');
    expect(isDiscardableImportRow({ part_code: 'IMP-0001', quantity: '0' })).toBe(true);
    expect(isDiscardableImportRow({ part_code: 'IMP-0001', quantity: '100', description: 'x' })).toBe(false);
  });
});

describe('built-in part rules (ported unchanged)', () => {
  it('classifies Özdisan codes', () => {
    expect(lookupComponent('CQ02WGF4700TCE')?.category).toBe('Resistors');
    expect(lookupComponent('CRT03F7E4701')?.category).toBe('Resistors');
    expect(lookupComponent('MCF03KTB500103')?.category).toBe('Capacitors');
    expect(lookupComponent('WH148-1A-2-2K')?.category).toBe('Potentiometers');
  });
  it('keeps the 74-series and optocoupler fixes', () => {
    expect(lookupComponent('74HC595')?.subcategory).toBe('Logic');
    expect(lookupComponent('SN74HC595DR')?.category).toBe('ICs');
    expect(lookupComponent('STPS2L40')?.category).toBe('Diodes');
    expect(lookupComponent('4N35')?.subcategory).toBe('Optocoupler');
  });
});
