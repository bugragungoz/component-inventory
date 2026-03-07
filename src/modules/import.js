import { upsertComponents, showToast, escHtml } from '../app.js';

// Column header normalization map
const HEADER_MAP = {
  // Standard English
  'part_code': 'part_code', 'part code': 'part_code', 'partcode': 'part_code', 'part': 'part_code',
  'category': 'category', 'cat': 'category',
  'subcategory': 'subcategory', 'sub': 'subcategory', 'sub_category': 'subcategory', 'sub category': 'subcategory',
  'quantity': 'quantity', 'qty': 'quantity', 'stock': 'quantity', 'count': 'quantity',
  'package': 'package', 'footprint': 'package', 'pkg': 'package',
  'manufacturer': 'manufacturer', 'mfr': 'manufacturer', 'brand': 'manufacturer',
  'mpn': 'mpn', 'manufacturer part number': 'mpn', 'part number': 'mpn',
  'location': 'location', 'bin': 'location', 'storage': 'location',
  'voltage_max': 'voltage_max', 'voltage max': 'voltage_max', 'vmax': 'voltage_max', 'v max': 'voltage_max',
  'current_max': 'current_max', 'current max': 'current_max', 'imax': 'current_max', 'i max': 'current_max',
  'description': 'description', 'desc': 'description',
  'datasheet_url': 'datasheet_url', 'datasheet': 'datasheet_url', 'datasheet url': 'datasheet_url',
  'unit_price': 'unit_price', 'price': 'unit_price', 'unit price': 'unit_price', 'cost': 'unit_price',
  'notes': 'notes', 'note': 'notes', 'remarks': 'notes', 'comment': 'notes',
};

function normalizeHeader(h) {
  return HEADER_MAP[h.toLowerCase().trim()] || null;
}

function normalizeRows(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const mapped = {};
  headers.forEach(h => {
    const norm = normalizeHeader(h);
    if (norm) mapped[h] = norm;
  });

  return rows
    .map(row => {
      const out = {};
      Object.entries(mapped).forEach(([orig, norm]) => {
        out[norm] = row[orig];
      });
      return out;
    })
    .filter(r => r.part_code);
}

// ============================================================
// CSV parser (RFC 4180 compatible)
// ============================================================
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];

  function parseLine(line) {
    const fields = [];
    let cur = '';
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
        else if (ch === ',') { fields.push(cur); cur = ''; }
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
    const row = {};
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
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// ============================================================
// PDF parser (PDF.js - text extraction)
// ============================================================
async function parsePDF(arrayBuffer) {
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269/pdf.worker.min.mjs';

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  const maxPages = Math.min(pdf.numPages, 20);
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    fullText += content.items.map(i => i.str).join(' ') + '\n';
  }

  // Try to extract table-like CSV data from text
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  const csvText = lines.join('\n');
  return parseCSV(csvText);
}

// ============================================================
// Build preview table HTML
// ============================================================
function buildPreviewHTML(rows) {
  if (!rows.length) return '<p style="color:var(--text-tertiary)">No recognizable rows found.</p>';

  const sample = rows.slice(0, 6);
  const keys   = Object.keys(sample[0]);

  return `<table>
    <thead><tr>${keys.map(k => `<th>${escHtml(k)}</th>`).join('')}</tr></thead>
    <tbody>${sample.map(r =>
      `<tr>${keys.map(k => `<td>${escHtml(String(r[k] ?? ''))}</td>`).join('')}</tr>`
    ).join('')}
    </tbody>
  </table>`;
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
  const preview    = document.getElementById('import-preview');

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
  const ext = file.name.split('.').pop().toLowerCase();
  let rawRows = [];

  try {
    if (ext === 'csv') {
      const text = await file.text();
      rawRows = parseCSV(text);
    } else if (ext === 'json') {
      const text = await file.text();
      const parsed = JSON.parse(text);
      rawRows = Array.isArray(parsed) ? parsed : [];
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer();
      rawRows = parseExcel(buf);
    } else if (ext === 'pdf') {
      const buf = await file.arrayBuffer();
      rawRows = await parsePDF(buf);
    } else {
      showToast('Unsupported file type. Use CSV, JSON, Excel, or PDF.', 'error');
      return;
    }
  } catch (err) {
    showToast('Failed to parse file: ' + (err.message || err), 'error');
    return;
  }

  const normalized = normalizeRows(rawRows);

  if (normalized.length === 0) {
    showToast('No valid component rows found. Check column headers.', 'warning');
    return;
  }

  _importRows = normalized;

  document.getElementById('import-filename').textContent  = file.name;
  document.getElementById('import-row-count').textContent = `${normalized.length} rows`;
  document.getElementById('table-preview').innerHTML = buildPreviewHTML(normalized);
  document.getElementById('import-preview').style.display = '';
  document.getElementById('btn-confirm-import').disabled = false;
}

function resetImportUI() {
  _importRows = [];
  document.getElementById('file-input').value = '';
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('btn-confirm-import').disabled = true;
}
