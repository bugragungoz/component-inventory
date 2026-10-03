/**
 * Number parsing. Two different jobs, kept apart on purpose:
 *  - parseQuantity reads SHOP data (order pages, CSV, PDF): "1.000" and "1,000" are a thousand in
 *    every locale, because a component count is almost never fractional and reading 2.500 as 2.5
 *    silently loses stock. Locale independent.
 *  - parseUserQuantity reads what the owner TYPES, in the UI locale's own conventions.
 * Anything that is not clearly a number is null: skipped and reported, never guessed.
 */

function clean(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim().replace(/\s/g, '');
}

/** Prices, voltages, currents: both "1,234.56" and "1.234,56"; a lone "1.000" reads as 1. */
export function parseLocaleNumber(v: unknown): number | null {
  const s = clean(v);
  if (s === '' || s === '-') return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  let normalized = s;
  if (hasDot && hasComma) {
    normalized = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    normalized = parts.length === 2 && parts[1]!.length >= 1 && parts[1]!.length <= 3 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (hasDot && s.split('.').length > 2) {
    normalized = s.replace(/\./g, '');
  }
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Counts from shop data. "3 Adet", "x3", "10 pcs", "1.000" (a thousand), "1.250,50". */
export function parseQuantity(v: unknown): number | null {
  let s = clean(v).replace(/(adet|pcs|pieces|piece|ad\.?|x)$/i, '').replace(/^x/i, '');
  if (s === '' || s === '-') return null;
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (dots && commas) {
    const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    if (s.split(dec).length > 2) return null;
    s = s.split(thou).join('').replace(dec, '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  const sep = dots ? '.' : commas ? ',' : '';
  if (!sep) return parseInt(s, 10);
  const parts = s.split(sep);
  const grouped = parts.slice(1).every((p) => p.length === 3) && parts[0]!.length >= 1 && parts[0]!.length <= 3 && parts[0] !== '0';
  if (grouped) return parseInt(parts.join(''), 10);
  if (parts.length > 2) return null;
  const n = parseFloat(parts.join('.'));
  return Number.isFinite(n) ? n : null;
}

/** A shop count that must be a whole number of pieces: the number, or null when it is not one. */
export function parseWholeQuantity(v: unknown): number | null {
  const n = parseQuantity(v);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
}

/** What the owner types in a quantity field, read in the UI locale (group and decimal marks). */
export function parseUserQuantity(text: string, locale: string): number | null {
  const s = text.trim();
  if (!s) return null;
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find((p) => p.type === 'group')?.value ?? ',';
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  let t = s.replace(/\s/g, '');
  // Group marks are only allowed between groups of three digits.
  const groupRe = new RegExp(`^\\d{1,3}(${escape(group)}\\d{3})+(${escape(decimal)}\\d+)?$`);
  if (groupRe.test(t)) t = t.split(group).join('');
  t = t.replace(decimal, '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : null;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\u00a0|\u202f/g, '[\\s\\u00a0\\u202f]');
}
