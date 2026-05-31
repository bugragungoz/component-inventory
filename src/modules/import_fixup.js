/**
 * Import row repair: resolve real MPNs, drop empty IMP placeholders.
 */

const PLACEHOLDER_RE = /^IMP-\d{4}$/i;

/** Ozdisan / distributor rows often use internal stock codes — not manufacturer MPN. */
const INTERNAL_STOCK_RE = /^(STK|SKU|OZ|OD|DIS|DEP)[-_]?\d+/i;

export function isPlaceholderPartCode(code) {
  return PLACEHOLDER_RE.test(String(code || '').trim());
}

export function looksLikeManufacturerMpn(value) {
  const t = String(value || '').trim();
  if (t.length < 4 || t.length > 64) return false;
  if (isPlaceholderPartCode(t)) return false;
  if (INTERNAL_STOCK_RE.test(t)) return false;
  if (/^\d{8,14}$/.test(t)) return false;
  if (!/[A-Z]/i.test(t) || !/\d/.test(t)) return false;
  return /^[A-Z0-9][A-Z0-9\-_.]*$/i.test(t);
}

/**
 * Pick the best manufacturer part number from free text (description, notes).
 * @param {string} text
 * @returns {string|null}
 */
export function extractMpnFromText(text) {
  const raw = String(text || '');
  if (!raw.trim()) return null;

  const candidates = [];
  const tokens = raw.split(/[\s,;|/]+/).map(s => s.trim()).filter(Boolean);
  for (const tok of tokens) {
    const clean = tok.replace(/^["'(]+|["')]+$/g, '');
    if (looksLikeManufacturerMpn(clean)) candidates.push(clean.toUpperCase());
  }

  const longMatch = raw.match(
    /\b([A-Z]{2,}[A-Z0-9]*(?:[-_.][A-Z0-9]+)*\d[A-Z0-9\-_.]{2,})\b/gi,
  );
  if (longMatch) {
    for (const m of longMatch) {
      const u = m.toUpperCase();
      if (looksLikeManufacturerMpn(u)) candidates.push(u);
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

/**
 * Resolve part_code from mapped row fields and any unmapped Excel columns.
 */
export function resolvePartCodeFromRow(out, rawRow, mappedOrigKeys) {
  const mapped = new Set(mappedOrigKeys || []);
  let pc = String(out.part_code || '').trim();
  const mpn = String(out.mpn || '').trim();

  if (pc && !isPlaceholderPartCode(pc) && looksLikeManufacturerMpn(pc)) return pc;
  if (mpn && looksLikeManufacturerMpn(mpn)) return mpn;

  if (pc && !isPlaceholderPartCode(pc)) return pc;

  for (const text of [out.description, out.notes]) {
    const found = extractMpnFromText(text);
    if (found) return found;
  }

  if (rawRow && typeof rawRow === 'object') {
    for (const [key, val] of Object.entries(rawRow)) {
      if (mapped.has(key)) continue;
      const s = String(val ?? '').trim();
      if (looksLikeManufacturerMpn(s)) return s.toUpperCase();
    }
  }

  return pc || mpn || '';
}

/** Drop import rows that are empty IMP placeholders. */
export function isDiscardableImportRow(row) {
  const pc = String(row.part_code || '').trim();
  if (!isPlaceholderPartCode(pc)) return false;
  const qty = Number(row.quantity);
  const hasQty = row.quantity !== '' && row.quantity != null && !Number.isNaN(qty) && qty > 0;
  const hasText = Boolean(
    String(row.description || '').trim() ||
    String(row.notes || '').trim() ||
    String(row.mpn || '').trim(),
  );
  return !hasQty && !hasText;
}

export function extractBestMpnFromComponent(comp) {
  if (comp.mpn && looksLikeManufacturerMpn(comp.mpn)) {
    return String(comp.mpn).trim().toUpperCase();
  }
  for (const text of [comp.description, comp.notes, comp.part_code]) {
    const found = extractMpnFromText(text);
    if (found) return found;
  }
  return null;
}
