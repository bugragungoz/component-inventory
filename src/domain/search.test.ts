import { describe, expect, it } from 'vitest';
import { fold, matchesAll, rankCandidates, editDistance } from './search';

describe('fold', () => {
  it('folds Turkish dotted and dotless i in any UI language', () => {
    expect(fold('DİRENÇ')).toBe('direnc');
    expect(fold('Direnç')).toBe('direnc');
    expect(fold('IŞIK')).toBe('isik');
    expect(fold('ışık')).toBe('isik');
    expect(fold('IRF540N')).toBe('irf540n');
    expect(fold('ÇİP-İıŞş')).toBe('cip-iiss');
  });
  it('drops accents', () => {
    expect(fold('Lötfett')).toBe('lotfett');
  });
});

describe('matching', () => {
  it('all words must match', () => {
    const h = fold('LM358 dual op-amp SO8 Özdisan şasi');
    expect(matchesAll(h, 'lm358 ozdisan sasi')).toBe(true);
    expect(matchesAll(h, 'lm358 tl431')).toBe(false);
  });
  it('ranks near misses', () => {
    expect(rankCandidates('BJT NP', ['BJT NPN', 'BJT PNP', 'MOSFET'])[0]).toBe('BJT NPN');
    expect(editDistance('abcd', 'abdc')).toBe(1);
  });
});
