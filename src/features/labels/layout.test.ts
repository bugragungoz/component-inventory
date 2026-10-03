import { describe, expect, it } from 'vitest';
import { pageCount, placeLabels, SHEETS } from './layout';

const a4 = SHEETS.find((s) => s.id === 'a4-2x7')!;

describe('label layout', () => {
  it('fills rows left to right, then the next page', () => {
    const p = placeLabels(a4, 15);
    expect(p[0]).toMatchObject({ page: 0, x: 8, y: 10.5 });
    expect(p[1]).toMatchObject({ page: 0, x: 8 + 95 + 4 });
    expect(p[2]!.y).toBeCloseTo(10.5 + 38 + 2);
    expect(p[14]).toMatchObject({ page: 1, x: 8, y: 10.5 });
    expect(pageCount(a4, 15)).toBe(2);
  });

  it('every label stays on the page', () => {
    for (const s of SHEETS) {
      for (const l of placeLabels(s, s.cols * s.rows)) {
        expect(l.x + s.labelW).toBeLessThanOrEqual(s.pageW + 1e-9);
        expect(l.y + s.labelH).toBeLessThanOrEqual(s.pageH + 1e-9);
      }
    }
  });

  it('skips used slots on the first sheet', () => {
    const p = placeLabels(a4, 1, 3);
    expect(p[0]).toMatchObject({ page: 0, x: 8 + 95 + 4 });
    expect(p[0]!.y).toBeCloseTo(10.5 + 40);
  });
});
