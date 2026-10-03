/**
 * Column mapping and cleaning for table imports (CSV, Excel, PDF tables). Ported from the old app's
 * import_core.js: one header map, Turkish and English, ASCII-folded.
 */
import { isDiscardableImportRow, isPlaceholderPartCode, resolvePartCodeFromRow } from './importFixup';

export type ImportField =
  | 'part_code' | 'category' | 'subcategory' | 'quantity' | 'package' | 'manufacturer' | 'preferred_supplier'
  | 'mpn' | 'location' | 'voltage_max' | 'current_max' | 'description' | 'notes' | 'datasheet_url' | 'unit_price';

export const IMPORT_FIELDS: ImportField[] = [
  'part_code', 'description', 'quantity', 'category', 'subcategory', 'package', 'manufacturer', 'mpn',
  'preferred_supplier', 'location', 'voltage_max', 'current_max', 'datasheet_url', 'unit_price', 'notes',
];

export type RawRow = Record<string, string>;
export type MappedRow = Partial<Record<ImportField, string>>;

export const HEADER_MAP: Record<string, ImportField> = {
  'part_code': 'part_code', 'part code': 'part_code', 'partcode': 'part_code',
  'part': 'part_code', 'code': 'part_code', 'sku': 'part_code', 'item': 'part_code',
  'item code': 'part_code', 'item no': 'part_code', 'item number': 'part_code',
  'ref': 'part_code', 'reference': 'part_code', 'designator': 'part_code',
  'component': 'part_code',
  'parca_kodu': 'part_code', 'parca kodu': 'part_code', 'parcakodu': 'part_code',
  'parcakod': 'part_code', 'parca': 'part_code',
  'urun_kodu': 'part_code', 'urun kodu': 'part_code', 'urunkodu': 'part_code',
  'urun no': 'part_code', 'urun_no': 'part_code',
  'malzeme kodu': 'part_code', 'malzeme_kodu': 'part_code', 'malzeme no': 'part_code',
  'stok kodu': 'part_code', 'stok_kodu': 'part_code', 'stokkodu': 'part_code',
  'siparis kodu': 'part_code', 'siparis_kodu': 'part_code',
  'katalog no': 'part_code', 'katalog_no': 'part_code', 'katalogno': 'part_code',
  'barkod': 'part_code', 'barcode': 'part_code',
  'category': 'category', 'cat': 'category', 'type': 'category', 'group': 'category',
  'component type': 'category',
  'kategori': 'category', 'kat': 'category', 'tur': 'category', 'grup': 'category',
  'subcategory': 'subcategory', 'sub': 'subcategory', 'sub_category': 'subcategory',
  'sub category': 'subcategory', 'subcat': 'subcategory', 'subgroup': 'subcategory',
  'alt_kategori': 'subcategory', 'alt kategori': 'subcategory', 'altkategori': 'subcategory',
  'alt kat': 'subcategory', 'alt grup': 'subcategory',
  'quantity': 'quantity', 'qty': 'quantity', 'stock': 'quantity', 'count': 'quantity',
  'amount': 'quantity', 'units': 'quantity', 'stok': 'quantity', 'ordered qty': 'quantity',
  'order qty': 'quantity', 'siparis adedi': 'quantity', 'adet': 'quantity', 'miktar': 'quantity',
  'stok miktari': 'quantity', 'toplam adet': 'quantity', 'net adet': 'quantity',
  'kalan adet': 'quantity', 'siparis miktari': 'quantity', 'talep miktari': 'quantity',
  'package': 'package', 'footprint': 'package', 'pkg': 'package', 'case': 'package',
  'housing': 'package', 'enclosure': 'package', 'paket': 'package', 'kasa': 'package',
  'manufacturer': 'manufacturer', 'mfr': 'manufacturer', 'brand': 'manufacturer',
  'make': 'manufacturer', 'mfgr': 'manufacturer',
  'uretici': 'manufacturer', 'marka': 'manufacturer', 'firma': 'manufacturer',
  'tedarikci': 'preferred_supplier', 'supplier': 'preferred_supplier', 'vendor': 'preferred_supplier',
  'satici': 'preferred_supplier', 'magaza': 'preferred_supplier',
  'mpn': 'mpn', 'manufacturer part number': 'mpn', 'part number': 'mpn', 'model': 'mpn',
  'model no': 'mpn', 'model number': 'mpn', 'mfr part number': 'mpn', 'mfr pn': 'mpn',
  'uretici parca no': 'mpn', 'uretici parca kodu': 'mpn', 'uretici kodu': 'mpn',
  'manufacturer code': 'mpn',
  'parca numarasi': 'mpn', 'parca no': 'mpn',
  'location': 'location', 'bin': 'location', 'storage': 'location', 'shelf': 'location',
  'drawer': 'location', 'slot': 'location', 'rack': 'location', 'warehouse': 'location',
  'konum': 'location', 'depo': 'location', 'raf': 'location', 'kutu': 'location',
  'voltage_max': 'voltage_max', 'voltage max': 'voltage_max', 'vmax': 'voltage_max',
  'v max': 'voltage_max', 'max voltage': 'voltage_max', 'voltage': 'voltage_max',
  'gerilim': 'voltage_max', 'gerilim_max': 'voltage_max', 'gerilim max': 'voltage_max',
  'current_max': 'current_max', 'current max': 'current_max', 'imax': 'current_max',
  'i max': 'current_max', 'max current': 'current_max', 'current': 'current_max',
  'akim': 'current_max', 'akim_max': 'current_max', 'akim max': 'current_max',
  'description': 'description', 'desc': 'description', 'info': 'description', 'details': 'description',
  'specification': 'description', 'spec': 'description', 'product name': 'description',
  'product description': 'description', 'product_name': 'description',
  'name': 'description', 'aciklama': 'description', 'tanim': 'description', 'bilgi': 'description',
  'urun adi': 'description', 'urun_adi': 'description', 'urun tanimi': 'description', 'urun_tanimi': 'description',
  'malzeme adi': 'description', 'malzeme_adi': 'description', 'malzeme tanimi': 'description', 'malzeme_tanimi': 'description',
  'stok adi': 'description', 'stok_adi': 'description', 'stok tanimi': 'description', 'stok_tanimi': 'description',
  'urun bilgisi': 'description', 'urun_bilgisi': 'description', 'malzeme cinsi': 'category', 'urun grubu': 'category',
  'urun tipi': 'category', 'cins': 'category', 'tip': 'category',
  'olcu': 'package', 'olculer': 'package', 'boyut': 'package', 'kilif': 'package',
  'notes': 'notes', 'note': 'notes', 'comment': 'notes', 'comments': 'notes', 'remarks': 'notes',
  'not': 'notes', 'notlar': 'notes', 'yorum': 'notes',
  'datasheet_url': 'datasheet_url', 'datasheet': 'datasheet_url', 'datasheet url': 'datasheet_url',
  'unit_price': 'unit_price', 'price': 'unit_price', 'unit price': 'unit_price',
  'cost': 'unit_price', 'unit cost': 'unit_price', 'birim fiyat': 'unit_price', 'fiyat': 'unit_price',
  // merged from the former import.js copy
  'ambalaj': 'package', 'oem': 'manufacturer', 'mfg pn': 'mpn', 'manufacturer pn': 'mpn', 'room': 'location', 'gozde': 'location', 'bolme': 'location', 'dolap': 'location', 'rated voltage': 'voltage_max', 'working voltage': 'voltage_max', 'max gerilim': 'voltage_max', 'voltaj': 'voltage_max', 'rated current': 'current_max', 'max akim': 'current_max', 'detay': 'description', 'mal adi': 'description', 'komponent adi': 'description', 'komponent': 'description', 'parcaaciklamasi': 'description', 'parca aciklamasi': 'description', 'urun aciklamasi': 'description', 'malzeme aciklamasi': 'description', 'remark': 'notes', 'memo': 'notes', 'aciklamalar': 'notes', 'gozlem': 'notes', 'ds url': 'datasheet_url', 'ds': 'datasheet_url', 'pdf': 'datasheet_url', 'pdf url': 'datasheet_url', 'each': 'unit_price', 'birim maliyet': 'unit_price', 'tl fiyat': 'unit_price', 'usd fiyat': 'unit_price', 'kdv haric fiyat': 'unit_price', 'kdv haric birim fiyat': 'unit_price', 'kdvsiz fiyat': 'unit_price', 'liste fiyati': 'unit_price', 'satis fiyati': 'unit_price', 'net fiyat': 'unit_price', 'net birim fiyat': 'unit_price',
};

