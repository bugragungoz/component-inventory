import { UNCATEGORIZED_CATEGORY } from './constants.js';

export function isWeakDatasheetUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.toLowerCase().trim();
  if (!u) return true;
  if (u.includes('google.com/search')) return true;
  if (u.includes('duckduckgo.com')) return true;
  if (u.includes('?q=') && !u.includes('.pdf')) return true;
  return false;
}

export function normaliseSimple(s) {
  return String(s || '').toUpperCase().replace(/[\s\-_.]/g, '');
}

/**
 * Normalise a category string for comparison — strips trailing s, lowercases.
 * "Diodes" → "diode", "Transistors" → "transistor", etc.
 */
export function normaliseCatForCompare(cat) {
  if (!cat) return '';
  return String(cat).toLowerCase().replace(/s$/, '').trim();
}

export function categoryConsistent(comp, hit) {
  if (!hit || !hit.category) return false;
  if (!comp.category || comp.category === UNCATEGORIZED_CATEGORY) return true;
  // Compare after normalising to avoid "Diode" vs "Diodes" mismatches
  return normaliseCatForCompare(comp.category) === normaliseCatForCompare(hit.category);
}

export function isControlledDbMatch(comp, found) {
  if (!found || !found.data || found.match === 'pattern') return false;
  if (!categoryConsistent(comp, found.data)) return false;
  if (found.match === 'exact') return true;
  if (found.match !== 'prefix' && found.match !== 'extends') return false;

  const src   = normaliseSimple(comp.part_code || '');
  const canon = normaliseSimple(found.canonical || '');
  if (!src || !canon) return false;

  const minLen = Math.min(src.length, canon.length);
  const delta  = Math.abs(src.length - canon.length);
  if (minLen < 3) return false;
  // Allow up to 4-char delta for common alias patterns (LM7805 ↔ 7805, IRLZ44 ↔ IRLZ44N)
  if (delta > 4) return false;
  return src.startsWith(canon) || canon.startsWith(src);
}

export function isLikelyOptocoupler(comp) {
  const key = normaliseSimple(comp?.part_code || '');
  if (/^6N(13[5-9]|14[0-9])$/.test(key)) return true;
  if (/^4N(2[5-9]|3[0-9]|4[0-8])$/.test(key)) return true;
  if (/^MOC30\d{2}/.test(key)) return true;
  if (/^TLP\d{3,4}$/.test(key)) return true;
  if (/^PC(8[1-4]7|923)$/.test(key)) return true;
  if (/^EL(8\d{2}|3H7)$/.test(key)) return true;

  const blob = [
    comp?.part_code, comp?.description, comp?.manufacturer, comp?.notes
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(optocoupler|opto-?isolator|optoisolator|photocoupler|phototransistor output)\b/.test(blob);
}
