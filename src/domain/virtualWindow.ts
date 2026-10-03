/**
 * Windowing math for the inventory table: only the rows near the viewport are in the DOM.
 * Pure, so it is unit-tested without a browser.
 */
export interface WindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  total: number;
  overscan?: number;
}

export interface WindowRange {
  start: number;
  end: number;
  padTop: number;
  padBottom: number;
}

export function computeWindow({ scrollTop, viewportHeight, rowHeight, total, overscan = 15 }: WindowInput): WindowRange {
  const rh = rowHeight > 0 ? rowHeight : 36;
  const vh = viewportHeight > 0 ? viewportHeight : 800;
  const top = Math.max(0, scrollTop || 0);
  const start = Math.max(0, Math.floor(top / rh) - overscan);
  const end = Math.min(total, Math.ceil((top + vh) / rh) + overscan);
  const s = Math.min(start, Math.max(0, total - 1));
  return {
    start: total === 0 ? 0 : s,
    end: Math.max(end, 0),
    padTop: Math.min(start, total) * rh,
    padBottom: Math.max(0, total - end) * rh,
  };
}