export function asciiNormalize(str: string): string {
  return str
    .replace(/[\u015f\u015e]/g, 's')
    .replace(/[\u0131]/g, 'i')
    .replace(/[\u0130]/g, 'i')
    .replace(/[\u00f6\u00d6]/g, 'o')
    .replace(/[\u00fc\u00dc]/g, 'u')
    .replace(/[\u00e7\u00c7]/g, 'c')
    .replace(/[\u011f\u011e]/g, 'g')
    .replace(/[\u00e2\u00c2]/g, 'a')
    .replace(/[\u00ee\u00ce]/g, 'i')
    .replace(/[\u00fb\u00db]/g, 'u');
}

export function normalizeHeader(h: string): ImportField | null {
  const ascii = asciiNormalize(String(h).toLowerCase().trim()).replace(/[:*]+$/, '').trim();
  return HEADER_MAP[ascii] ?? null;
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/[\r\n]/)[0] ?? '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

/** Which source column feeds which field. Built from the headers, editable on the review screen. */
export type ColumnMap = Record<string, ImportField | null>;

export function guessColumnMap(rows: RawRow[]): ColumnMap {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const map: ColumnMap = {};
  for (const h of headers) map[h] = normalizeHeader(h);
  return map;
}

/** Applies a column map. Several columns may feed one field (sheets with different headers); the
 *  first non-empty one, in column order, wins. Rows without any mapped value are dropped. */
