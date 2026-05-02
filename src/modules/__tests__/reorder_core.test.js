import { describe, it, expect } from 'vitest';
import { normalizeThreshold, getSuggestedQty, buildReorderRows } from '../reorder_core.js';

describe('reorder_core', () => {
  it('normalizes invalid threshold to fallback', () => {
    expect(normalizeThreshold('abc', 1)).toBe(1);
    expect(normalizeThreshold('-5', 1)).toBe(1);
    expect(normalizeThreshold('3', 1)).toBe(3);
  });

  it('computes suggested quantity above threshold', () => {
    expect(getSuggestedQty(0, 2)).toBe(4);
    expect(getSuggestedQty(2, 2)).toBe(2);
    expect(getSuggestedQty(10, 2)).toBe(1);
  });

  it('returns only low stock rows sorted ascending by quantity', () => {
    const rows = buildReorderRows(
      [
        { id: 1, quantity: 8, part_code: 'A' },
        { id: 2, quantity: 1, part_code: 'B' },
        { id: 3, quantity: 0, part_code: 'C' },
      ],
      2
    );
    expect(rows.map(r => r.id)).toEqual([3, 2]);
  });
});
