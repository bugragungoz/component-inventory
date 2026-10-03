import { describe, expect, it } from 'vitest';
import { parseLocaleNumber, parseQuantity, parseUserQuantity, parseWholeQuantity } from './number';

describe('parseQuantity (shop data, any locale)', () => {
  it.each([
    ['5', 5], ['100', 100], ['1.000', 1000], ['1,000', 1000], ['2.500', 2500],
    ['1.250,50', 1250.5], ['1,250.50', 1250.5], ['12.000', 12000], ['1.000.000', 1000000],
    ['0.500', 0.5], ['2,5', 2.5], ['3 Adet', 3], ['x3', 3], ['10 pcs', 10], [' 7 ', 7],
  ])('%s -> %s', (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });
  it.each([[''], [null], [undefined], ['-'], ['abc'], ['1.2.3'], ['-5']])('%s -> null', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
  it('whole counts only when a count must be whole', () => {
    expect(parseWholeQuantity('2,5')).toBeNull();
    expect(parseWholeQuantity('1.000')).toBe(1000);
  });
});

describe('parseLocaleNumber', () => {
  it.each([['3,90', 3.9], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.000.000', 1000000], ['4.7', 4.7]])('%s -> %s', (input, expected) => {
    expect(parseLocaleNumber(input)).toBe(expected);
  });
  it('rejects text', () => expect(parseLocaleNumber('12V')).toBeNull());
});

describe('parseUserQuantity (what the owner types, by UI locale)', () => {
  it('Turkish: dot groups thousands', () => {
    expect(parseUserQuantity('1.000', 'tr')).toBe(1000);
    expect(parseUserQuantity('25', 'tr')).toBe(25);
    expect(parseUserQuantity('2,5', 'tr')).toBeNull();
  });
  it('English: comma groups thousands, a dot is a decimal', () => {
    expect(parseUserQuantity('1,000', 'en')).toBe(1000);
    expect(parseUserQuantity('1.000', 'en')).toBe(1);
    expect(parseUserQuantity('1.5', 'en')).toBeNull();
  });
  it('rejects junk', () => {
    expect(parseUserQuantity('12a', 'en')).toBeNull();
    expect(parseUserQuantity('-3', 'tr')).toBeNull();
  });
});
