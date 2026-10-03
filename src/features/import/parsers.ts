/**
 * File readers for the import: CSV (UTF-8 or the Turkish Windows code page), Excel (every sheet
 * with recognizable headers) and PDF (the text layer of a "print to PDF" order or cart page).
 * The PDF logic is split: `pdfLines` reads positions with pdf.js, `rowsFromPdfLines` is pure.
 */
import { detectShop } from '@cinv/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { detectDelimiter, isSummaryRow, normalizeHeader, tableToRows, type RawRow } from '../../domain/importCore';

export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/** UTF-8 when it decodes cleanly, otherwise Windows-1254 (what Turkish Excel writes). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1254').decode(bytes);
  }
}

/** RFC 4180 CSV with the delimiter guessed from the first line (comma, semicolon or tab). */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function rowsFromCsv(bytes: Uint8Array): RawRow[] {
  return tableToRows(parseCsv(decodeText(bytes))).rows;
}

/** Every sheet whose header row has at least one known column; rows keep their sheet's headers. */
export async function rowsFromXlsx(bytes: Uint8Array): Promise<{ rows: RawRow[]; sheets: string[] }> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false, cellFormula: false, cellHTML: false });
  const rows: RawRow[] = [];
  const sheets: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
    const parsed = tableToRows(table);
    if (parsed.recognized > 0 && parsed.rows.length) {
      rows.push(...parsed.rows);
      sheets.push(name);
    }
  }
  return { rows, sheets };
}

// ---- PDF ----

export interface PdfItem {
  text: string;
  x: number;
  y: number;
  w: number;
}

export interface PdfLine {
  page: number;
  y: number;
  cells: PdfItem[];
  links: string[];
}

/** A whole-line quantity with its marker: "3 Adet", "Adet: 3", "x3", "3 pcs". A bare number is not. */
const QTY_LINE = /^(?:(?:adet|miktar|qty|quantity)\s*[:.]?\s*(\d{1,6})|x\s*(\d{1,6})|(\d{1,6})\s*(?:adet|ad\.|pcs\.?|pc|pieces?|x))$/i;
/** A cell that is a quantity because it says so: "3 Adet", "x3", "3 pcs". */
const QTY_CELL = /^(?:x\s*(\d{1,6})|(\d{1,6})\s*(?:adet|ad\.|pcs\.?|pieces?))$/i;
const QTY_LABEL = /^(?:adet|miktar|qty|quantity|amount)\s*:?$/i;
/** Özdisan prints the packaging next to the count; packaging is never a multiplier. */
const PACK_WORDS = 'reel|tube|tray|bulk|cut\\s*tape|tape\\s*&\\s*box|ammo(?:\\s*pack)?|kesik\\s*bant|makara|tüp';
const PACKAGING = new RegExp(`^(?:${PACK_WORDS})$`, 'i');
/** "10 TUBE" in one cell, or a name cell that ends in "15 TAPE&BOX" (the print ran them together). */
const COUNT_THEN_PACKAGING = new RegExp(`^(.*?)\\s*\\b(\\d{1,6})\\s+(?:${PACK_WORDS})$`, 'i');
const PRICE_LABEL = /^(?:birim\s*fiyat|unit\s*price|fiyat|price)\b/i;
const BARE_INT = /^\d{1,6}$/;
/** A count that opens the price line: "1 Birim Fiyat 35,28 TRY", "ADET 2 Birim Fiyat ...". */
const QTY_BEFORE_PRICE = /^(?:(?:adet|miktar|qty)\s*:?\s*)?(\d{1,6})\s+(?:birim\s*fiyat|unit\s*price)(?![a-zçğıöşü])/i;
/** A long number at the end of a name is the shop's stock code (Robocombo prints it there). */
const TRAILING_SHOP_CODE = /\s(\d{6,14})$/;
const PRICE = /(?:^|\s)(?:₺|\$|€)?\s*\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2,5}\s*(?:tl|try|₺|usd|\$|eur|€)?(?=\s|$)/gi;
const MONEY_CELL = /^(?:₺|\$|€)?\s*[\d.,]+\s*(?:tl|try|₺|usd|\$|eur|€)$/i;
/** Labels and buttons a printed order page carries that are never a product name. */
const BOILERPLATE = /^(?:değerlendir|yorum yap|sepete ekle|incele|kaldır|sil|iade|sipariş iade metni\s*:?|iade süresi doldu|müşteri numarası\s*:?|ürün kodu\s*:?|stok kodu\s*:?|birim fiyat|toplam fiyat.*|-|•)$/i;
const CODE_LABEL = /^(?:ürün kodu|urun kodu|stok kodu|product code|part number|mpn)\s*:?\s*(.*)$/i;
const SHOP_CODE = /^\d{6,14}$/;

