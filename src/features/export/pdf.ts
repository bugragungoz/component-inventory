/**
 * The inventory as a printable PDF list. Pages are drawn on a canvas and placed as images, so every
 * UI language prints correctly (the PDF's built-in fonts only cover Western European letters).
 */
import type { Component } from '../../api/types';
import { formatDateTime, formatNumber, t } from '../../i18n';
import { categoryOf } from '../../state/inventory';
import { categoryLabel, fieldLabel, subcategoryLabel } from '../inventory/labels';

const PX_PER_MM = 6;
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const ROW_MM = 6.2;
const INK = 'black';
const PAPER = 'white';

interface Col { key: string; width: number; get: (c: Component) => string; end?: boolean; mono?: boolean }

export function pdfColumns(withPlace: boolean): Col[] {
  const cols: Col[] = [
    { key: 'part_code', width: 38, get: (c) => c.part_code, mono: true },
    { key: 'category', width: 30, get: (c) => [categoryLabel(categoryOf(c)), c.subcategory ? subcategoryLabel(c.subcategory) : ''].filter(Boolean).join(' / ') },
    { key: 'quantity', width: 16, get: (c) => formatNumber(c.quantity), end: true, mono: true },
    { key: 'package', width: 20, get: (c) => c.package, mono: true },
    { key: 'description', width: 0, get: (c) => c.description },
  ];
  if (withPlace) cols.push({ key: 'location', width: 26, get: (c) => c.location });
  const fixed = cols.reduce((a, c) => a + c.width, 0);
  cols.find((c) => c.key === 'description')!.width = PAGE_W - MARGIN * 2 - fixed;
  return cols;
}

/** Rows per page after the header; pure, unit-tested. */
export function rowsPerPage(first: boolean): number {
  const top = first ? 24 : 12;
  return Math.floor((PAGE_H - MARGIN * 2 - top - 6) / ROW_MM);
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function drawPage(parts: Component[], cols: Col[], page: number, pages: number, title: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * PX_PER_MM;
  canvas.height = PAGE_H * PX_PER_MM;
  const ctx = canvas.getContext('2d')!;
  const mm = (v: number) => v * PX_PER_MM;
  const css = getComputedStyle(document.documentElement);
  const ui = css.getPropertyValue('--font-ui') || 'sans-serif';
  const mono = css.getPropertyValue('--font-mono') || 'monospace';
  const rtl = document.documentElement.dir === 'rtl';
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  let y = MARGIN;
  if (page === 0) {
    ctx.font = `600 ${mm(6)}px ${ui}`;
    ctx.fillText(title, mm(MARGIN), mm(y + 4));
    ctx.font = `400 ${mm(3)}px ${ui}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(formatDateTime(new Date()), mm(MARGIN), mm(y + 11));
    ctx.globalAlpha = 1;
    y += 18;
  }
  ctx.font = `600 ${mm(2.8)}px ${ui}`;
  let x = MARGIN;
  for (const c of cols) {
    ctx.textAlign = c.end ? 'right' : 'left';
    ctx.fillText(clip(ctx, fieldLabel(c.key), mm(c.width - 2)), mm(c.end ? x + c.width - 2 : x), mm(y + ROW_MM / 2));
    x += c.width;
  }
  y += ROW_MM;
  ctx.fillRect(mm(MARGIN), mm(y), mm(PAGE_W - MARGIN * 2), Math.max(1, mm(0.3)));
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (i % 2 === 1) {
      ctx.globalAlpha = 0.06;
      ctx.fillRect(mm(MARGIN), mm(y), mm(PAGE_W - MARGIN * 2), mm(ROW_MM));
      ctx.globalAlpha = 1;
    }
    x = MARGIN;
    for (const c of cols) {
      ctx.font = `400 ${mm(2.8)}px ${c.mono ? mono : ui}`;
      ctx.textAlign = c.end ? 'right' : 'left';
      ctx.direction = rtl && !c.mono ? 'rtl' : 'ltr';
      ctx.fillText(clip(ctx, c.get(p) || '', mm(c.width - 2)), mm(c.end ? x + c.width - 2 : x), mm(y + ROW_MM / 2));
      x += c.width;
    }
    y += ROW_MM;
  }
  ctx.direction = 'ltr';
  ctx.textAlign = 'right';
  ctx.font = `400 ${mm(2.6)}px ${ui}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(t('export.pdfPage', { page: page + 1, pages }), mm(PAGE_W - MARGIN), mm(PAGE_H - MARGIN / 2));
  ctx.globalAlpha = 1;
  return canvas;
}

export async function buildInventoryPdf(parts: Component[], withPlace: boolean, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  await document.fonts?.ready;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cols = pdfColumns(withPlace);
  const chunks: Component[][] = [];
  let rest = parts;
  let first = true;
  while (rest.length || first) {
    const n = rowsPerPage(first);
    chunks.push(rest.slice(0, n));
    rest = rest.slice(n);
    first = false;
  }
  const title = t('export.pdfTitle', { count: parts.length });
  for (let i = 0; i < chunks.length; i++) {
    if (i) doc.addPage('a4');
    const canvas = drawPage(chunks[i]!, cols, i, chunks.length, title);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
    onProgress?.(i + 1, chunks.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
