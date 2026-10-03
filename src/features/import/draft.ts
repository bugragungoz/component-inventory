/**
 * The review draft: every line the owner sees before anything is written. Pure (no DOM, no Tauri),
 * so the rules are unit-tested. A line carries the count it read, the pack size, *why* the piece
 * count is what it is, and anything that needs a look.
 */
import { packFromName, shopLabel, SHOPS, type CleanPayload } from '@cinv/core';
import type { ImportRow, LibraryPart } from '../../api/types';
import { heuristicClassify } from '../../domain/bulk';
import { lookupComponent } from '../../domain/classify/datasheetDb';
import { applyColumnMap, type ColumnMap, type RawRow } from '../../domain/importCore';
import { extractMpnFromText } from '../../domain/importFixup';
import { parseLocaleNumber, parseQuantity } from '../../domain/number';
import { normalizeCategory } from '../../domain/taxonomy';

export type SourceKind = 'csv' | 'xlsx' | 'pdf' | 'cinv' | 'link';

/** Why a number is what it is, or what needs a look. Shown translated (import.reason.<code>). */
export type Reason =
  | { code: 'read-from'; column: string }
  | { code: 'pack-rule'; size: number }
  | { code: 'pack-extension'; size: number }
  | { code: 'pack-edited'; size: number }
  | { code: 'per-piece' }
  | { code: 'note'; text: string };

export type Issue =
  | { code: 'no-quantity'; raw: string }
  | { code: 'not-whole'; raw: string }
  | { code: 'no-code' }
  | { code: 'name-as-code' }
  | { code: 'code-from-name' }
  | { code: 'shop-code'; code_: string }
  | { code: 'filled-library'; source: string }
  | { code: 'duplicate'; count: number };

export interface DraftRow {
  key: string;
  include: boolean;
  part_code: string;
  /** What the source called it (product name, description). */
  name: string;
  units: number | null;
  pack: number;
  category: string;
  subcategory: string;
  package: string;
  manufacturer: string;
  mpn: string;
  location: string;
  preferred_supplier: string;
  description: string;
  datasheet_url: string;
  notes: string;
  unit_price: number | null;
  voltage_max: number | null;
  current_max: number | null;
  url: string;
  why: Reason[];
  issues: Issue[];
}

export interface Draft {
  label: string;
  kind: SourceKind;
  rows: DraftRow[];
  /** Table sources keep the raw rows and the column map so the owner can change the mapping. */
  table?: { raw: RawRow[]; map: ColumnMap; columns: string[] } | undefined;
  /** Lines the source had but could not read (reported, never guessed). */
  skipped: number;
  site?: string | undefined;
}

let seq = 0;
const nextKey = () => `r${++seq}`;

function blankRow(): DraftRow {
  return {
    key: nextKey(), include: true, part_code: '', name: '', units: null, pack: 1, category: '', subcategory: '', package: '', manufacturer: '',
    mpn: '', location: '', preferred_supplier: '', description: '', datasheet_url: '', notes: '', unit_price: null, voltage_max: null,
    current_max: null, url: '', why: [], issues: [],
  };
}

/** A part without a part number (a screwdriver, a module) is stored under its name. */
export function nameAsCode(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, 128);
}

/** Pieces this line adds: units x pack, or null when the count could not be read. */
export function pieces(r: DraftRow): number | null {
  return r.units === null ? null : r.units * r.pack;
}

export function needsLook(r: DraftRow): boolean {
  return r.issues.some((i) => i.code === 'no-quantity' || i.code === 'not-whole' || i.code === 'no-code' || i.code === 'name-as-code' || i.code === 'code-from-name' || i.code === 'shop-code');
}

