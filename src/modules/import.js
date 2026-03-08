import { upsertComponents, showToast, escHtml } from '../app.js';

// Normalize Turkish diacritics to ASCII for header matching
function asciiNormalize(str) {
  return str
    .replace(/[\u015f\u015e]/g, 's') // s with cedilla
    .replace(/[\u0131]/g, 'i')        // dotless i
    .replace(/[\u0130]/g, 'i')        // I with dot
    .replace(/[\u00f6\u00d6]/g, 'o') // o with umlaut
    .replace(/[\u00fc\u00dc]/g, 'u') // u with umlaut
    .replace(/[\u00e7\u00c7]/g, 'c') // c with cedilla
    .replace(/[\u011f\u011e]/g, 'g') // g with breve
    .replace(/[\u00e2\u00c2]/g, 'a') // a with circumflex
    .replace(/[\u00ee\u00ce]/g, 'i') // i with circumflex
    .replace(/[\u00fb\u00db]/g, 'u'); // u with circumflex
}

// Column header normalization map (English + Turkish variants)
// Covers inventory exports, order forms (siparis), BOM sheets, supplier lists.
const HEADER_MAP = {
  // ---- Part code ----
  'part_code': 'part_code', 'part code': 'part_code', 'partcode': 'part_code',
  'part': 'part_code', 'code': 'part_code', 'sku': 'part_code', 'item': 'part_code',
  'item code': 'part_code', 'item no': 'part_code', 'item number': 'part_code',
  'ref': 'part_code', 'reference': 'part_code', 'designator': 'part_code',
  'component': 'part_code',
  // Turkish
  'parca_kodu': 'part_code', 'parca kodu': 'part_code', 'parcakodu': 'part_code',
  'parcakod': 'part_code', 'parca': 'part_code',
  'urun_kodu': 'part_code', 'urun kodu': 'part_code', 'urunkodu': 'part_code',
  'urun no': 'part_code', 'urun_no': 'part_code',
  'malzeme kodu': 'part_code', 'malzeme_kodu': 'part_code', 'malzeme no': 'part_code',
  'stok kodu': 'part_code', 'stok_kodu': 'part_code', 'stokkodu': 'part_code',
  'siparis kodu': 'part_code', 'siparis_kodu': 'part_code',
  'katalog no': 'part_code', 'katalog_no': 'part_code', 'katalogno': 'part_code',
  'barkod': 'part_code', 'barcode': 'part_code',

  // ---- Category ----
  'category': 'category', 'cat': 'category', 'type': 'category', 'group': 'category',
  'component type': 'category',
  'kategori': 'category', 'kat': 'category', 'tur': 'category', 'grup': 'category',

  // ---- Subcategory ----
  'subcategory': 'subcategory', 'sub': 'subcategory', 'sub_category': 'subcategory',
  'sub category': 'subcategory', 'subcat': 'subcategory', 'subgroup': 'subcategory',
  'alt_kategori': 'subcategory', 'alt kategori': 'subcategory', 'altkategori': 'subcategory',
  'alt kat': 'subcategory', 'alt grup': 'subcategory',

  // ---- Quantity ----
  'quantity': 'quantity', 'qty': 'quantity', 'stock': 'quantity', 'count': 'quantity',
  'amount': 'quantity', 'units': 'quantity', 'stok': 'quantity',
  'ordered qty': 'quantity', 'order qty': 'quantity', 'siparis adedi': 'quantity',
  'adet': 'quantity', 'miktar': 'quantity', 'stok miktari': 'quantity',
  'toplam adet': 'quantity', 'net adet': 'quantity', 'kalan adet': 'quantity',
  'siparis miktari': 'quantity', 'talep miktari': 'quantity',

  // ---- Package ----
  'package': 'package', 'footprint': 'package', 'pkg': 'package', 'case': 'package',
  'housing': 'package', 'enclosure': 'package',
  'paket': 'package', 'kasa': 'package', 'ambalaj': 'package',

  // ---- Manufacturer ----
  'manufacturer': 'manufacturer', 'mfr': 'manufacturer', 'brand': 'manufacturer',
  'vendor': 'manufacturer', 'supplier': 'manufacturer', 'make': 'manufacturer',
  'mfgr': 'manufacturer', 'oem': 'manufacturer',
  'uretici': 'manufacturer', 'marka': 'manufacturer', 'firma': 'manufacturer',
  'tedarikci': 'manufacturer', 'tedarikçi': 'manufacturer',

  // ---- MPN ----
  'mpn': 'mpn', 'manufacturer part number': 'mpn', 'part number': 'mpn',
  'model': 'mpn', 'model number': 'mpn', 'mfr part number': 'mpn',
  'mfr pn': 'mpn', 'mfg pn': 'mpn', 'manufacturer pn': 'mpn',
  'uretici parca no': 'mpn', 'model no': 'mpn', 'seri no': 'mpn',
  'lot no': 'mpn',

  // ---- Location ----
  'location': 'location', 'bin': 'location', 'storage': 'location',
  'shelf': 'location', 'drawer': 'location', 'slot': 'location', 'rack': 'location',
  'warehouse': 'location', 'room': 'location',
  'konum': 'location', 'depo': 'location', 'raf': 'location', 'kutu': 'location',
  'gozde': 'location', 'bolme': 'location', 'dolap': 'location',
  'gonderi': 'location', 'teslimat yeri': 'location',

  // ---- Voltage ----
  'voltage_max': 'voltage_max', 'voltage max': 'voltage_max', 'vmax': 'voltage_max',
  'v max': 'voltage_max', 'max voltage': 'voltage_max', 'voltage': 'voltage_max',
  'rated voltage': 'voltage_max', 'working voltage': 'voltage_max',
  'gerilim': 'voltage_max', 'gerilim_max': 'voltage_max', 'gerilim max': 'voltage_max',
  'max gerilim': 'voltage_max', 'voltaj': 'voltage_max',

  // ---- Current ----
  'current_max': 'current_max', 'current max': 'current_max', 'imax': 'current_max',
  'i max': 'current_max', 'max current': 'current_max', 'current': 'current_max',
  'rated current': 'current_max',
  'akim': 'current_max', 'akim_max': 'current_max', 'akim max': 'current_max',
  'max akim': 'current_max',

  // ---- Description ----
  'description': 'description', 'desc': 'description', 'info': 'description',
  'details': 'description', 'specification': 'description', 'spec': 'description',
  'product name': 'description', 'product description': 'description', 'name': 'description',
  'aciklama': 'description', 'tanim': 'description', 'bilgi': 'description',
  'detay': 'description', 'urun adi': 'description', 'urun_adi': 'description',
  'mal adi': 'description', 'malzeme adi': 'description', 'komponent adi': 'description',
  'komponent': 'description',
  'malzeme tanimi': 'description', 'malzeme_tanimi': 'description',
  'urun tanimi': 'description', 'urun_tanimi': 'description',
  'stok tanimi': 'description', 'stok_tanimi': 'description',
  'parcaaciklamasi': 'description', 'parca aciklamasi': 'description',
  'urun aciklamasi': 'description', 'malzeme aciklamasi': 'description',

  // ---- Notes ----
  'notes': 'notes', 'note': 'notes', 'comment': 'notes', 'comments': 'notes',
  'remarks': 'notes', 'remark': 'notes', 'memo': 'notes',
  'not': 'notes', 'notlar': 'notes', 'yorum': 'notes', 'aciklamalar': 'notes',
  'gozlem': 'notes',

  // ---- Datasheet ----
  'datasheet_url': 'datasheet_url', 'datasheet': 'datasheet_url',
  'datasheet url': 'datasheet_url', 'ds url': 'datasheet_url', 'ds': 'datasheet_url',
  'url': 'datasheet_url', 'link': 'datasheet_url', 'pdf': 'datasheet_url',
  'pdf url': 'datasheet_url',

  // ---- Price ----
  'unit_price': 'unit_price', 'price': 'unit_price', 'unit price': 'unit_price',
  'cost': 'unit_price', 'unit cost': 'unit_price', 'each': 'unit_price',
  'birim fiyat': 'unit_price', 'fiyat': 'unit_price', 'birim maliyet': 'unit_price',
  'tl fiyat': 'unit_price', 'usd fiyat': 'unit_price', 'kdv haric fiyat': 'unit_price',
  'kdv haric birim fiyat': 'unit_price', 'kdvsiz fiyat': 'unit_price',
  'liste fiyati': 'unit_price', 'satis fiyati': 'unit_price',
  'net fiyat': 'unit_price', 'net birim fiyat': 'unit_price',
};

