import { describe, expect, it } from 'vitest';
import {
  categorizeSuggestions, enrichSuggestions, heuristicClassify, isControlledDbMatch, isLikelyOptocoupler, isWeakDatasheetUrl, mergeSuggestions,
  normaliseSimple, normalizeSuggestions, type BulkPart,
} from './bulk';

let id = 0;
const part = (p: Partial<BulkPart>): BulkPart => ({
  id: ++id, part_code: '', category: '', subcategory: '', description: '', manufacturer: '', package: '', notes: '', datasheet_url: '', quantity: 1, ...p,
});

describe('bulk auto-categorize', () => {
  it('identifies weak datasheet links and normalizes codes', () => {
    expect(isWeakDatasheetUrl('https://google.com/search?q=lm7805')).toBe(true);
    expect(isWeakDatasheetUrl('https://example.com/lm7805.pdf')).toBe(false);
    expect(normaliseSimple(' lm-7805. ')).toBe('LM7805');
  });

  it('accepts controlled prefix matches only', () => {
    expect(isControlledDbMatch({ part_code: 'LM7805CP', category: 'ICs' }, { canonical: 'LM7805', match: 'prefix', data: { category: 'ICs' } })).toBe(true);
    expect(isControlledDbMatch({ part_code: 'LM7805CP', category: 'Diodes' }, { canonical: 'LM7805', match: 'prefix', data: { category: 'ICs' } })).toBe(false);
    expect(isControlledDbMatch({ part_code: 'X', category: '' }, { canonical: null, match: 'pattern', data: { category: 'ICs' } })).toBe(false);
  });

  it('detects optocouplers by family', () => {
    expect(isLikelyOptocoupler(part({ part_code: 'PC817' }))).toBe(true);
    expect(isLikelyOptocoupler(part({ part_code: 'LM7805' }))).toBe(false);
  });

  it('categorizes uncategorized parts and never reads the current category', () => {
    const s = categorizeSuggestions([part({ part_code: 'PC817', category: 'Uncategorized' })]);
    expect(s[0]).toMatchObject({ kind: 'categorize', category: 'ICs', subcategory: 'Optocoupler', misfiled: false });
    const h = heuristicClassify(part({ part_code: 'ZZ1', description: '100nF ceramic', category: 'Resistors', notes: 'was in resistors' }));
    expect(h).toMatchObject({ category: 'Capacitors', partCodeBased: false });
  });

  it('does not flag a filed part on description keywords alone', () => {
    const s = categorizeSuggestions([part({ part_code: 'MYPART-1', category: 'Modules', description: 'npn transistor module' })]);
    expect(s).toEqual([]);
  });

  it('normalizes category spellings', () => {
    const s = normalizeSuggestions([part({ category: 'Diode' }), part({ category: 'Diodes' }), part({ category: 'My Bin' })]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: 'normalize', category: 'Diodes' });
  });

  it('fills empty fields from an exact library match', () => {
    const s = enrichSuggestions([part({ part_code: 'LM7805', category: '' })]);
    expect(s[0]?.kind).toBe('enrich');
  });

  it('groups duplicates under one canonical code', () => {
    const s = mergeSuggestions([part({ part_code: 'LM7805', quantity: 2 }), part({ part_code: 'LM7805CT', quantity: 3 }), part({ part_code: 'NE555' })]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: 'merge', total: 5 });
  });
});
