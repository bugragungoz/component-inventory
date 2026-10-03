import { describe, expect, it } from 'vitest';
import { computeWindow } from './virtualWindow';

describe('computeWindow', () => {
  const base = { rowHeight: 36, viewportHeight: 720, total: 100_000, overscan: 10 };

  it('starts at the top with the visible rows plus overscan', () => {
    const w = computeWindow({ ...base, scrollTop: 0 });
    expect(w.start).toBe(0);
    expect(w.end).toBe(30);
    expect(w.padTop).toBe(0);
    expect(w.padBottom).toBe((100_000 - 30) * 36);
  });

  it('keeps the total height constant so the scrollbar does not jump', () => {
    for (const st of [0, 12_345, 200_000, 3_599_000]) {
      const w = computeWindow({ ...base, scrollTop: st });
      expect(w.padTop + (w.end - w.start) * 36 + w.padBottom).toBe(100_000 * 36);
    }
  });

  it('clamps at the end of the list', () => {
    const w = computeWindow({ ...base, scrollTop: 100_000 * 36 });
    expect(w.end).toBe(100_000);
    expect(w.padBottom).toBe(0);
    expect(w.end - w.start).toBeLessThan(60);
  });

  it('handles an empty list', () => {
    expect(computeWindow({ ...base, total: 0, scrollTop: 500 })).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
  });
});
