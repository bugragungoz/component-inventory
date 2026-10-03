/**
 * Bulk auto-categorize: suggestions only, the owner picks which to apply. Ported from the old
 * app's bulk_categorize.js with its hard-won rules kept:
 *  - the heuristic never reads the current category, subcategory or notes (a wrong category would
 *    keep confirming itself);
 *  - "this looks misfiled" needs strong evidence (a library match on the part number);
 *  - duplicates are grouped only on a deterministic match and a consistent category.
 */
import { categorizeByDescription, lookupCanonical, lookupComponent } from './classify/datasheetDb';
import type { CanonicalHit, PartHint } from './classify/types';
import { normalizeCategory, UNCATEGORIZED } from './taxonomy';

export interface BulkPart {
  id: number;
  part_code: string;
  category: string;
  subcategory: string;
  description: string;
  manufacturer: string;
  package: string;
  notes: string;
  datasheet_url: string;
  quantity: number;
}

export type Confidence = 'high' | 'medium' | 'low';

export type Suggestion =
  | { kind: 'categorize'; part: BulkPart; category: string; subcategory: string; source: 'part-code' | 'opto' | 'description' | 'heuristic'; confidence: Confidence; misfiled: boolean }
  | { kind: 'normalize'; part: BulkPart; category: string; confidence: 'high' }
  | { kind: 'enrich'; part: BulkPart; patch: Partial<Record<'category' | 'subcategory' | 'package' | 'manufacturer' | 'description' | 'datasheet_url', string>>; confidence: Confidence }
  | { kind: 'merge'; canonical: string; members: BulkPart[]; total: number; confidence: 'high' };

const isUncategorized = (c: string) => !c || c === UNCATEGORIZED;

export function isWeakDatasheetUrl(url: string | null | undefined): boolean {
  const u = String(url ?? '').toLowerCase().trim();
  if (!u) return true;
  if (u.includes('google.com/search') || u.includes('duckduckgo.com')) return true;
  return u.includes('?q=') && !u.includes('.pdf');
}

export function normaliseSimple(s: string | null | undefined): string {
  return String(s ?? '').toUpperCase().replace(/[\s\-_.]/g, '');
}

function sameCategory(a: string, b: string): boolean {
  return normalizeCategory(a) === normalizeCategory(b);
}

export function categoryConsistent(part: Pick<BulkPart, 'category'>, hit: PartHint | null | undefined): boolean {
  if (!hit?.category) return false;
  if (isUncategorized(part.category)) return true;
  return sameCategory(part.category, hit.category);
}

/** A library match close enough to trust for filling fields or merging. */
export function isControlledDbMatch(part: Pick<BulkPart, 'category' | 'part_code'>, found: CanonicalHit | null): boolean {
  if (!found?.data || found.match === 'pattern') return false;
  if (!categoryConsistent(part, found.data)) return false;
  if (found.match === 'exact') return true;
  const src = normaliseSimple(part.part_code);
  const canon = normaliseSimple(found.canonical);
  if (!src || !canon || Math.min(src.length, canon.length) < 3 || Math.abs(src.length - canon.length) > 4) return false;
  return src.startsWith(canon) || canon.startsWith(src);
}

export function isLikelyOptocoupler(part: Pick<BulkPart, 'part_code' | 'description' | 'manufacturer' | 'notes'>): boolean {
  const key = normaliseSimple(part.part_code);
  if (/^6N(13[5-9]|14[0-9])$/.test(key) || /^4N(2[5-9]|3[0-9]|4[0-8])$/.test(key) || /^MOC30\d{2}/.test(key) || /^TLP\d{3,4}$/.test(key) ||
    /^PC(8[1-4]7|923)$/.test(key) || /^EL(8\d{2}|3H7)$/.test(key)) return true;
  const blob = [part.part_code, part.description, part.manufacturer, part.notes].filter(Boolean).join(' ').toLowerCase();
  return /\b(optocoupler|opto-?isolator|optoisolator|photocoupler|phototransistor output)\b/.test(blob);
}

