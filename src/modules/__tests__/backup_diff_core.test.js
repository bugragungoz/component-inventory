import { describe, it, expect } from 'vitest';
import { computeDiffCore } from '../backup_diff_core.js';

describe('backup_diff_core', () => {
  it('computes added, removed and changed records', () => {
    const a = new Map([
      ['A', { part_code: 'A', category: 'ICs', quantity: 1 }],
      ['B', { part_code: 'B', category: 'Diodes', quantity: 2 }],
    ]);
    const b = new Map([
      ['A', { part_code: 'A', category: 'ICs', quantity: 5 }],
      ['C', { part_code: 'C', category: 'Resistors', quantity: 1 }],
    ]);
    const diff = computeDiffCore(a, b, ['category', 'quantity']);
    expect(diff.added.length).toBe(1);
    expect(diff.removed.length).toBe(1);
    expect(diff.changed.length).toBe(1);
    expect(diff.changed[0].part_code).toBe('A');
  });
});
