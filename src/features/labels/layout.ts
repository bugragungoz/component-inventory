/**
 * Label sheets. Pure geometry so it is unit-tested: where each label sits on which page.
 * Text is drawn on a canvas and placed as an image, so Turkish, Cyrillic, Chinese and Arabic
 * print correctly (the PDF's built-in fonts only cover Western European letters).
 */
export interface LabelSheet {
  id: string;
  /** Page size in mm. */
  pageW: number;
  pageH: number;
  /** Label size in mm. */
  labelW: number;
  labelH: number;
  cols: number;
  rows: number;
  /** Top-left of the first label and the gaps between labels, in mm. */
  marginX: number;
  marginY: number;
  gapX: number;
  gapY: number;
}

export const SHEETS: LabelSheet[] = [
  { id: 'a4-2x7', pageW: 210, pageH: 297, labelW: 95, labelH: 38, cols: 2, rows: 7, marginX: 8, marginY: 10.5, gapX: 4, gapY: 2 },
  { id: 'a4-3x8', pageW: 210, pageH: 297, labelW: 63.5, labelH: 33.9, cols: 3, rows: 8, marginX: 7.2, marginY: 13.1, gapX: 2.5, gapY: 0 },
  { id: 'roll-50x25', pageW: 50, pageH: 25, labelW: 50, labelH: 25, cols: 1, rows: 1, marginX: 0, marginY: 0, gapX: 0, gapY: 0 },
];

export interface Placed {
  page: number;
  x: number;
  y: number;
  index: number;
}

/** Positions for `count` labels, skipping `skip` slots on the first sheet (a part-used sheet). */
export function placeLabels(sheet: LabelSheet, count: number, skip = 0): Placed[] {
  const perPage = sheet.cols * sheet.rows;
  const out: Placed[] = [];
  for (let i = 0; i < count; i++) {
    const slot = i + Math.max(0, Math.min(skip, perPage - 1));
    const page = Math.floor(slot / perPage);
    const inPage = slot % perPage;
    const col = inPage % sheet.cols;
    const row = Math.floor(inPage / sheet.cols);
    out.push({ page, index: i, x: sheet.marginX + col * (sheet.labelW + sheet.gapX), y: sheet.marginY + row * (sheet.labelH + sheet.gapY) });
  }
  return out;
}

export function pageCount(sheet: LabelSheet, count: number, skip = 0): number {
  const placed = placeLabels(sheet, count, skip);
  return placed.length ? placed[placed.length - 1]!.page + 1 : 0;
}
