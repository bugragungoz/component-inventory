/**
 * Label printing module.
 * Generates a multi-label PDF (A4) using jsPDF.
 * Each label includes part code, category, location, qty, and a QR code.
 */

import { showToast } from '../app.js';

let _jsPDF = null;
let _qrcode = null;

async function getJsPDF() {
  if (_jsPDF) return _jsPDF;
  const mod = await import('jspdf');
  _jsPDF = mod.jsPDF;
  return _jsPDF;
}

async function getQRCode() {
  if (_qrcode) return _qrcode;
  const mod = await import('qrcode');
  _qrcode = mod.default;
  return _qrcode;
}

let _labelComp = null;

// ============================================================
// QR code data URL generator
// ============================================================
function generateQRDataUrl(text) {
  return getQRCode()
    .then(QRCode => QRCode.toDataURL(String(text || ''), {
      width: 120,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }))
    .catch(() => null);
}

// ============================================================
// Populate label preview card in the modal
// ============================================================
function populateLabelPreview(comp) {
  document.getElementById('lbl-part-code').textContent = comp.part_code  || '—';
  document.getElementById('lbl-cat').textContent        = comp.category   || '';
  document.getElementById('lbl-sub').textContent        = comp.subcategory|| '';
  document.getElementById('lbl-location').textContent   = comp.location   || '—';
  document.getElementById('lbl-qty').textContent        = comp.quantity   != null ? String(comp.quantity) : '—';
  document.getElementById('lbl-pkg').textContent        = comp.package    || '—';

  const priceRow = document.getElementById('lbl-price-row');
  if (comp.unit_price != null) {
    document.getElementById('lbl-price').textContent = `$${Number(comp.unit_price).toFixed(2)}`;
    priceRow.style.display = '';
  } else {
    priceRow.style.display = 'none';
  }

  // QR image in preview
  generateQRDataUrl(comp.part_code).then(dataUrl => {
    const wrap = document.getElementById('lbl-qr-img-wrap');
    if (dataUrl) {
      wrap.innerHTML = `<img src="${dataUrl}" width="60" height="60" style="display:block;border-radius:3px" />`;
    } else {
      wrap.innerHTML = '';
    }
  });
}

// ============================================================
// Generate multi-label PDF
// ============================================================
async function generateLabelPDF(comp, copies) {
  const qrDataUrl = await generateQRDataUrl(comp.part_code);
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Label dimensions (mm)
  const lW   = 90;
  const lH   = 40;
  const padX = 10;
  const padY = 10;
  const gapX = 5;
  const gapY = 4;
  const cols = 2;
  const pageW = 210;

  let col = 0;
  let row = 0;
  let pageNum = 1;

  for (let i = 0; i < copies; i++) {
    const x = padX + col * (lW + gapX);
    const y = padY + row * (lH + gapY);

    if (y + lH > 297 - padY) {
      doc.addPage();
      col = 0; row = 0;
      pageNum++;
    }

    const cx = padX + col * (lW + gapX);
    const cy = padY + row * (lH + gapY);

    // Label border
    doc.setDrawColor(180, 175, 165);
    doc.setLineWidth(0.4);
    doc.roundedRect(cx, cy, lW, lH, 2, 2);

    // Part code — truncate to prevent overflow beyond QR code area
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(217, 119, 87);
    const displayCode = (comp.part_code || '—').substring(0, 26);
    doc.text(displayCode, cx + 3, cy + 7, { maxWidth: lW - 32 });

    // Category / Subcategory
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 118, 112);
    const catLine = [comp.category, comp.subcategory].filter(Boolean).join(' > ');
    if (catLine) doc.text(catLine, cx + 3, cy + 11.5);

    // Detail rows
    const fields = [
      ['Location', comp.location || '—'],
      ['Qty',      String(comp.quantity ?? '—')],
      ['Package',  comp.package  || '—'],
    ];
    if (comp.unit_price != null) fields.push(['Price', `$${Number(comp.unit_price).toFixed(2)}`]);

    doc.setFontSize(7);
    let lineY = cy + 17;
    for (const [key, val] of fields) {
      doc.setTextColor(120, 118, 112);
      doc.setFont('helvetica', 'normal');
      doc.text(key + ':', cx + 3, lineY);
      doc.setTextColor(30, 28, 25);
      doc.setFont('helvetica', 'bold');
      doc.text(String(val), cx + 18, lineY);
      lineY += 4.5;
    }

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(160, 158, 150);
    doc.text('Component Inventory', cx + 3, cy + lH - 2.5);

    // QR code (right side)
    if (qrDataUrl) {
      const qrSize = 24;
      doc.addImage(qrDataUrl, 'PNG', cx + lW - qrSize - 3, cy + lH - qrSize - 3, qrSize, qrSize);
    }

    col++;
    if (col >= cols) { col = 0; row++; }
  }

  doc.save(`Label_${comp.part_code}_${copies}x.pdf`);
}

// ============================================================
// Public API
// ============================================================
export function initLabels() {
  document.getElementById('btn-print-label').addEventListener('click', () => {
    if (!_labelComp) return;
    populateLabelPreview(_labelComp);
    document.getElementById('overlay-label').style.display = '';
  });

  document.getElementById('btn-label-pdf').addEventListener('click', async () => {
    if (!_labelComp) return;
    const copies = Math.max(1, Math.min(100,
      parseInt(document.getElementById('label-copies').value) || 1
    ));
    try {
      await generateLabelPDF(_labelComp, copies);
    } catch (err) {
      console.error('Label PDF generation failed:', err);
      showToast('PDF generation failed: ' + (err.message || String(err)), 'error');
    }
  });
}

export function setLabelComponent(comp) {
  _labelComp = comp;
}
