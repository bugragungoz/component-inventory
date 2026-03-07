import { state, showToast } from '../app.js';

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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// CSV export
// ============================================================
function exportCSV() {
  const rows = state.components;
  const header = EXPORT_COLUMNS.map(c => c.label).join(',');
  const lines  = rows.map(row =>
    EXPORT_COLUMNS.map(col => {
      const val = row[col.key] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str}"`
        : str;
    }).join(',')
  );
  const csv = [header, ...lines].join('\r\n');
  // UTF-8 BOM ensures Excel opens the file with correct encoding (critical for non-ASCII chars)
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), timestampedName('csv'));
}

// ============================================================
// JSON export
// ============================================================
function exportJSON() {
  const rows = state.components.map(row => {
    const obj = {};
    EXPORT_COLUMNS.forEach(col => { obj[col.key] = row[col.key] ?? null; });
    return obj;
  });
  const json = JSON.stringify(rows, null, 2);
  downloadBlob(new Blob([json], { type: 'application/json' }), timestampedName('json'));
}

// ============================================================
// Excel export (SheetJS)
// ============================================================
function exportExcel() {
  const rows = state.components.map(row => {
    const obj = {};
    EXPORT_COLUMNS.forEach(col => { obj[col.label] = row[col.key] ?? ''; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

  // Column widths
  const colWidths = EXPORT_COLUMNS.map(col => ({ wch: Math.max(col.label.length + 2, 14) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, timestampedName('xlsx'));
}

// ============================================================
// PDF export (jsPDF + autoTable)
// ============================================================
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Component Inventory', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text(`Exported: ${new Date().toLocaleString('en-US')} | Total: ${state.components.length} components`, 14, 22);
  doc.setTextColor(0, 0, 0);

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
    startY: 26,
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

  doc.save(timestampedName('pdf'));
}

// ============================================================
// Export UI
// ============================================================
export function initExport() {
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      document.getElementById('overlay-export').style.display = 'none';

      if (state.components.length === 0) {
        showToast('Nothing to export — inventory is empty', 'warning');
        return;
      }

      try {
        if (format === 'csv')   exportCSV();
        if (format === 'json')  exportJSON();
        if (format === 'excel') exportExcel();
        if (format === 'pdf')   exportPDF();
        showToast(`Exported as ${format.toUpperCase()}`, 'success');
      } catch (err) {
        showToast('Export failed: ' + (err.message || err), 'error');
      }
    });
  });
}
