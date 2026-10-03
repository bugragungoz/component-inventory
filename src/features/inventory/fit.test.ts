import { describe, expect, it } from 'vitest';
import type { Component } from '../../api/types';
import type { ColumnDef } from './columns';
import { fitColumns, longestValues } from './fit';

// 7 px per character in every font: enough to check the arithmetic.
const measure = (text: string) => text.length * 7;
const part = (part_code: string, description = ''): Component => ({ part_code, description } as Component);
const col = (over: Partial<ColumnDef>): ColumnDef => ({
  key: 'x', label: () => 'X', width: 'minmax(100px, 1fr)', sortable: true, defaultVisible: true, render: () => null, ...over,
});

describe('fitColumns', () => {
  it('widens a column to its longest value, keeping the fraction', () => {
    const code = col({ key: 'part_code', width: 'minmax(170px, 1.1fr)', text: (c) => c.part_code, extra: 26 });
    const rows = [part('1K'), part('1K Potansiyometre 10 Tur')];
    const { tracks, min } = fitColumns([code], rows, measure);
    // 24 characters x 7 + icon 26 + padding 20 = 214
    expect(tracks).toEqual(['minmax(214px, 1.1fr)']);
    expect(min).toBe(214);
  });

  it('never makes a column narrower than its header (a fixed column grows)', () => {
    const v = col({ key: 'voltage_max', label: () => 'Max voltage', width: '96px' });
    // 11 characters x 7 + sort button 29 + padding 20 = 126
    expect(fitColumns([v], [], measure).tracks).toEqual(['126px']);
  });

  it('keeps the base width when values are short', () => {
    const c = col({ text: (r) => r.part_code });
    expect(fitColumns([c], [part('R1')], measure).tracks).toEqual(['minmax(100px, 1fr)']);
  });

  it('caps a column, and the description stays flexible whatever its length', () => {
    const long = 'x'.repeat(200);
    const c = col({ text: (r) => r.part_code });
    const d = col({ key: 'description', label: () => 'Description', width: 'minmax(220px, 2.4fr)', text: (r) => r.description });
    const { tracks } = fitColumns([c, d], [part(long, long)], measure);
    expect(tracks).toEqual(['minmax(360px, 1fr)', 'minmax(220px, 2.4fr)']);
  });
});

describe('longestValues', () => {
  it('returns the longest distinct values first', () => {
    const rows = ['a', 'bbbb', 'cccccccc', 'cccccccc', 'ddddddd'];
    expect(longestValues(rows, (r) => r, 2)).toEqual(['cccccccc', 'ddddddd']);
  });

  it('is empty when every value is empty', () => {
    expect(longestValues(['', ''], (r) => r)).toEqual([]);
  });
});
