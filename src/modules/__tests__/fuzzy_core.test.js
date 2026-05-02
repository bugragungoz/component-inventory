import { describe, it, expect } from 'vitest';
import { editDistance, fuzzyScore, rankCandidates, highlightMatch } from '../fuzzy_core.js';

describe('fuzzy_core', () => {
  it('handles typo distance with transposition', () => {
    expect(editDistance('resistor', 'resisotr', 3)).toBe(1);
  });

  it('prefers prefix match over fuzzy match', () => {
    const exactPrefix = fuzzyScore('res', 'Resistor');
    const typo = fuzzyScore('res', 'Rasistor');
    expect(exactPrefix).toBeLessThan(typo);
  });

  it('ranks best candidate first', () => {
    const ranked = rankCandidates('optocupler', ['Comparator', 'Optocoupler', 'Resistor'], 3);
    expect(ranked[0].value).toBe('Optocoupler');
  });

  it('highlights matching token', () => {
    const html = highlightMatch('opto', 'Optocoupler');
    expect(html).toContain('<mark>');
    expect(html).toContain('</mark>');
  });
});
