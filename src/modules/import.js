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
const HEADER_MAP = {
  // Part code - English
  'part_code': 'part_code', 'part code': 'part_code', 'partcode': 'part_code',
  'part': 'part_code', 'code': 'part_code', 'sku': 'part_code', 'item': 'part_code',
  // Part code - Turkish (ASCII normalized)
  'parca_kodu': 'part_code', 'parca kodu': 'part_code', 'parcakodu': 'part_code',
  'parcakod': 'part_code', 'parca': 'part_code', 'urun_kodu': 'part_code',
  'urun kodu': 'part_code', 'malzeme kodu': 'part_code', 'malzeme_kodu': 'part_code',

  // Category - English
  'category': 'category', 'cat': 'category', 'type': 'category',
  // Category - Turkish
  'kategori': 'category', 'kat': 'category', 'tur': 'category',

  // Subcategory - English
  'subcategory': 'subcategory', 'sub': 'subcategory', 'sub_category': 'subcategory',
  'sub category': 'subcategory', 'subcat': 'subcategory',
  // Subcategory - Turkish
  'alt_kategori': 'subcategory', 'alt kategori': 'subcategory', 'altkategori': 'subcategory',
  'alt kat': 'subcategory', 'alt': 'subcategory',

  // Quantity - English
  'quantity': 'quantity', 'qty': 'quantity', 'stock': 'quantity', 'count': 'quantity',
  'amount': 'quantity', 'units': 'quantity', 'stok': 'quantity',
  // Quantity - Turkish
  'adet': 'quantity', 'miktar': 'quantity', 'stok miktari': 'quantity',

  // Package - English
  'package': 'package', 'footprint': 'package', 'pkg': 'package', 'case': 'package',
  // Package - Turkish
  'paket': 'package', 'kasa': 'package',

  // Manufacturer - English
  'manufacturer': 'manufacturer', 'mfr': 'manufacturer', 'brand': 'manufacturer',
  'vendor': 'manufacturer', 'supplier': 'manufacturer', 'make': 'manufacturer',
  // Manufacturer - Turkish
  'uretici': 'manufacturer', 'marka': 'manufacturer', 'firma': 'manufacturer',

  // MPN - English
  'mpn': 'mpn', 'manufacturer part number': 'mpn', 'part number': 'mpn',
  'model': 'mpn', 'model number': 'mpn', 'mfr part number': 'mpn',
  // MPN - Turkish
  'uretici parca no': 'mpn', 'model no': 'mpn',

  // Location - English
  'location': 'location', 'bin': 'location', 'storage': 'location',
  'shelf': 'location', 'drawer': 'location', 'slot': 'location',
  // Location - Turkish
  'konum': 'location', 'depo': 'location', 'raf': 'location', 'kutu': 'location',

  // Voltage - English
  'voltage_max': 'voltage_max', 'voltage max': 'voltage_max', 'vmax': 'voltage_max',
  'v max': 'voltage_max', 'max voltage': 'voltage_max', 'voltage': 'voltage_max',
  // Voltage - Turkish
  'gerilim': 'voltage_max', 'gerilim_max': 'voltage_max', 'gerilim max': 'voltage_max',
  'max gerilim': 'voltage_max', 'voltaj': 'voltage_max',

  // Current - English
  'current_max': 'current_max', 'current max': 'current_max', 'imax': 'current_max',
  'i max': 'current_max', 'max current': 'current_max', 'current': 'current_max',
  // Current - Turkish
  'akim': 'current_max', 'akim_max': 'current_max', 'akim max': 'current_max',
  'max akim': 'current_max', 'akım': 'current_max',

  // Description - English
  'description': 'description', 'desc': 'description', 'info': 'description',
  'details': 'description',
  // Description - Turkish
  'aciklama': 'description', 'tanim': 'description', 'bilgi': 'description',
  'detay': 'description',

  // Notes - English
  'notes': 'notes', 'note': 'notes', 'comment': 'notes', 'comments': 'notes',
  'remarks': 'notes', 'remark': 'notes',
  // Notes - Turkish
  'not': 'notes', 'notlar': 'notes', 'yorum': 'notes', 'aciklamalar': 'notes',

  // Datasheet - English
  'datasheet_url': 'datasheet_url', 'datasheet': 'datasheet_url',
  'datasheet url': 'datasheet_url', 'ds url': 'datasheet_url', 'ds': 'datasheet_url',
  'url': 'datasheet_url', 'link': 'datasheet_url',

  // Price - English
  'unit_price': 'unit_price', 'price': 'unit_price', 'unit price': 'unit_price',
  'cost': 'unit_price', 'fiyat': 'unit_price', 'birim fiyat': 'unit_price',
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

  return rows
    .map(row => {
      const out = {};
      Object.entries(mapped).forEach(([orig, norm]) => {
        const val = row[orig];
        out[norm] = val !== undefined && val !== null ? String(val).trim() : '';
      });
      return out;
    })
    .filter(r => r.part_code && r.part_code.length > 0);
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
// ============================================================
function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
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
        const headers = Object.keys(rawRows[0] || {});
        showToast(
          `No recognized column headers in CSV. Found: ${headers.slice(0, 5).join(', ')}`,
          'warning',
          8000
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
