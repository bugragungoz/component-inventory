import { state, showToast } from '../app.js';
import { save as saveDialog }  from '@tauri-apps/plugin-dialog';
import { writeFile }            from '@tauri-apps/plugin-fs';

const EXPORT_COLUMNS = [
  { key: 'part_code',    label: 'Part Code' },
  { key: 'category',     label: 'Category' },
  { key: 'subcategory',  label: 'Subcategory' },
  { key: 'quantity',     label: 'Quantity' },
  { key: 'package',      label: 'Package' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'mpn',          label: 'MPN' },
  { key: 'location',     label: 'Location' },
  { key: 'voltage_max',  label: 'Voltage Max (V)' },
  { key: 'current_max',  label: 'Current Max (A)' },
  { key: 'description',  label: 'Description' },
  { key: 'datasheet_url',label: 'Datasheet URL' },
  { key: 'unit_price',   label: 'Unit Price ($)' },
  { key: 'notes',        label: 'Notes' },
  { key: 'created_at',   label: 'Created At' },
  { key: 'updated_at',   label: 'Updated At' },
];

function timestampedName(ext) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts  = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `ComponentInventory_${ts}.${ext}`;
}

/**
 * Save bytes to a user-chosen path via Tauri save dialog.
 * If a default export folder is set in localStorage, the dialog opens there.
 * Returns true on success, false when the user cancelled.
 */
async function saveViaDialog(bytes, filename, extLabel) {
  const folder       = localStorage.getItem('exportFolder') || null;
  const defaultPath  = folder ? `${folder}\\${filename}` : filename;
  const ext          = filename.split('.').pop();

  const chosenPath = await saveDialog({
    defaultPath,
    filters: [{ name: extLabel, extensions: [ext] }],
  });
  if (!chosenPath) return false;

  await writeFile(chosenPath, bytes);
  return true;
}

// ============================================================
// CSV export
// ============================================================
async function exportCSV() {
  const rows   = state.components;
  const header = EXPORT_COLUMNS.map(c => c.label).join(',');
  const lines  = rows.map(row =>
    EXPORT_COLUMNS.map(col => {
      const val = row[col.key] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
        ? `"${str}"`
        : str;
    }).join(',')
  );
  const csv   = [header, ...lines].join('\r\n');
  // UTF-8 BOM for Excel compatibility
  const bom   = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const body  = new TextEncoder().encode(csv);
  const bytes = new Uint8Array(bom.length + body.length);
  bytes.set(bom); bytes.set(body, bom.length);
  return saveViaDialog(bytes, timestampedName('csv'), 'CSV File');
}

// ============================================================
// JSON export
// ============================================================
async function exportJSON() {
  const rows  = state.components.map(row => {
    const obj = {};
    EXPORT_COLUMNS.forEach(col => { obj[col.key] = row[col.key] ?? null; });
    return obj;
  });
  const bytes = new TextEncoder().encode(JSON.stringify(rows, null, 2));
  return saveViaDialog(bytes, timestampedName('json'), 'JSON File');
}

// ============================================================
// Excel export (SheetJS)
// ============================================================
async function exportExcel() {
  const rows = state.components.map(row => {
    const obj = {};
    EXPORT_COLUMNS.forEach(col => { obj[col.label] = row[col.key] ?? ''; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  const colWidths = EXPORT_COLUMNS.map(col => ({ wch: Math.max(col.label.length + 2, 14) }));
  ws['!cols'] = colWidths;

  const buf   = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const bytes = new Uint8Array(buf);
  return saveViaDialog(bytes, timestampedName('xlsx'), 'Excel File');
}

// ============================================================
// PDF export (jsPDF + autoTable)
// ============================================================
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- Header banner ----
  doc.setFillColor(30, 27, 16);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // accent stripe
  doc.setFillColor(217, 119, 87);
  doc.rect(0, 27.2, pageWidth, 0.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(217, 119, 87);
  doc.text('CI', 14, 12);

  doc.setFontSize(13);
  doc.setTextColor(240, 235, 215);
  doc.text('Component Inventory', 24, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 155, 130);
  doc.text(`Exported: ${new Date().toLocaleString('en-US')}  |  ${state.components.length} components`, 14, 20);

  // GitHub URL right-aligned
  doc.setFontSize(7);
  doc.setTextColor(140, 135, 110);
  const ghText = 'github.com/bugragungoz/component-inventory';
  const ghWidth = doc.getTextWidth(ghText);
  doc.text(ghText, pageWidth - ghWidth - 12, 20);

  doc.setTextColor(20, 20, 19);

  const visibleCols = [
    { key: 'part_code',    label: 'Part Code' },
    { key: 'category',     label: 'Category' },
    { key: 'subcategory',  label: 'Subcategory' },
    { key: 'quantity',     label: 'Qty' },
    { key: 'package',      label: 'Package' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'mpn',          label: 'MPN' },
    { key: 'location',     label: 'Location' },
    { key: 'voltage_max',  label: 'V Max' },
    { key: 'current_max',  label: 'I Max' },
    { key: 'description',  label: 'Description' },
    { key: 'unit_price',   label: 'Price' },
  ];

  const head = [visibleCols.map(c => c.label)];
  const body = state.components.map(row =>
    visibleCols.map(col => {
      const v = row[col.key];
      if (v === null || v === undefined || v === '') return '';
      return String(v);
    })
  );

  doc.autoTable({
    head,
    body,
    startY: 32,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [20, 20, 19],
    },
    headStyles: {
      fillColor: [217, 119, 87],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [242, 240, 232] },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
  });

  const buf   = doc.output('arraybuffer');
  const bytes = new Uint8Array(buf);
  return saveViaDialog(bytes, timestampedName('pdf'), 'PDF File');
}

// ============================================================
// Export UI
// ============================================================
export function initExport() {
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const format = btn.dataset.format;
      document.getElementById('overlay-export').style.display = 'none';

      if (state.components.length === 0) {
        showToast('Nothing to export — inventory is empty', 'warning');
        return;
      }

      try {
        let saved;
        if (format === 'csv')   saved = await exportCSV();
        if (format === 'json')  saved = await exportJSON();
        if (format === 'excel') saved = await exportExcel();
        if (format === 'pdf')   saved = await exportPDF();
        if (saved !== false) showToast(`Exported as ${format.toUpperCase()}`, 'success');
      } catch (err) {
        showToast('Export failed: ' + (err.message || err), 'error');
      }
    });
  });
}
