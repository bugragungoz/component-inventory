/**
 * Part-number repair for imports (ported from import_fixup.js): finds a real manufacturer part
 * number in a row, in a product name or in an unmapped column. A shop's own stock code is not a
 * part number.
 */

const PLACEHOLDER_RE = /^IMP-\d{4}$/i;
const INTERNAL_STOCK_RE = /^(STK|SKU|OZ|OD|DIS|DEP)[-_]?\d+/i;

export function isPlaceholderPartCode(code: string): boolean {
  return PLACEHOLDER_RE.test(String(code || '').trim());
}

export function looksLikeManufacturerMpn(value: string): boolean {
  const t = String(value || '').trim();
  if (t.length < 4 || t.length > 64) return false;
  if (isPlaceholderPartCode(t)) return false;
  if (INTERNAL_STOCK_RE.test(t)) return false;
  if (/^\d{8,14}$/.test(t)) return false;
  if (!/[A-Z]/i.test(t) || !/\d/.test(t)) return false;
  return /^[A-Z0-9][A-Z0-9\-_./]*$/i.test(t);
}

// Tokens that look like part numbers but are sizes, ranges, values or packages: "0-100V", "4x100mm",
// "2512", "55V", "SOIC-8", "TO220".
const UNIT = '(mm|cm|m|v|vac|vdc|a|ma|ua|w|mw|k|r|ohm|nf|uf|pf|mf|uh|mh|nh|mhz|khz|hz|ghz|mah|ah|ppm|db|c|mr|kr)';
const PACKAGE = '(to|sot|so|sop|soic|tssop|ssop|msop|qfn|dfn|qfp|tqfp|lqfp|dip|pdip|sod|sma|smb|smc|do)';
const NOT_A_PART = new RegExp(`^(?:[\\d.,x\\-/]+${UNIT}?|${PACKAGE}[-\\d]*\\d)$`, 'i');

/** The most likely manufacturer part number in free text (the longest plausible token). */
export function extractMpnFromText(text: string | null | undefined): string | null {
  const raw = String(text || '');
  if (!raw.trim()) return null;
  const candidates: string[] = [];
  for (const tok of raw.split(/[\s,;|]+/)) {
    const clean = tok.replace(/^["'(]+|["'),.:]+$/g, '');
    if (looksLikeManufacturerMpn(clean) && !NOT_A_PART.test(clean)) candidates.push(clean.toUpperCase());
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0]!;
}

export function resolvePartCodeFromRow(out: Record<string, string | undefined>, raw: Record<string, string>, mappedKeys: string[]): string {
  const mapped = new Set(mappedKeys);
  const pc = String(out.part_code || '').trim();
  const mpn = String(out.mpn || '').trim();
  if (pc && !isPlaceholderPartCode(pc) && looksLikeManufacturerMpn(pc)) return pc;
  if (mpn && looksLikeManufacturerMpn(mpn)) return mpn;
  if (pc && !isPlaceholderPartCode(pc)) return pc;
  for (const t of [out.description, out.notes]) {
    const found = extractMpnFromText(t);
    if (found) return found;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (mapped.has(k)) continue;
    const s = String(v ?? '').trim();
    if (looksLikeManufacturerMpn(s)) return s.toUpperCase();
  }
  return pc || mpn || '';
}

export function isDiscardableImportRow(row: Record<string, string | undefined>): boolean {
  const pc = String(row.part_code || '').trim();
  const hasText = Boolean(String(row.description || '').trim() || String(row.notes || '').trim() || String(row.mpn || '').trim());
  const qty = Number(row.quantity);
  const hasQty = row.quantity !== '' && row.quantity != null && !Number.isNaN(qty) && qty > 0;
  if (!pc) return !hasText && !hasQty;
  if (!isPlaceholderPartCode(pc)) return false;
  return !hasQty && !hasText;
}