/** Rows from a table (CSV, Excel, a PDF table) through the column map. */
export function draftFromTable(raw: RawRow[], map: ColumnMap, kind: SourceKind, label: string, site?: string): Draft {
  const columns = [...new Set(raw.flatMap((r) => Object.keys(r)))];
  const qtyColumn = Object.keys(map).find((k) => map[k] === 'quantity') ?? null;
  const rows: DraftRow[] = [];
  for (const m of applyColumnMap(raw, map)) {
    const r = blankRow();
    r.part_code = (m.part_code ?? '').trim();
    r.name = (m.description ?? '').trim();
    r.description = r.name;
    r.category = m.category ? normalizeCategory(m.category) : '';
    r.subcategory = m.subcategory ?? '';
    r.package = m.package ?? '';
    r.manufacturer = m.manufacturer ?? '';
    r.mpn = m.mpn ?? '';
    r.location = m.location ?? '';
    r.preferred_supplier = m.preferred_supplier ?? '';
    r.datasheet_url = /^https?:\/\//i.test(m.datasheet_url ?? '') ? m.datasheet_url! : '';
    r.notes = m.notes ?? '';
    r.unit_price = parseLocaleNumber(m.unit_price);
    r.voltage_max = parseLocaleNumber(m.voltage_max);
    r.current_max = parseLocaleNumber(m.current_max);
    const rawQty = (m.quantity ?? '').trim();
    const q = rawQty ? parseQuantity(rawQty) : null;
    if (!qtyColumn) {
      r.units = 1;
      r.why.push({ code: 'per-piece' });
      r.issues.push({ code: 'no-quantity', raw: '' });
    } else if (q === null || q < 0) {
      r.units = null;
      r.issues.push({ code: 'no-quantity', raw: rawQty });
    } else if (!Number.isInteger(q)) {
      r.units = Math.round(q);
      r.issues.push({ code: 'not-whole', raw: rawQty });
    } else {
      r.units = q;
      r.why.push({ code: 'read-from', column: qtyColumn });
    }
    const rule = site ? packFromName(site, r.name) : null;
    if (rule) {
      r.pack = rule.size;
      r.why.push({ code: 'pack-rule', size: rule.size });
    }
    if (site && !r.preferred_supplier) r.preferred_supplier = shopLabel(site);
    if (r.part_code && !Object.values(map).includes('part_code')) r.issues.push({ code: 'code-from-name' });
    if (!r.part_code) {
      const fromName = extractMpnFromText(r.name);
      if (fromName) {
        r.part_code = fromName;
        r.issues.push({ code: 'code-from-name' });
      } else if (r.name) {
        // Without the pack wording, so the next order of another pack size finds the same part.
        r.part_code = nameAsCode(rule?.base || r.name);
        r.issues.push({ code: 'name-as-code' });
      } else r.issues.push({ code: 'no-code' });
    }
    rows.push(r);
  }
  markDuplicates(rows);
  return { label, kind, rows, table: { raw, map, columns }, skipped: 0, site };
}

/** Rows from the extension (a .cinv.json file or a deep link). */
export function draftFromCinv(p: CleanPayload, kind: 'cinv' | 'link', dropped: number): Draft {
  const shop = SHOPS.find((s) => s.id === p.source.site) ?? null;
  const rows = p.items.map((item) => {
    const r = blankRow();
    r.name = item.name;
    r.description = item.name;
    r.url = item.url;
    r.units = item.qty;
    r.preferred_supplier = shop ? shop.label : p.source.site ? shopLabel(p.source.site) : '';
    r.category = item.category ? normalizeCategory(item.category) : '';
    const fromName = extractMpnFromText(item.name);
    if (item.code && !(shop?.skuIsStockCode ?? false)) {
      r.part_code = item.code;
    } else if (fromName) {
      r.part_code = fromName;
      r.issues.push({ code: 'code-from-name' });
      if (item.code) r.notes = `${r.preferred_supplier}: ${item.code}`;
    } else if (item.name) {
      r.part_code = nameAsCode(packFromName(p.source.site, item.name)?.base || item.name);
      r.issues.push({ code: 'name-as-code' });
      if (item.code) r.notes = `${r.preferred_supplier}: ${item.code}`;
    } else if (item.code) {
      r.part_code = item.code;
      r.issues.push({ code: 'shop-code', code_: item.code });
    } else {
      r.issues.push({ code: 'no-code' });
    }
    if (item.packSize > 1) {
      r.pack = item.packSize;
      r.why.push({ code: 'pack-extension', size: item.packSize });
    } else {
      const rule = packFromName(p.source.site, item.name);
      if (rule) {
        r.pack = rule.size;
        r.why.push({ code: 'pack-rule', size: rule.size });
      } else {
        r.why.push({ code: 'per-piece' });
      }
    }
    if (item.note) r.why.push({ code: 'note', text: item.note });
    return r;
  });
  markDuplicates(rows);
  return { label: p.source.site ? shopLabel(p.source.site) : 'cinv', kind, rows, skipped: p.skipped + dropped, site: p.source.site };
}