function strongDiodeEvidence(part: BulkPart): boolean {
  const blob = [part.part_code, part.description, part.package, part.manufacturer].filter(Boolean).join(' ').toLocaleLowerCase('tr');
  return /\b(schottky|rectifier|fast\s*recovery|ultra[\s-]*fast|zener|bridge\s*rectifier|tvs|diode|diyot)\b/.test(blob);
}

/** Part number first (strong), then description keywords (medium). Never reads the current category. */
export function heuristicClassify(part: BulkPart): { category: string; subcategory: string; confidence: Confidence; partCodeBased: boolean } | null {
  const code = lookupComponent(part.part_code);
  if (code?.category) return { category: code.category, subcategory: code.subcategory ?? '', confidence: 'high', partCodeBased: true };
  const blob = [part.part_code, part.description, part.package, part.manufacturer].filter(Boolean).join(' ').toLocaleLowerCase('tr');
  const m = (category: string, subcategory: string) => ({ category, subcategory, confidence: 'medium' as const, partCodeBased: false });
  if (/(\b\d+(\.\d+)?[krm]\b)|res-|resistor|diren[cç]|\b\d+r\d*\b/.test(blob)) return m('Resistors', /\b(0201|0402|0603|0805|1206|1210|smd|chip)\b/.test(blob) ? 'SMD' : 'Through-Hole');
  if (/(\d+(\.\d+)?\s?(uf|µf|nf|pf)\b)|cap-|capacitor|kondans|mlcc/.test(blob)) return m('Capacitors', /\b(mlcc|ceramic|seramik)\b/.test(blob) ? 'MLCC' : 'Ceramic');
  if (/(\d+(\.\d+)?\s?(uh|µh|mh|nh)\b)|inductor|bobin|choke/.test(blob)) return m('Inductors', 'Inductor');
  if (/\b(hex inverter|schmitt trigger|flip[- ]?flop|shift register|binary counter|decade counter|nand gate|nor gate|xor gate|and gate|or gate|multiplexer|demultiplexer|decoder|encoder|bus transceiver|octal buffer|line driver)\b/.test(blob)) return m('ICs', 'Logic');
  if (/\b(optocoupler|opto-?isolator|photocoupler|optoisolator)\b/.test(blob)) return m('ICs', 'Optocoupler');
  if (/\bnpn\b/.test(blob)) return m('Transistors', 'BJT NPN');
  if (/\bpnp\b/.test(blob)) return m('Transistors', 'BJT PNP');
  if (/\b(n-?ch(?:annel)?|p-?ch(?:annel)?|power|trench|logic[- ]level)\b.{0,20}\bmosfet\b/.test(blob) || /\bmosfet\b.{0,20}\b(n-?ch|p-?ch|\d+v|\d+a)\b/.test(blob)) return m('Transistors', 'Power MOSFET');
  if (/\bigbt\b/.test(blob)) return m('Transistors', 'IGBT');
  if (/\bzener\b/.test(blob)) return m('Diodes', 'Zener');
  if (/\bschottky\b/.test(blob)) return m('Diodes', 'Schottky');
  if (/\b(rectifier diode|bridge rectifier|fast recovery|ultra fast)\b/.test(blob)) return m('Diodes', 'Rectifier');
  if (/\bled\b/.test(blob)) return m('LEDs', 'Indicator');
  if (/\b(pin header|jst|molex|terminal block|connector|konnekt[öo]r)\b/.test(blob)) return m('Connectors', 'Pin Header');
  if (/\b(crystal|kristal|oscillator|mhz|khz)\b/.test(blob)) return m('Crystals', 'Crystal');
  return null;
}