function lineText(l: PdfLine): string {
  return l.cells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
}

function cleanName(s: string): string {
  return s.replace(PRICE, ' ').replace(/\s+/g, ' ').replace(/^[-–:|\s]+|[-–:|\s]+$/g, '').trim();
}

const isNameText = (t: string) => !!t && !BOILERPLATE.test(t) && !MONEY_CELL.test(t) && !BARE_INT.test(t) && !PRICE_LABEL.test(t) && !QTY_LABEL.test(t) && !PACKAGING.test(t);

/** The quantity on a line and the cells that belong to it, or null when the line has none. */
export function quantityOnLine(l: PdfLine): { qty: number; used: Set<number>; rest?: { index: number; text: string } } | null {
  const text = lineText(l);
  const all = new Set(l.cells.map((_, i) => i));
  const whole = QTY_LINE.exec(text);
  if (whole) return { qty: parseInt(whole[1] ?? whole[2] ?? whole[3]!, 10), used: all };
  const beforePrice = QTY_BEFORE_PRICE.exec(text);
  if (beforePrice) return { qty: parseInt(beforePrice[1]!, 10), used: all };
  const cells = l.cells.map((c) => c.text.trim());
  for (let i = 0; i < cells.length; i++) {
    const m = QTY_CELL.exec(cells[i]!);
    if (m) return { qty: parseInt(m[1] ?? m[2]!, 10), used: new Set([i]) };
  }
  for (let i = 0; i < cells.length; i++) {
    const m = COUNT_THEN_PACKAGING.exec(cells[i]!);
    if (m) return { qty: parseInt(m[2]!, 10), used: new Set([i]), rest: m[1]?.trim() ? { index: i, text: m[1].trim() } : undefined };
  }
  for (let i = 0; i < cells.length; i++) {
    if (!BARE_INT.test(cells[i]!)) continue;
    const before = cells[i - 1] ?? '';
    const after = cells[i + 1] ?? '';
    if (QTY_LABEL.test(before)) return { qty: parseInt(cells[i]!, 10), used: new Set([i - 1, i]) };
    if (PACKAGING.test(after)) return { qty: parseInt(cells[i]!, 10), used: new Set([i, i + 1]) };
    if (i === 0 && PRICE_LABEL.test(after)) return { qty: parseInt(cells[i]!, 10), used: new Set([i]) };
  }
  return null;
}

/** Every "Ürün Kodu:" value: in the same cell, or the cell below the label. */
function labelledCodes(lines: PdfLine[]): Array<{ page: number; y: number; code: string }> {
  const out: Array<{ page: number; y: number; code: string }> = [];
  lines.forEach((l, i) => {
    for (const c of l.cells) {
      const m = CODE_LABEL.exec(c.text.trim());
      if (!m) continue;
      const value = m[1]?.trim() || lines[i + 1]?.cells.find((d) => Math.abs(d.x - c.x) < 20)?.text.trim() || '';
      if (value && value !== '-') out.push({ page: l.page, y: lines[i + 1] && !m[1]?.trim() ? lines[i + 1]!.y : l.y, code: value });
    }
  });
  return out;
}

