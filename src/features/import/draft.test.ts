import { buildPayload, parseCinvPayload } from '@cinv/core';
import { describe, expect, it } from 'vitest';
import { guessColumnMap } from '../../domain/importCore';
import { draftFromCinv, draftFromTable, enrich, markDuplicates, needsLook, pieces, toImportRows, totals } from './draft';
import { decodeText, parseCsv, rowsFromCsv } from './parsers';

const cinv = (site: string, items: Array<{ name: string; code?: string; qty: number; packSize?: number }>) => {
  const r = parseCinvPayload(buildPayload({ site, kind: 'order', url: '', items }));
  if (!r.ok) throw new Error(r.error);
  return draftFromCinv(r.payload, 'link', r.dropped);
};

describe('import draft', () => {
  it('applies the Motorobit pack rule and says why', () => {
    const d = cinv('motorobit', [{ name: '91K 603 SMD Direnç - 10 Adet', qty: 10 }, { name: 'IRFZ44N - 55V 49A Mosfet - TO220', qty: 8 }]);
    expect(d.rows.map(pieces)).toEqual([100, 8]);
    expect(d.rows[0]!.why).toContainEqual({ code: 'pack-rule', size: 10 });
    expect(d.rows[1]!.part_code).toBe('IRFZ44N');
    expect(d.rows[1]!.issues).toContainEqual({ code: 'code-from-name' });
  });

  it('gives two pack sizes of one Motorobit product the same code', () => {
    const d = cinv('motorobit', [{ name: '91K 603 SMD Direnç - 10 Adet', qty: 1 }, { name: '91K 603 SMD Direnç - 50 Adet', qty: 2 }]);
    expect(d.rows.map((r) => r.part_code)).toEqual(['91K 603 SMD Direnç', '91K 603 SMD Direnç']);
    expect(d.rows.map(pieces)).toEqual([10, 100]);
    const t = draftFromTable([{ Product: '91K 603 SMD Direnç - 20 Adet', Qty: '3' }], { Product: 'description', Qty: 'quantity' }, 'pdf', 'order.pdf', 'motorobit');
    expect(t.rows[0]).toMatchObject({ part_code: '91K 603 SMD Direnç', pack: 20, units: 3 });
  });

  it('never reads "8\'li" or "16\'lı" as a pack', () => {
    const d = cinv('robocombo', [{ name: "8'li DIP Switch", code: '1605200024', qty: 1 }, { name: "16'lı Entegre Soketi", code: '1603250319', qty: 5 }]);
    expect(d.rows.map((r) => r.pack)).toEqual([1, 1]);
    expect(d.rows.map(pieces)).toEqual([1, 5]);
    // A Robocombo code is the shop's stock code: kept in the notes, never the part code.
    expect(d.rows[0]!.part_code).not.toBe('1605200024');
    expect(d.rows[0]!.notes).toContain('1605200024');
  });

  it('keeps Özdisan codes, which are manufacturer part numbers', () => {
    const d = cinv('ozdisan', [{ name: 'IC-2101 HIGH-LOW DRIVER SOP8 IR', code: 'IR2101STRPBF', qty: 3 }]);
    expect(d.rows[0]).toMatchObject({ part_code: 'IR2101STRPBF', units: 3, pack: 1 });
    expect(needsLook(d.rows[0]!)).toBe(false);
  });

  it('flags a count it cannot read instead of guessing', () => {
    const raw = [{ Code: 'A1', Qty: '3' }, { Code: 'A2', Qty: 'çok' }, { Code: 'A3', Qty: '2,5' }];
    const d = draftFromTable(raw, guessColumnMap(raw), 'csv', 'x.csv');
    expect(d.rows.map((r) => r.units)).toEqual([3, null, 3]);
    expect(d.rows[1]!.issues[0]).toMatchObject({ code: 'no-quantity', raw: 'çok' });
    expect(d.rows[2]!.issues[0]).toMatchObject({ code: 'not-whole', raw: '2,5' });
    expect(totals(d.rows)).toMatchObject({ lines: 2, unreadable: 1 });
    expect(toImportRows(d.rows).map((r) => r.part_code)).toEqual(['A1', 'A3']);
  });

  it('reads shop numbers: 1.000 is a thousand', () => {
    const raw = [{ 'Parça Kodu': 'R1', Adet: '1.000' }];
    expect(draftFromTable(raw, guessColumnMap(raw), 'csv', 'x').rows[0]!.units).toBe(1000);
  });

  it('marks codes that appear on several lines (summed when written)', () => {
    const raw = [{ Code: 'LM7805', Qty: '2' }, { Code: 'lm7805', Qty: '3' }];
    const d = draftFromTable(raw, guessColumnMap(raw), 'csv', 'x');
    markDuplicates(d.rows);
    expect(d.rows[0]!.issues).toContainEqual({ code: 'duplicate', count: 2 });
  });

  it('fills empty fields from the library without overwriting', () => {
    const raw = [{ Code: 'LM7805', Qty: '2', Package: 'TO-220F' }];
    const d = draftFromTable(raw, guessColumnMap(raw), 'csv', 'x');
    const lib = [{ part_code: 'LM7805', mpn: 'LM7805CT', category: 'ICs', subcategory: 'Voltage Regulator', package: 'TO-220', manufacturer: 'ST', description: '5V regulator', datasheet_url: '', voltage_max: 35, current_max: 1.5, resistance: '', tolerance: '', power_rating: null, attributes: {} }];
    const [r] = enrich(d.rows, lib);
    expect(r).toMatchObject({ category: 'ICs', package: 'TO-220F', manufacturer: 'ST', mpn: 'LM7805CT' });
    expect(r!.issues).toContainEqual({ code: 'filled-library', source: 'library' });
  });
});

describe('CSV', () => {
  it('handles quotes, semicolons and the Turkish Windows code page', () => {
    expect(parseCsv('a;b\n"x;1";"say ""hi"""\n')).toEqual([['a', 'b'], ['x;1', 'say "hi"']]);
    const cp1254 = Uint8Array.from([0x50, 0x61, 0x72, 0xe7, 0x61, 0x3b, 0x41, 0x64, 0x65, 0x74, 0x0a, 0x44, 0xfe, 0x3b, 0x32, 0x0a]);
    expect(decodeText(cp1254)).toBe('Parça;Adet\nDş;2\n');
    expect(rowsFromCsv(new TextEncoder().encode('﻿Part Code,Quantity\nNE555,4\n'))).toEqual([{ 'Part Code': 'NE555', Quantity: '4' }]);
  });
});