/** New or better category for parts that are uncategorized, or misfiled on strong evidence. */
export function categorizeSuggestions(parts: BulkPart[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const part of parts) {
    let hit: { category: string; subcategory: string } | null = null;
    let source: 'part-code' | 'opto' | 'description' | 'heuristic' = 'heuristic';
    let confidence: Confidence = 'low';
    const byCode = lookupComponent(part.part_code);
    if (byCode?.category) {
      hit = { category: byCode.category, subcategory: byCode.subcategory ?? '' };
      source = 'part-code';
      confidence = 'high';
    }
    if (isLikelyOptocoupler(part) && hit?.category !== 'ICs') {
      hit = { category: 'ICs', subcategory: 'Optocoupler' };
      source = 'opto';
      confidence = 'high';
    }
    if (!hit) {
      const d = categorizeByDescription(part.description || part.notes);
      if (d) {
        hit = d;
        source = 'description';
        confidence = 'medium';
      }
    }
    if (!hit) {
      const h = heuristicClassify(part);
      if (h) {
        hit = h;
        source = 'heuristic';
        confidence = h.confidence;
      }
    }
    if (!hit?.category || isUncategorized(hit.category)) continue;
    const target = normalizeCategory(hit.category);
    const current = isUncategorized(part.category) ? '' : normalizeCategory(part.category);
    if (!current) {
      out.push({ kind: 'categorize', part, category: target, subcategory: hit.subcategory, source, confidence, misfiled: false });
      continue;
    }
    // Already filed: only flag it on strong evidence from the part number.
    if (target === current) {
      if (hit.subcategory && !part.subcategory.trim() && confidence === 'high') {
        out.push({ kind: 'categorize', part, category: target, subcategory: hit.subcategory, source, confidence, misfiled: false });
      }
      continue;
    }
    if (confidence !== 'high' || source === 'description') continue;
    if (target === 'Transistors' && strongDiodeEvidence(part)) continue;
    const canon = lookupCanonical(part.part_code);
    if (source === 'part-code' && (!canon || canon.match === 'pattern')) {
      const h = heuristicClassify(part);
      if (!h?.partCodeBased) continue;
    }
    out.push({ kind: 'categorize', part, category: target, subcategory: hit.subcategory, source, confidence, misfiled: true });
  }
  return out;
}

/** Category spellings that mean a canonical one ("Diode", "diyot" -> Diodes). */
export function normalizeSuggestions(parts: BulkPart[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const part of parts) {
    if (isUncategorized(part.category)) continue;
    const canon = normalizeCategory(part.category);
    if (canon !== part.category) out.push({ kind: 'normalize', part, category: canon, confidence: 'high' });
  }
  return out;
}

/** Empty fields (and search-page datasheet links) the library knows for certain. */
export function enrichSuggestions(parts: BulkPart[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const part of parts) {
    const found = lookupCanonical(part.part_code);
    if (!isControlledDbMatch(part, found)) continue;
    const db = found!.data;
    const patch: Extract<Suggestion, { kind: 'enrich' }>['patch'] = {};
    if (db.datasheet_url && isWeakDatasheetUrl(part.datasheet_url)) patch.datasheet_url = db.datasheet_url;
    if (!part.description.trim() && db.description) patch.description = db.description;
    if (!part.manufacturer.trim() && db.manufacturer) patch.manufacturer = db.manufacturer;
    if (!part.package.trim() && db.package) patch.package = db.package;
    if (!part.subcategory.trim() && db.subcategory) patch.subcategory = db.subcategory;
    if (isUncategorized(part.category) && db.category) patch.category = normalizeCategory(db.category);
    if (Object.keys(patch).length) out.push({ kind: 'enrich', part, patch, confidence: found!.match === 'exact' ? 'high' : 'medium' });
  }
  return out;
}

/** Parts that are the same thing under different codes (7805, L7805, LM7805). */
export function mergeSuggestions(parts: BulkPart[]): Suggestion[] {
  const groups = new Map<string, BulkPart[]>();
  for (const part of parts) {
    const found = lookupCanonical(part.part_code);
    if (!found?.canonical || found.match === 'pattern' || !categoryConsistent(part, found.data)) continue;
    const list = groups.get(found.canonical) ?? [];
    list.push(part);
    groups.set(found.canonical, list);
  }
  const out: Suggestion[] = [];
  for (const [canonical, members] of groups) {
    if (members.length < 2) continue;
    out.push({ kind: 'merge', canonical, members, total: members.reduce((a, m) => a + m.quantity, 0), confidence: 'high' });
  }
  return out;
}

export function allSuggestions(parts: BulkPart[]): Suggestion[] {
  return [...mergeSuggestions(parts), ...normalizeSuggestions(parts), ...categorizeSuggestions(parts), ...enrichSuggestions(parts)];
}
