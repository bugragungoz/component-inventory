import {
  resolvePartCodeFromRow,
  isDiscardableImportRow,
  isPlaceholderPartCode,
} from './import_fixup.js';

const HEADER_MAP = {
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
  'vendor': 'manufacturer', 'supplier': 'manufacturer', 'make': 'manufacturer', 'mfgr': 'manufacturer',
  'uretici': 'manufacturer', 'marka': 'manufacturer', 'firma': 'manufacturer',
  'tedarikci': 'manufacturer', 'tedarikçi': 'manufacturer',
  'mpn': 'mpn', 'manufacturer part number': 'mpn', 'part number': 'mpn', 'model': 'mpn',
  'model no': 'mpn', 'model number': 'mpn', 'mfr part number': 'mpn', 'mfr pn': 'mpn',
  'uretici parca no': 'mpn', 'uretici parca kodu': 'mpn', 'uretici kodu': 'mpn',
  'manufacturer code': 'mpn', 'vendor pn': 'mpn', 'supplier pn': 'mpn',
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
  'url': 'datasheet_url', 'link': 'datasheet_url',
  'unit_price': 'unit_price', 'price': 'unit_price', 'unit price': 'unit_price',
  'cost': 'unit_price', 'unit cost': 'unit_price', 'birim fiyat': 'unit_price', 'fiyat': 'unit_price',
};

export function asciiNormalize(str) {
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

export function normalizeHeader(h) {
  const ascii = asciiNormalize(h.toLowerCase().trim());
  return HEADER_MAP[ascii] || null;
}

export function detectDelimiter(text) {
  const firstLine = text.split(/[\r\n]/)[0];
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

export function normalizeRowsCore(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const mapped = {};
  headers.forEach(h => {
    const norm = normalizeHeader(h);
    if (norm) mapped[h] = norm;
  });
  if (Object.keys(mapped).length === 0) return [];
  const hasPartCode = Object.values(mapped).includes('part_code');
  const mappedOrigKeys = Object.keys(mapped);

  return rows.map((row, idx) => {
    const out = {};
    Object.entries(mapped).forEach(([orig, norm]) => {
      const val = row[orig];
      out[norm] = val !== undefined && val !== null ? String(val).trim() : '';
    });

    const resolved = resolvePartCodeFromRow(out, row, mappedOrigKeys);
    if (resolved) {
      out.part_code = resolved;
    } else if (!hasPartCode) {
      out.part_code = `IMP-${String(idx + 1).padStart(4, '0')}`;
    } else if (!out.part_code) {
      out.part_code = `IMP-${String(idx + 1).padStart(4, '0')}`;
    }

    if (out.mpn && isPlaceholderPartCode(out.part_code) && !isPlaceholderPartCode(out.mpn)) {
      out.part_code = out.mpn;
    }

    return out;
  }).filter(r => {
    if (!r.part_code || !String(r.part_code).trim().length) return false;
    if (isDiscardableImportRow(r)) return false;
    return true;
  });
}

export function getMappedHeaderNamesCore(rows) {
  if (!rows || rows.length === 0) return { found: [], mapped: [] };
  const found = Object.keys(rows[0]);
  const mapped = found.filter(h => normalizeHeader(h) !== null);
  return { found, mapped };
}

export function validateRowsCore(rows, parseNumber) {
  const URL_RE = /^https?:\/\/.+/i;
  let warnCount = 0;
  let errorCount = 0;
  const warnReasons = {};
  const validated = rows.map(row => {
    const warnings = [];
    const errors = [];
    if (!row.part_code || row.part_code.length > 64) errors.push('part_code');
    const qty = parseNumber(row.quantity);
    if (row.quantity && row.quantity !== '' && (qty === null || qty < 0 || qty > 999999)) warnings.push('quantity');
    const vMax = parseNumber(row.voltage_max);
    if (row.voltage_max && row.voltage_max !== '' && (vMax === null || vMax < 0 || vMax > 100000)) warnings.push('voltage_max');
    const iMax = parseNumber(row.current_max);
    if (row.current_max && row.current_max !== '' && (iMax === null || iMax < 0 || iMax > 10000)) warnings.push('current_max');
    if (row.datasheet_url && !URL_RE.test(row.datasheet_url)) warnings.push('datasheet_url');
    const price = parseNumber(row.unit_price);
    if (row.unit_price && row.unit_price !== '' && (price === null || price < 0)) warnings.push('unit_price');
    warnings.forEach(k => { warnReasons[k] = (warnReasons[k] || 0) + 1; });
    warnCount += warnings.length;
    errorCount += errors.length;
    return { ...row, _warnings: warnings, _errors: errors };
  });
  return { rows: validated, warnCount, errorCount, warnReasons };
}
