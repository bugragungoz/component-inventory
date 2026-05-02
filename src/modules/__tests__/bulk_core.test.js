import { describe, it, expect } from 'vitest';
import {
  isWeakDatasheetUrl,
  isControlledDbMatch,
  isLikelyOptocoupler,
  normaliseSimple,
} from '../bulk_core.js';

describe('bulk_core', () => {
  it('identifies weak datasheet urls', () => {
    expect(isWeakDatasheetUrl('https://google.com/search?q=lm7805')).toBe(true);
    expect(isWeakDatasheetUrl('https://example.com/lm7805.pdf')).toBe(false);
  });

  it('normalizes part code format', () => {
    expect(normaliseSimple(' lm-7805. ')).toBe('LM7805');
  });

  it('accepts controlled prefix db matches', () => {
    const ok = isControlledDbMatch(
      { part_code: 'LM7805CP', category: 'ICs' },
      { canonical: 'LM7805', match: 'prefix', data: { category: 'ICs' } }
    );
    expect(ok).toBe(true);
  });

  it('detects optocoupler by part code family', () => {
    expect(isLikelyOptocoupler({ part_code: 'PC817' })).toBe(true);
    expect(isLikelyOptocoupler({ part_code: 'LM7805' })).toBe(false);
  });
});
