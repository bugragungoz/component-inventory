/**
 * Column widths that fit each header and the longest value, so the inventory table does not cut
 * text with "..." (the owner asked for whole names). Every row is its own grid with the same
 * template (fixed row height for the virtual list), so the widths come from the data, not from a
 * row's layout. A column asks for at most CAP pixels. The description is the one flexible column:
 * it keeps its base width and takes the space left, so long descriptions never push the part code
 * and the count off screen (a cut description keeps its tooltip).
 */
import type { Component } from '../../api/types';
import type { ColumnDef } from './columns';

/** .td and .th padding (10 px on each side). */
const CELL_PAD = 20;
/** .th-sort padding (6 + 6) and the sort arrow (13) with its gap (4). */
const SORT_EXTRA = 29;
const CAP = 360;
/** Only the longest values (by length) are measured: a 100,000-part table must stay quick. */
const SAMPLE = 60;

export type Font = 'head' | 'cell' | 'mono';
export type Measure = (text: string, font: Font) => number;

/** The longest values of a column by character count (a cheap filter before measuring pixels). */
export function longestValues<T>(rows: readonly T[], get: (r: T) => string, n = SAMPLE): string[] {
  let max = 0;
  for (const r of rows) {
    const len = get(r).length;
    if (len > max) max = len;
  }
  if (!max) return [];
  // Proportional fonts: a slightly shorter string can be wider, so keep everything near the top.
  const floor = Math.floor(max * 0.7);
  const seen = new Set<string>();
  for (const r of rows) {
    const v = get(r);
    if (v.length >= floor && !seen.has(v)) {
      seen.add(v);
      if (seen.size >= n * 4) break;
    }
  }
  return [...seen].sort((a, b) => b.length - a.length).slice(0, n);
}

export interface Fitted {
  /** One CSS grid track per column, in order. */
  tracks: string[];
  /** The sum of the column minimums in pixels. */
  min: number;
}

export function fitColumns(cols: readonly ColumnDef[], rows: readonly Component[], measure: Measure): Fitted {
  const tracks: string[] = [];
  let min = 0;
  for (const col of cols) {
    const flex = /^minmax\((\d+)px,\s*([\d.]+fr)\)$/.exec(col.width);
    const fixed = /^(\d+)px$/.exec(col.width);
    const base = Number(flex?.[1] ?? fixed?.[1] ?? 100);
    const head = Math.ceil(measure(col.label(), 'head')) + SORT_EXTRA + CELL_PAD;
    let content = 0;
    if (col.text && col.key !== 'description') {
      const font: Font = col.mono ? 'mono' : 'cell';
      for (const v of longestValues(rows, col.text)) content = Math.max(content, measure(v, font));
      if (content) content = Math.ceil(content) + (col.extra ?? 0) + CELL_PAD;
    }
    const need = Math.max(base, head, Math.min(content, CAP));
    tracks.push(flex ? `minmax(${need}px, ${flex[2]})` : `${need}px`);
    min += need;
  }
  return { tracks, min };
}