function normalizeHeader(h) {
  const ascii = asciiNormalize(h.toLowerCase().trim());
  return HEADER_MAP[ascii] || null;
}

// Detect CSV delimiter (comma or semicolon)
function detectDelimiter(text) {
  const firstLine = text.split(/[\r\n]/)[0];
  const commas    = (firstLine.match(/,/g) || []).length;
  const semis     = (firstLine.match(/;/g) || []).length;
  const tabs      = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function normalizeRows(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const mapped  = {};
  headers.forEach(h => {
    const norm = normalizeHeader(h);
    if (norm) mapped[h] = norm;
  });

  if (Object.keys(mapped).length === 0) return [];

  const hasPartCode = Object.values(mapped).includes('part_code');

  return rows
    .map((row, idx) => {
      const out = {};
      Object.entries(mapped).forEach(([orig, norm]) => {
        const val = row[orig];
        out[norm] = val !== undefined && val !== null ? String(val).trim() : '';
      });

      // Auto-generate part_code from description or sequential ID when not present
      if (!hasPartCode || !out.part_code) {
        if (out.description && out.description.length > 0) {
          // Derive a slug from description (first 24 chars, alphanumeric + dash)
          const slug = out.description
            .substring(0, 24)
            .replace(/[^a-zA-Z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toUpperCase();
          out.part_code = slug || `IMP-${String(idx + 1).padStart(4, '0')}`;
        } else {
          out.part_code = `IMP-${String(idx + 1).padStart(4, '0')}`;
        }
      }

      return out;
    })
    .filter(r => r.part_code && r.part_code.length > 0);
}

// Returns recognized headers for debug feedback
function getMappedHeaderNames(rows) {
  if (!rows || rows.length === 0) return { found: [], mapped: [] };
  const found = Object.keys(rows[0]);
  const mapped = found.filter(h => normalizeHeader(h) !== null);
  return { found, mapped };
}

// ============================================================
// Validation layer — annotates each row with _warnings and _errors
// ============================================================
const URL_RE = /^https?:\/\/.+/i;

function validateRows(rows) {
  let warnCount = 0;
  let errorCount = 0;

  const validated = rows.map(row => {
    const warnings = [];
    const errors   = [];

    if (!row.part_code || row.part_code.length > 64) {
      errors.push('part_code');
    }

    const qty = Number(row.quantity);
    if (row.quantity !== '' && (isNaN(qty) || qty < 0 || qty > 999999)) {
      warnings.push('quantity');
    }

    const vMax = Number(row.voltage_max);
    if (row.voltage_max !== '' && (isNaN(vMax) || vMax < 0 || vMax > 100000)) {
      warnings.push('voltage_max');
    }

    const iMax = Number(row.current_max);
    if (row.current_max !== '' && (isNaN(iMax) || iMax < 0 || iMax > 10000)) {
      warnings.push('current_max');
    }

    if (row.datasheet_url && !URL_RE.test(row.datasheet_url)) {
      warnings.push('datasheet_url');
    }

    const price = Number(row.unit_price);
    if (row.unit_price !== '' && (isNaN(price) || price < 0)) {
      warnings.push('unit_price');
    }

    warnCount  += warnings.length;
    errorCount += errors.length;

    return { ...row, _warnings: warnings, _errors: errors };
  });

  return { rows: validated, warnCount, errorCount };
}

// ============================================================
// CSV parser (RFC 4180, auto-detects delimiter)
// ============================================================
function parseCSV(text) {
  const delimiter = detectDelimiter(text);
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows  = [];

  function parseLine(line) {
    const fields = [];
    let cur     = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuote = false; }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === delimiter) { fields.push(cur); cur = ''; }
        else { cur += ch; }
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = parseLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseLine(lines[i]);
    const row    = {};
    headers.forEach((h, idx) => { row[h] = fields[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

// ============================================================
// Excel parser (SheetJS)
// Scans the first 20 rows to locate the actual header row.
// Uses a two-tier scoring system:
//   tier-1: direct HEADER_MAP match (score +3 per cell)
//   tier-2: text-like cell that isn't a number/date (score +1 per cell)
// The row with the highest composite score is treated as the header row.
// This handles supplier files (Özdisan, Mouser, Digi-Key, etc.) that have
// company/order metadata rows before the actual table headers.
// ============================================================
function excelRowScore(row) {
  let score = 0;
  for (const cell of row) {
    const v = String(cell ?? '').trim();
    if (!v || v.length > 80) continue;
    const norm = asciiNormalize(v.toLowerCase());
    if (HEADER_MAP[norm] !== undefined) {
      score += 3;
    } else if (isNaN(Number(v)) && !/^\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}$/.test(v)) {
      // Looks like a text label (not a number or a date pattern)
      score += 1;
    }
  }
  return score;
}

function parseExcel(arrayBuffer) {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS library not loaded.');
  }
  const workbook  = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];

  // Read entire sheet as raw 2D array — no header row assumption
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!raw || raw.length === 0) return [];

  const scanLimit  = Math.min(raw.length, 20);
  let bestRowIdx   = 0;
  let bestScore    = -1;

  for (let i = 0; i < scanLimit; i++) {
    const row = raw[i];
    if (!row || row.length === 0) continue;
    const nonEmpty = row.filter(c => String(c ?? '').trim()).length;
    if (nonEmpty < 2) continue;  // skip nearly-empty rows
    const score = excelRowScore(row);
    if (score > bestScore) {
      bestScore  = score;
      bestRowIdx = i;
    }
  }

  const headerRow = raw[bestRowIdx].map(c => String(c ?? '').trim());
  const dataRows  = raw.slice(bestRowIdx + 1);

  return dataRows
    .filter(row => row.some(c => String(c ?? '').trim()))
    .map(row => {
      const obj = {};
      headerRow.forEach((h, idx) => {
        if (h) obj[h] = String(row[idx] ?? '').trim();
      });
      return obj;
    });
}

// ============================================================
// PDF parser (PDF.js - text extraction)
// ============================================================
async function parsePDF(arrayBuffer) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js is not loaded. Make sure you are connected to the internet on first launch.');
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  const maxPages = Math.min(pdf.numPages, 30);
  for (let p = 1; p <= maxPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Preserve spacing between items to form readable lines
    const items   = content.items;
    let lineText  = '';
    let prevY     = null;
    for (const item of items) {
      const y = item.transform ? item.transform[5] : 0;
      if (prevY !== null && Math.abs(y - prevY) > 3) {
        lineText += '\n';
      } else if (lineText.length > 0 && !lineText.endsWith('\t')) {
        lineText += '\t';
      }
      lineText += item.str;
      prevY = y;
    }
    fullText += lineText + '\n';
  }

  // Try tab-separated first (better for columnar PDF data)
  const tabRows = parseCSVWithDelimiter(fullText, '\t');
  const tabNorm = normalizeRows(tabRows);
  if (tabNorm.length > 0) return tabNorm;

  // Fallback: try comma-separated
  const csvNorm = normalizeRows(parseCSV(fullText));
  if (csvNorm.length > 0) return csvNorm;

  return [];
}

function parseCSVWithDelimiter(text, delimiter) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows  = [];
  let headers = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = line.split(delimiter).map(f => f.trim());
    if (!headers) {
      headers = fields;
      continue;
    }
    if (fields.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = fields[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

// ============================================================
// Build preview table HTML — with validation highlight
// ============================================================
function buildPreviewHTML(rows) {
  if (!rows.length) return '<p style="color:var(--text-tertiary)">No recognizable rows found.</p>';

  const { rows: validated, warnCount, errorCount } = validateRows(rows);
  const sample = validated.slice(0, 8);
  const keys   = Object.keys(sample[0]).filter(k => !k.startsWith('_'));

  const summaryHtml = (warnCount + errorCount) > 0 ? `
    <div class="import-validation-summary">
      <span class="val-ok">&#10003; ${rows.length} rows</span>
      ${warnCount  > 0 ? `<span class="val-warn">&#9888; ${warnCount} warnings</span>`  : ''}
      ${errorCount > 0 ? `<span class="val-err">&#10007; ${errorCount} errors</span>`   : ''}
    </div>` : `<div class="import-validation-summary"><span class="val-ok">&#10003; ${rows.length} rows — no issues</span></div>`;

  const tableHtml = `<table>
    <thead><tr>${keys.map(k => `<th>${escHtml(k)}</th>`).join('')}</tr></thead>
    <tbody>${sample.map(r => {
      const cells = keys.map(k => {
        const cls = r._errors.includes(k) ? 'cell-error' : r._warnings.includes(k) ? 'cell-warn' : '';
        return `<td${cls ? ` class="${cls}"` : ''}>${escHtml(String(r[k] ?? ''))}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('')}
    </tbody>
  </table>`;

  return summaryHtml + tableHtml;
}

// ============================================================
// Import UI
// ============================================================
let _importRows = [];

export function initImport() {
  const dropZone   = document.getElementById('drop-zone');
  const fileInput  = document.getElementById('file-input');
  const browseBtn  = document.getElementById('btn-browse-file');
  const confirmBtn = document.getElementById('btn-confirm-import');

  browseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  browseBtn.addEventListener('click', e => e.stopPropagation());

  confirmBtn.addEventListener('click', async () => {
    if (!_importRows.length) return;
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    confirmBtn.disabled = true;
    try {
      await upsertComponents(_importRows, mode);
      showToast(`Imported ${_importRows.length} components (${mode} mode)`, 'success');
      document.getElementById('overlay-import').style.display = 'none';
      resetImportUI();
    } catch (err) {
      showToast('Import failed: ' + (err.message || err), 'error');
    } finally {
      confirmBtn.disabled = false;
    }
  });
}

async function handleFile(file) {
  const ext    = file.name.split('.').pop().toLowerCase();
  let rawRows  = [];
  let normalized = [];

  try {
    if (ext === 'csv') {
      const text = await file.text();
      rawRows    = parseCSV(text);
      normalized = normalizeRows(rawRows);

      if (normalized.length === 0) {
        const { found } = getMappedHeaderNames(rawRows);
        showToast(
          `No recognized columns in CSV. Found headers: ${found.slice(0, 6).join(', ')}`,
          'warning',
          10000
        );
        return;
      }
    } else if (ext === 'json') {
      const text   = await file.text();
      const parsed = JSON.parse(text);
      rawRows      = Array.isArray(parsed) ? parsed : [];
      normalized   = normalizeRows(rawRows);
      if (normalized.length === 0 && rawRows.length > 0) {
        // JSON might already have correct field names
        normalized = rawRows.filter(r => r.part_code);
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buf  = await file.arrayBuffer();
      rawRows    = parseExcel(buf);
      normalized = normalizeRows(rawRows);
      if (normalized.length === 0 && rawRows.length > 0) {
        const foundCols = Object.keys(rawRows[0] || {}).slice(0, 6).join(', ');
        showToast(
          `Column headers not recognized. Detected columns: ${foundCols || '(empty)'}. ` +
          `Try renaming headers to: Stok Kodu, Urun Adi, Adet, Birim Fiyat.`,
          'warning',
          12000
        );
        return;
      }
    } else if (ext === 'pdf') {
      const buf  = await file.arrayBuffer();
      normalized = await parsePDF(buf);
      if (normalized.length === 0) {
        showToast(
          'PDF import: no structured table data found. PDFs must contain text-based tables with recognized column headers.',
          'warning',
          8000
        );
        return;
      }
    } else {
      showToast('Unsupported file type. Use CSV, JSON, Excel (.xlsx), or PDF.', 'error');
      return;
    }
  } catch (err) {
    showToast('Failed to parse file: ' + (err.message || err), 'error');
    return;
  }

  if (normalized.length === 0) {
    showToast('No valid component rows found. Check column headers.', 'warning');
    return;
  }

  _importRows = normalized;
  document.getElementById('import-filename').textContent  = file.name;
  document.getElementById('import-row-count').textContent = `${normalized.length} rows`;
  document.getElementById('table-preview').innerHTML      = buildPreviewHTML(normalized);
  document.getElementById('import-preview').style.display = '';
  document.getElementById('btn-confirm-import').disabled  = false;
}

function resetImportUI() {
  _importRows = [];
  document.getElementById('file-input').value             = '';
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('btn-confirm-import').disabled  = true;
}
