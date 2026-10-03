/** Draws one label on a canvas and builds the PDF. Print output is black on white. */
import type { Component } from '../../api/types';
import { formatNumber } from '../../i18n';
import { categoryOf } from '../../state/inventory';
import { categoryLabel, subcategoryLabel } from '../inventory/labels';
import { placeLabels, type LabelSheet } from './layout';

export interface LabelOptions {
  sheet: LabelSheet;
  copies: number;
  skip: number;
  showCategory: boolean;
  showPlace: boolean;
  showQuantity: boolean;
  showPackage: boolean;
  showDescription: boolean;
  qr: boolean;
}

const PX_PER_MM = 12;
const INK = 'black';
const PAPER = 'white';

async function qrCanvas(text: string, size: number): Promise<HTMLCanvasElement | null> {
  try {
    const QR = (await import('qrcode')).default;
    const c = document.createElement('canvas');
    await QR.toCanvas(c, text, { width: size, margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000ff', light: '#ffffffff' } });
    return c;
  } catch {
    return null;
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

export async function drawLabel(c: Component, opt: LabelOptions, labels: { qty: string; place: string; pkg: string }): Promise<HTMLCanvasElement> {
  const { labelW, labelH } = opt.sheet;
  const W = Math.round(labelW * PX_PER_MM);
  const H = Math.round(labelH * PX_PER_MM);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const pad = 2.2 * PX_PER_MM;
  const qrSize = opt.qr ? Math.min(H - pad * 2, 22 * PX_PER_MM) : 0;
  if (opt.qr) {
    const q = await qrCanvas(c.part_code, Math.round(qrSize));
    if (q) ctx.drawImage(q, W - pad - qrSize, (H - qrSize) / 2, qrSize, qrSize);
  }
  const textW = W - pad * 2 - (qrSize ? qrSize + pad : 0);
  const ui = getComputedStyle(document.documentElement).getPropertyValue('--font-ui') || 'sans-serif';
  const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace';
  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  const big = Math.min(5.2, labelH / 6) * PX_PER_MM;
  ctx.font = `600 ${big}px ${mono}`;
  let y = pad;
  ctx.fillText(fit(ctx, c.part_code, textW), pad, y);
  y += big * 1.25;
  const small = Math.min(3, labelH / 10) * PX_PER_MM;
  const line = (text: string, weight = 400) => {
    if (!text || y + small > H - pad * 0.6) return;
    ctx.font = `${weight} ${small}px ${ui}`;
    ctx.fillText(fit(ctx, text, textW), pad, y);
    y += small * 1.3;
  };
  if (opt.showCategory) line([categoryLabel(categoryOf(c)), c.subcategory ? subcategoryLabel(c.subcategory) : ''].filter(Boolean).join(' / '));
  if (opt.showDescription && c.description) line(c.description);
  if (opt.showPackage && c.package) line(`${labels.pkg}: ${c.package}`);
  if (opt.showPlace && c.location) line(`${labels.place}: ${c.location}`, 600);
  if (opt.showQuantity) line(`${labels.qty}: ${formatNumber(c.quantity)}`);
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = Math.max(1, 0.2 * PX_PER_MM);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.globalAlpha = 1;
  return canvas;
}

export async function buildLabelPdf(parts: Component[], opt: LabelOptions, labels: { qty: string; place: string; pkg: string }): Promise<Uint8Array> {
  await document.fonts?.ready;
  const { jsPDF } = await import('jspdf');
  const s = opt.sheet;
  const doc = new jsPDF({ unit: 'mm', format: [s.pageW, s.pageH], orientation: s.pageW > s.pageH ? 'landscape' : 'portrait' });
  const items = parts.flatMap((p) => Array.from({ length: opt.copies }, () => p));
  const placed = placeLabels(s, items.length, opt.skip);
  let page = 0;
  const cache = new Map<number, string>();
  for (const pl of placed) {
    if (pl.page > page) {
      doc.addPage([s.pageW, s.pageH], s.pageW > s.pageH ? 'landscape' : 'portrait');
      page = pl.page;
    }
    const part = items[pl.index]!;
    let url = cache.get(part.id);
    if (!url) {
      url = (await drawLabel(part, opt, labels)).toDataURL('image/png');
      cache.set(part.id, url);
    }
    doc.addImage(url, 'PNG', pl.x, pl.y, s.labelW, s.labelH, undefined, 'FAST');
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