/**
 * Rows from the positioned lines of a printed order or cart page.
 *  1. A header line (two known column names, one of them a quantity, no numbers): a table; cells
 *     go to the nearest header by x.
 *  2. Otherwise anchors: a quantity ("3 Adet", "Adet 3", "3 REEL", "1 Birim Fiyat ...") closes a
 *     block; the product name is the text on the same line, else the linked line above it, else
 *     the nearest text line above. A labelled code ("Ürün Kodu:") is the part code; a long number
 *     next to the name is the shop's stock code. Nothing without a quantity becomes a row.
 * Both stop at the first totals line ("Ara Toplam", "Subtotal").
 */
export function rowsFromPdfLines(lines: PdfLine[]): { rows: RawRow[]; mode: 'table' | 'anchor' | 'none'; links: string[] } {
  const end = lines.findIndex((l) => isSummaryRow(l.cells.map((c) => c.text)) || isSummaryRow([lineText(l).replace(/[\d.,]+\s*(tl|try|₺)?$/i, '').trim()]));
  const body = end === -1 ? lines : lines.slice(0, end);
  const links = [...new Set(body.flatMap((l) => l.links))];

  // 1. A table with a header line.
  const headerAt = body.findIndex((l) =>
    l.cells.filter((c) => normalizeHeader(c.text)).length >= 2 && l.cells.some((c) => normalizeHeader(c.text) === 'quantity') && !l.cells.some((c) => /\d/.test(c.text)));
  if (headerAt !== -1) {
    const header = body[headerAt]!.cells;
    const names = header.map((c, i) => c.text.trim() || `Column ${i + 1}`);
    const qtyKey = names[header.findIndex((c) => normalizeHeader(c.text) === 'quantity')]!;
    const rows: RawRow[] = [];
    for (const l of body.slice(headerAt + 1)) {
      if (!lineText(l)) continue;
      if (names.filter((n) => l.cells.some((c) => c.text.trim() === n)).length >= 2) continue; // the header again on the next page
      const row: RawRow = {};
      for (const c of l.cells) {
        let best = 0;
        let dist = Infinity;
        header.forEach((h, i) => {
          const d = Math.abs(h.x - c.x);
          if (d < dist) {
            dist = d;
            best = i;
          }
        });
        const k = names[best]!;
        row[k] = row[k] ? `${row[k]} ${c.text}` : c.text;
      }
      if (!row[qtyKey]?.trim() && rows.length) {
        const prev = rows[rows.length - 1]!; // a wrapped name: it belongs to the line above
        for (const [k, v] of Object.entries(row)) prev[k] = prev[k] ? `${prev[k]} ${v}` : v;
        continue;
      }
      if (l.links[0]) row.Link = l.links[0];
      rows.push(row);
    }
    if (rows.length) return { rows, mode: 'table', links };
  }

  // 2. Anchors.
  const anchors: Array<{ page: number; y: number; row: RawRow }> = [];
  let block: PdfLine[] = [];
  for (const l of body) {
    if (!lineText(l)) continue;
    const q = quantityOnLine(l);
    if (!q) {
      block.push(l);
      continue;
    }
    const own = l.cells.map((c, i) => (q.rest?.index === i ? q.rest.text : q.used.has(i) ? '' : c.text.trim()));
    let name = cleanName(own.filter((t) => isNameText(t) && !SHOP_CODE.test(t)).join(' '));
    let shopCode = '';
    let link = l.links[0] ?? '';
    if (!name) {
      const linked = [...block].reverse().find((b) => b.links.length && b.cells.some((c) => isNameText(c.text.trim())));
      const source = linked ?? [...block].reverse().find((b) => b.cells.some((c) => isNameText(c.text.trim()) && !CODE_LABEL.test(c.text.trim())));
      if (source) {
        const raw = source.cells.filter((c) => isNameText(c.text.trim()) && !SHOP_CODE.test(c.text.trim())).map((c) => c.text.trim()).join(' ');
        const tail = TRAILING_SHOP_CODE.exec(raw);
        name = cleanName(tail ? raw.slice(0, tail.index) : raw);
        shopCode = tail?.[1] ?? source.cells.map((c) => c.text.trim()).find((t) => SHOP_CODE.test(t)) ?? '';
        link ||= source.links[0] ?? '';
      }
    }
    block = [];
    if (!name) continue;
    const row: RawRow = { Name: name, Quantity: String(q.qty) };
    if (shopCode) row['Shop code'] = shopCode;
    if (link) row.Link = link;
    anchors.push({ page: l.page, y: l.y, row });
  }
  // A labelled code ("Ürün Kodu:" with the value below it) belongs to the nearest row on its page.
  const taken = new Set<number>();
  for (const c of labelledCodes(body)) {
    let best = -1;
    let dist = Infinity;
    anchors.forEach((a, i) => {
      if (a.page !== c.page || taken.has(i)) return;
      const d = Math.abs(a.y - c.y);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    if (best !== -1 && dist < 60) {
      taken.add(best);
      anchors[best]!.row.Code = c.code;
    }
  }
  const rows = anchors.map((a) => a.row);
  return { rows, mode: rows.length ? 'anchor' : 'none', links };
}

/** The shop a printed page came from, by its product links. */
export function shopFromLinks(links: string[]): string | null {
  for (const l of links) {
    try {
      const s = detectShop(new URL(l).hostname);
      if (s) return s.id;
    } catch {
      /* not a URL */
    }
  }
  return null;
}

/** Positioned text lines of a PDF (at most 40 pages), with link annotations attached by position. */
export async function pdfLines(bytes: Uint8Array): Promise<{ lines: PdfLine[]; hasText: boolean; pages: number }> {
  const { openPdf } = await import('../projects/pdfjs');
  const doc = await openPdf(bytes.slice());
  try {
    return await linesFromDocument(doc);
  } finally {
    void doc.destroy();
  }
}

/** The part of `pdfLines` that only needs an open document (the Node tests pass their own). */
export async function linesFromDocument(doc: PDFDocumentProxy): Promise<{ lines: PdfLine[]; hasText: boolean; pages: number }> {
  const lines: PdfLine[] = [];
  let hasText = false;
  const pages = Math.min(doc.numPages, 40);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      hasText = true;
      items.push({ text: it.str.trim(), x: it.transform[4] as number, y: vp.height - (it.transform[5] as number), w: it.width });
    }
    const annots = (await page.getAnnotations()) as Array<{ subtype?: string; url?: string; rect?: number[] }>;
    const linkRects = annots
      .filter((a) => a.subtype === 'Link' && typeof a.url === 'string' && /^https?:\/\//i.test(a.url) && a.rect)
      .map((a) => ({ url: a.url!, top: vp.height - a.rect![3]!, bottom: vp.height - a.rect![1]! }));
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    let cur: PdfItem[] = [];
    const flush = () => {
      if (!cur.length) return;
      cur.sort((a, b) => a.x - b.x);
      const merged: PdfItem[] = [];
      for (const it of cur) {
        const last = merged[merged.length - 1];
        if (last && it.x - (last.x + last.w) < 6) {
          last.text = `${last.text}${it.x - (last.x + last.w) > 0.8 ? ' ' : ''}${it.text}`;
          last.w = it.x + it.w - last.x;
        } else merged.push({ ...it });
      }
      const y = cur[0]!.y;
      lines.push({ page: p, y, cells: merged, links: linkRects.filter((r) => y >= r.top - 2 && y <= r.bottom + 2).map((r) => r.url) });
      cur = [];
    };
    for (const it of items) {
      if (cur.length && Math.abs(it.y - cur[0]!.y) > 3) flush();
      cur.push(it);
    }
    flush();
  }
  return { lines, hasText, pages: doc.numPages };
}