export function applyColumnMap(rows: RawRow[], map: ColumnMap): MappedRow[] {
  const mappedKeys = Object.keys(map).filter((k) => map[k]);
  const hasPartCode = Object.values(map).includes('part_code');
  const out: MappedRow[] = [];
  rows.forEach((row) => {
    const r: MappedRow = {};
    for (const k of mappedKeys) {
      const f = map[k]!;
      const v = String(row[k] ?? '').trim();
      if (!r[f]) r[f] = v;
    }
    const resolved = resolvePartCodeFromRow(r, row, mappedKeys);
    if (resolved) r.part_code = resolved;
    else if (!hasPartCode || !r.part_code) r.part_code = '';
    if (r.mpn && isPlaceholderPartCode(r.part_code ?? '') && !isPlaceholderPartCode(r.mpn)) r.part_code = r.mpn;
    if (Object.values(r).every((v) => !v)) return;
    if (isDiscardableImportRow(r)) return;
    out.push(r);
  });
  return out;
}

const SUMMARY_LABEL_RE =
  /^(ara\s*toplam|genel\s*toplam|toplam(\s*tutar)?|kdv(\s*(toplam|tutari|dahil|haric))?|kargo(\s*(ucreti|tutari|bedeli))?|indirim|odenecek(\s*tutar)?|sub\s*total|subtotal|grand\s*total|total|shipping|tax|vat|discount)(\s*\(.*\))?$/;

export function isSummaryRow(cells: unknown[]): boolean {
  return cells.some((c) => {
    const v = asciiNormalize(String(c ?? '').toLowerCase()).replace(/[:.]+$/, '').trim();
    return v !== '' && SUMMARY_LABEL_RE.test(v);
  });
}

/** PDF table rows: repeated page headers are dropped and the table ends at the first totals row. */
export function cropPdfTableRows(rows: RawRow[]): RawRow[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]!);
  const out: RawRow[] = [];
  for (const row of rows) {
    const cells = headers.map((h) => row[h]);
    if (isSummaryRow(cells)) break;
    const repeated = headers.filter((h) => h && String(row[h] ?? '').trim().toLowerCase() === h.toLowerCase()).length;
    if (repeated >= 2) continue;
    out.push(row);
  }
  return out;
}

/** Scores a candidate header row: +3 for a known header, +1 for a text-like cell. */
export function headerRowScore(cells: unknown[]): number {
  let score = 0;
  for (const cell of cells) {
    const v = String(cell ?? '').trim();
    if (!v || v.length > 80) continue;
    if (normalizeHeader(v)) score += 3;
    else if (Number.isNaN(Number(v)) && !/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(v)) score += 1;
  }
  return score;
}

/** Turns a 2-D table (array of rows) into header-keyed rows, finding the header in the first 20 rows. */
export function tableToRows(table: unknown[][]): { rows: RawRow[]; recognized: number } {
  if (!table.length) return { rows: [], recognized: 0 };
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(table.length, 20); i++) {
    const row = table[i] ?? [];
    if (row.filter((c) => String(c ?? '').trim()).length < 2) continue;
    const s = headerRowScore(row);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  const header = (table[best] ?? []).map((c, i) => String(c ?? '').trim() || `Column ${i + 1}`);
  const recognized = header.filter((h) => normalizeHeader(h)).length;
  const rows = table
    .slice(best + 1)
    .filter((r) => r.some((c) => String(c ?? '').trim()))
    .map((r) => {
      const o: RawRow = {};
      header.forEach((h, i) => {
        o[h] = String(r[i] ?? '').trim();
      });
      return o;
    });
  return { rows, recognized };
}