/** The same code twice in one import is summed when written; say so on each line. */
export function markDuplicates(rows: DraftRow[]): void {
  const count = new Map<string, number>();
  for (const r of rows) {
    if (!r.part_code) continue;
    const k = r.part_code.toUpperCase();
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  for (const r of rows) {
    r.issues = r.issues.filter((i) => i.code !== 'duplicate');
    const n = r.part_code ? count.get(r.part_code.toUpperCase()) ?? 0 : 0;
    if (n > 1) r.issues.push({ code: 'duplicate', count: n });
  }
}

/** Fills empty fields from the parts library (by code) and the built-in rules, as suggestions. */
export function enrich(rows: DraftRow[], library: Array<LibraryPart | null>): DraftRow[] {
  return rows.map((r, i) => {
    const lib = library[i] ?? null;
    const rule = lib ? null : lookupComponent(r.part_code);
    const hint = lib ?? rule;
    if (!hint) return guessCategory(r);
    const out = { ...r, issues: r.issues.slice() };
    let filled = false;
    const fill = (k: 'subcategory' | 'package' | 'manufacturer' | 'datasheet_url', v: string | undefined) => {
      if (v && !out[k]) {
        out[k] = v;
        filled = true;
      }
    };
    if (hint.category && !out.category) {
      out.category = normalizeCategory(hint.category);
      filled = true;
    }
    fill('subcategory', hint.subcategory);
    fill('package', hint.package);
    fill('manufacturer', hint.manufacturer);
    fill('datasheet_url', hint.datasheet_url);
    if (lib?.mpn && !out.mpn) out.mpn = lib.mpn;
    if (hint.description && !out.description) out.description = hint.description;
    if (out.voltage_max === null && hint.voltage_max != null) out.voltage_max = hint.voltage_max;
    if (out.current_max === null && hint.current_max != null) out.current_max = hint.current_max;
    if (filled) out.issues.push({ code: 'filled-library', source: lib ? 'library' : 'rules' });
    return out.category ? out : guessCategory(out);
  });
}

/** A category from the name when nothing else knew it ("91K 603 SMD Direnç" is an SMD resistor). */
function guessCategory(r: DraftRow): DraftRow {
  if (r.category) return r;
  const h = heuristicClassify({ id: 0, part_code: r.part_code, category: '', subcategory: '', description: r.name || r.description, manufacturer: r.manufacturer,
    package: r.package, notes: '', datasheet_url: '', quantity: 0 });
  if (!h) return r;
  return { ...r, category: normalizeCategory(h.category), subcategory: r.subcategory || h.subcategory, issues: [...r.issues, { code: 'filled-library', source: 'rules' }] };
}

/** What goes to the Rust side: included lines with a code and a count. */
export function toImportRows(rows: DraftRow[]): ImportRow[] {
  return rows
    .filter((r) => r.include && r.part_code.trim() && r.units !== null && r.units > 0)
    .map((r) => ({
      part_code: r.part_code.trim(),
      quantity: r.units! * r.pack,
      category: r.category, subcategory: r.subcategory, package: r.package, manufacturer: r.manufacturer, mpn: r.mpn, location: r.location,
      preferred_supplier: r.preferred_supplier, description: r.description, datasheet_url: r.datasheet_url, notes: r.notes, resistance: '', tolerance: '',
      voltage_max: r.voltage_max, current_max: r.current_max, power_rating: null, unit_price: r.unit_price,
    }));
}

export function totals(rows: DraftRow[]): { lines: number; pieces: number; excluded: number; unreadable: number; check: number } {
  let lines = 0;
  let total = 0;
  let excluded = 0;
  let unreadable = 0;
  let check = 0;
  for (const r of rows) {
    if (!r.include) {
      excluded++;
      continue;
    }
    if (r.units === null || !r.part_code.trim()) {
      unreadable++;
      continue;
    }
    lines++;
    total += r.units * r.pack;
    if (needsLook(r)) check++;
  }
  return { lines, pieces: total, excluded, unreadable, check };
}

