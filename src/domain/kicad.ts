/**
 * Minimal KiCad 6+ `.kicad_sch` parsing for the schematic overlay and the BOM import (ported from
 * the old app's kicad_sch_core.js; the SVG is now drawn by a component from `buildOverlayModel`).
 * Coordinates are millimetres.
 */

export interface Point { x: number; y: number }
export interface Segment { x1: number; y1: number; x2: number; y2: number }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export interface Placement {
  reference: string;
  value: string;
  footprint: string;
  libId: string;
  x: number;
  y: number;
  rot: number;
  unit: number;
  mirrorY: boolean;
  mirrorX: boolean;
}
export interface SchematicMatch { component_id: number; part_code: string; qty: number; refs: string[] }
export type PlacementStatus = 'power' | 'unassigned' | 'unknown' | 'ok' | 'short' | 'extra';


export function normalizePartKey(s: unknown): string {
  if (s == null || s === '') return '';
  return String(s).toUpperCase().replace(/[\s\-_.]/g, '');
}

export function balancedParen(src: string, start: number): { content: string; end: number } | null {
  if (!src || start < 0 || src[start] !== '(') return null;
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    if (src[j] === '(') depth++;
    else if (src[j] === ')') {
      depth--;
      if (depth === 0) return { content: src.slice(start, j + 1), end: j + 1 };
    }
  }
  return null;
}

export function nextSymbolBlock(src: string, searchFrom = 0): { block: string; endIndex: number } | null {
  while (true) {
    const i = src.indexOf('(symbol', searchFrom);
    if (i === -1) return null;

    const nextChar = src[i + 7];
    if (nextChar !== ' ' && nextChar !== '\n' && nextChar !== '\t' && nextChar !== '\r') {
      searchFrom = i + 7;
      continue;
    }

    const blk = balancedParen(src, i);
    if (!blk) return null;

    // Skip the lib_symbols / symbol_instances / symbol_lib_table containers
    // and any bare library definition that does not represent a placement.
    const head = blk.content.slice(0, 400);
    if (head.includes('(lib_id') || head.includes('(lib_name')) {
      return { block: blk.content, endIndex: blk.end };
    }

    searchFrom = blk.end;
  }
}

export function extractPropertyValue(block: string, propName: string): string {
  const esc = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\(property\\s+"${esc}"\\s+"((?:\\\\.|[^"\\\\])*)"`, 'm');
  const m = block.match(re);
  if (!m) return '';
  return (m[1] ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function extractFirstAt(block: string): { x: number; y: number; rot: number } | null {
  // Matches (at X Y) or (at X Y ROT) ignoring any extra flags before the closing parenthesis
  const m = block.match(/\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?[^)]*\)/);
  if (!m) return null;
  return { x: parseFloat(m[1]!), y: parseFloat(m[2]!), rot: m[3] != null ? parseFloat(m[3]) : 0 };
}

export function extractPropertyAt(block: string, propName: string): Point | null {
  const esc = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\(property\\s+"${esc}"\\s+"[^"]*"[\\s\\S]*?\\(at\\s+([-\\d.]+)\\s+([-\\d.]+)`,
    'm'
  );
  const m = block.match(re);
  if (!m) return null;
  return { x: parseFloat(m[1]!), y: parseFloat(m[2]!) };
}

export function extractLibId(block: string): string {
  const m = block.match(/\(lib_id\s+"([^"]*)"\)/);
  return m ? (m[1] ?? '') : '';
}

export function extractWireSegments(src: string): Segment[] {
  const segments: Segment[] = [];
  let pos = 0;
  while (pos < src.length) {
    const w = src.indexOf('(wire', pos);
    if (w === -1) break;
    const blk = balancedParen(src, w);
    if (!blk) {
      pos = w + 5;
      continue;
    }
    pos = blk.end;
    if (!blk.content.includes('(uuid ')) continue;
    const rel = blk.content.indexOf('(pts');
    if (rel === -1) continue;
    const absPts = w + rel;
    const ptsBlk = balancedParen(src, absPts);
    if (!ptsBlk) continue;
    const pairs: Point[] = [];
    const xyRe = /\(xy\s+([-\d.]+)\s+([-\d.]+)\)/g;
    let xm: RegExpExecArray | null;
    while ((xm = xyRe.exec(ptsBlk.content)) !== null) {
      pairs.push({ x: parseFloat(xm[1]!), y: parseFloat(xm[2]!) });
    }
    for (let k = 1; k < pairs.length; k++) {
      segments.push({ x1: pairs[k - 1]!.x, y1: pairs[k - 1]!.y, x2: pairs[k]!.x, y2: pairs[k]!.y });
    }
  }
  return segments;
}

export function parseKicadPlacements(src: string): Placement[] {
  const placements: Placement[] = [];
  let pos = 0;
  let sym: { block: string; endIndex: number } | null;
  while ((sym = nextSymbolBlock(src, pos)) != null) {
    pos = sym.endIndex;
    const block = sym.block;
    if (!block.includes('(property "Reference"')) continue;
    const reference = extractPropertyValue(block, 'Reference');
    const value = extractPropertyValue(block, 'Value');
    const footprint = extractPropertyValue(block, 'Footprint');
    const libId = extractLibId(block);
    if (!reference.trim()) continue;
    let at = extractFirstAt(block);
    if (!at) at = { x: 0, y: 0, rot: 0 };
    const unitM = block.match(/\(unit\s+(\d+)\)/);
    const unit = unitM ? parseInt(unitM[1]!, 10) : 1;
    const mirrorY = /\(mirror\s+y\)/.test(block);
    const mirrorX = /\(mirror\s+x\)/.test(block);
    placements.push({
      reference: reference.trim(),
      value: value.trim(),
      footprint: footprint.trim(),
      libId,
      x: at.x,
      y: at.y,
      rot: Number.isFinite(at.rot) ? at.rot : 0,
      unit,
      mirrorY,
      mirrorX,
    });
  }
  return placements;
}

function forEachTopLevelExpr(body: string, cb: (expr: string) => void): void {
  let pos = 0;
  while (pos < body.length) {
    const o = body.indexOf('(', pos);
    if (o === -1) break;
    const blk = balancedParen(body, o);
    if (!blk) break;
    cb(blk.content);
    pos = blk.end;
  }
}

function stripSymbolHeader(blockWithParens: string): { name: string; body: string } {
  const inner = blockWithParens.slice(1, -1).trimStart();
  const m = inner.match(/^symbol\s+"([^"]*)"\s*/);
  if (!m) return { name: '', body: inner };
  return { name: String(m[1]).trim(), body: inner.slice(m[0].length) };
}

function extractPtsFromPolylineOrPts(expr: string): Point[] {
  const pi = expr.indexOf('(pts');
  if (pi === -1) return [];
  const ptsBlk = balancedParen(expr, pi);
  if (!ptsBlk) return [];
  const pairs: Point[] = [];
  const xyRe = /\(xy\s+([-\d.]+)\s+([-\d.]+)\)/g;
  let xm: RegExpExecArray | null;
  while ((xm = xyRe.exec(ptsBlk.content)) !== null) {
    pairs.push({ x: parseFloat(xm[1]!), y: parseFloat(xm[2]!) });
  }
  return pairs;
}

function addArcSegments(segs: Segment[], sx: number, sy: number, mx: number, my: number, ex: number, ey: number): void {
  const d = 2 * (sx * (my - ey) + mx * (ey - sy) + ex * (sy - my));
  if (Math.abs(d) < 1e-12) {
    segs.push({ x1: sx, y1: sy, x2: ex, y2: ey });
    return;
  }
  const s1 = sx * sx + sy * sy;
  const s2 = mx * mx + my * my;
  const s3 = ex * ex + ey * ey;
  const ux = (s1 * (my - ey) + s2 * (ey - sy) + s3 * (sy - my)) / d;
  const uy = (s1 * (ex - mx) + s2 * (sx - ex) + s3 * (mx - sx)) / d;
  const r = Math.hypot(sx - ux, sy - uy);
  const a0 = Math.atan2(sy - uy, sx - ux);
  const twoPi = 2 * Math.PI;
  const normSweep = (s: number): number => {
    let t = s;
    while (t <= -Math.PI) t += twoPi;
    while (t > Math.PI) t -= twoPi;
    return t;
  };
  const candidates = [
    normSweep(Math.atan2(ey - uy, ex - ux) - a0),
    normSweep(Math.atan2(ey - uy, ex - ux) - a0 + twoPi),
    normSweep(Math.atan2(ey - uy, ex - ux) - a0 - twoPi),
  ];
  let bestSweep = candidates[0]!;
  let bestErr = Infinity;
  for (const cand of candidates) {
    const midAng = a0 + cand * 0.5;
    const mx2 = ux + r * Math.cos(midAng);
    const my2 = uy + r * Math.sin(midAng);
    const err = Math.hypot(mx2 - mx, my2 - my);
    if (err < bestErr) {
      bestErr = err;
      bestSweep = cand;
    }
  }
  const n = Math.max(10, Math.min(40, Math.ceil((Math.abs(bestSweep) * r) / 0.4)));
  for (let i = 0; i < n; i++) {
    const t0 = a0 + (bestSweep * i) / n;
    const t1 = a0 + (bestSweep * (i + 1)) / n;
    segs.push({
      x1: ux + r * Math.cos(t0),
      y1: uy + r * Math.sin(t0),
      x2: ux + r * Math.cos(t1),
      y2: uy + r * Math.sin(t1),
    });
  }
}

function addDrawablePrimitive(expr: string, segs: Segment[]): void {
  if (expr.startsWith('(polyline')) {
    const pairs = extractPtsFromPolylineOrPts(expr);
    for (let i = 1; i < pairs.length; i++) {
      segs.push({ x1: pairs[i - 1]!.x, y1: pairs[i - 1]!.y, x2: pairs[i]!.x, y2: pairs[i]!.y });
    }
    return;
  }
  if (expr.startsWith('(rectangle')) {
    const sm = expr.match(/\(start\s+([-\d.]+)\s+([-\d.]+)\)/);
    const em = expr.match(/\(end\s+([-\d.]+)\s+([-\d.]+)\)/);
    if (sm && em) {
      const x1 = parseFloat(sm[1]!);
      const y1 = parseFloat(sm[2]!);
      const x2 = parseFloat(em[1]!);
      const y2 = parseFloat(em[2]!);
      segs.push({ x1, y1, x2, y2: y1 });
      segs.push({ x1: x2, y1, x2, y2 });
      segs.push({ x1: x2, y1: y2, x2: x1, y2 });
      segs.push({ x1, y1: y2, x2: x1, y2: y1 });
    }
    return;
  }
  if (expr.startsWith('(circle')) {
    const cm = expr.match(/\(center\s+([-\d.]+)\s+([-\d.]+)\)\s+\(radius\s+([-\d.]+)\)/);
    if (!cm) return;
    const cx = parseFloat(cm[1]!);
    const cy = parseFloat(cm[2]!);
    const rad = Math.abs(parseFloat(cm[3]!));
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const a0 = (Math.PI * 2 * i) / steps;
      const a1 = (Math.PI * 2 * (i + 1)) / steps;
      segs.push({
        x1: cx + Math.cos(a0) * rad,
        y1: cy + Math.sin(a0) * rad,
        x2: cx + Math.cos(a1) * rad,
        y2: cy + Math.sin(a1) * rad,
      });
    }
    return;
  }
  if (expr.startsWith('(arc')) {
    const stm = expr.match(/\(start\s+([-\d.]+)\s+([-\d.]+)\)/);
    const midm = expr.match(/\(mid\s+([-\d.]+)\s+([-\d.]+)\)/);
    const endm = expr.match(/\(end\s+([-\d.]+)\s+([-\d.]+)\)/);
    if (stm && midm && endm) {
      addArcSegments(
        segs,
        parseFloat(stm[1]!),
        parseFloat(stm[2]!),
        parseFloat(midm[1]!),
        parseFloat(midm[2]!),
        parseFloat(endm[1]!),
        parseFloat(endm[2]!)
      );
    }
    return;
  }
  if (expr.startsWith('(pin')) {
    const atPin = expr.match(/\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?/);
    const lenM = expr.match(/\(length\s+([-\d.]+)\)/);
    if (atPin && lenM) {
      const px = parseFloat(atPin[1]!);
      const py = parseFloat(atPin[2]!);
      const pr = atPin[3] != null ? parseFloat(atPin[3]) : 0;
      const L = parseFloat(lenM[1]!);
      const rad = (pr * Math.PI) / 180;
      const x2 = px + L * Math.cos(rad);
      const y2 = py + L * Math.sin(rad);
      segs.push({ x1: px, y1: py, x2, y2 });
    }
  }
}

function registerLibSymbol(blockWithParens: string, out: Map<string, Segment[]>): void {
  const { name, body } = stripSymbolHeader(blockWithParens);
  if (!name) return;
  const segs: Segment[] = [];
  forEachTopLevelExpr(body, expr => {
    if (expr.startsWith('(symbol ')) {
      const sub = balancedParen(expr, 0);
      if (sub) registerLibSymbol(sub.content, out);
      return;
    }
    addDrawablePrimitive(expr, segs);
  });
  if (segs.length) {
    const prev = out.get(name);
    out.set(name, prev ? prev.concat(segs) : segs);
  }
}

export function parseLibSymbolDrawMap(src: string): Map<string, Segment[]> {
  const out = new Map<string, Segment[]>();
  const li = src.indexOf('(lib_symbols');
  if (li === -1) return out;
  const libBlk = balancedParen(src, li);
  if (!libBlk) return out;
  const inner = libBlk.content.slice(1, -1).trimStart();
  const hdr = inner.match(/^lib_symbols\s+/);
  const body = hdr ? inner.slice(hdr[0].length) : inner;
  forEachTopLevelExpr(body, expr => {
    if (expr.startsWith('(symbol ')) {
      const blk = balancedParen(expr, 0);
      if (blk) registerLibSymbol(blk.content, out);
    }
  });
  return out;
}

/**
 * Lines from lib_symbols for a placement lib_id and schematic unit index.
 */
export function resolveLibSegments(libMap: Map<string, Segment[]>, libId: string, unit = 1): Segment[] {
  const segs: Segment[] = [];
  const seen = new Set<string>();
  const add = (arr: Segment[] | undefined): void => {
    if (!arr || !arr.length) return;
    for (const l of arr) {
      const k = `${l.x1}|${l.y1}|${l.x2}|${l.y2}`;
      if (seen.has(k)) continue;
      seen.add(k);
      segs.push(l);
    }
  };

  const collectForUnit = (u: number): Segment[] => {
    const acc: Segment[] = [];
    const s = new Set<string>();
    const add2 = (arr: Segment[] | undefined): void => {
      if (!arr || !arr.length) return;
      for (const l of arr) {
        const k = `${l.x1}|${l.y1}|${l.x2}|${l.y2}`;
        if (s.has(k)) continue;
        s.add(k);
        acc.push(l);
      }
    };
    add2(libMap.get(libId));
    const prefix = `${libId}_`;
    for (const [k, arr] of libMap) {
      if (k === libId) continue;
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      const um = rest.match(/^(\d+)_(\d+)$/);
      if (!um) continue;
      const uNum = parseInt(um[1]!, 10);
      if (uNum === u) add2(arr);
    }
    return acc;
  };

  let result = collectForUnit(unit);
  add(result);

  if (!segs.length && unit !== 1) {
    result = collectForUnit(1);
    for (const x of result) {
      const k = `${x.x1}|${x.y1}|${x.x2}|${x.y2}`;
      if (!seen.has(k)) {
        seen.add(k);
        segs.push(x);
      }
    }
  }

  if (!segs.length) {
    const prefix = `${libId}_`;
    const subs = [...libMap.keys()].filter(k => k.startsWith(prefix)).sort();
    if (subs.length === 1) add(libMap.get(subs[0]!));
  }

  return segs;
}

/**
 * Convert a lib_symbol local point to schematic world coordinates.
 *
 * KiCad lib_symbols are stored in the legacy mathematical Y-up system, while
 * .kicad_sch placements (and wires) live in screen-style Y-down coordinates.
 * We negate the local Y once before applying mirror and rotation so that the
 * resulting world point is consistent with the wire coordinate space and the
 * SVG's natural Y-down rendering.
 *
 * Mirror handling matches eeschema:
 *   (mirror y) flips around the local X axis (negate local X)
 *   (mirror x) flips around the local Y axis (negate local Y)
 * Rotation in KiCad is clockwise in degrees (0/90/180/270).
 */
export function worldPointFromLibLocal(p: Placement, lx: number, ly: number): Point {
  let x = lx;
  let y = -ly;
  if (p.mirrorY) x = -x;
  if (p.mirrorX) y = -y;
  const rad = ((Number(p.rot) || 0) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x + x * c + y * s, y: p.y - x * s + y * c };
}

export function boundsFromPlacementsAndWires(placements: Placement[], wires: Segment[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const bump = (x: number, y: number): void => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  };
  for (const p of placements) bump(p.x, p.y);
  for (const w of wires) {
    bump(w.x1, w.y1);
    bump(w.x2, w.y2);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 200, maxY: 150 };
  }
  const pad = 15;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

/**
 * Zoom-friendly bounds: ignore distant outliers (title block), add nearby wires.
 */
export function boundsForOverlay(placements: Placement[], wires: Segment[], mode = 'tight'): Bounds {
  if (mode !== 'tight') {
    return boundsFromPlacementsAndWires(placements, wires);
  }
  const pts: Point[] = [];
  for (const p of placements) {
    const ref = p.reference || '';
    if (ref.startsWith('#')) continue;
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push({ x: p.x, y: p.y });
  }
  if (!pts.length) {
    return boundsFromPlacementsAndWires(placements, wires);
  }

  let minX: number;
  let minY: number;
  let maxX: number;
  let maxY: number;
  if (pts.length >= 6) {
    const xs = pts.map(p => p.x).sort((a, b) => a - b);
    const ys = pts.map(p => p.y).sort((a, b) => a - b);
    const q = (arr: number[], lo: number, hi: number): [number, number] => {
      const n = arr.length;
      const i0 = Math.max(0, Math.min(n - 1, Math.floor((n - 1) * lo)));
      const i1 = Math.max(0, Math.min(n - 1, Math.ceil((n - 1) * hi)));
      return [Math.min(arr[i0]!, arr[i1]!), Math.max(arr[i0]!, arr[i1]!)];
    };
    const [xLo, xHi] = q(xs, 0.02, 0.98);
    const [yLo, yHi] = q(ys, 0.02, 0.98);
    minX = xLo;
    maxX = xHi;
    minY = yLo;
    maxY = yHi;
    if (maxX - minX < 2) {
      minX = xs[0]!;
      maxX = xs[xs.length - 1]!;
    }
    if (maxY - minY < 2) {
      minY = ys[0]!;
      maxY = ys[ys.length - 1]!;
    }
  } else {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }

  const pad = 30;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const bump = (x: number, y: number): void => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  };

  const margin = 44;
  const near = (x: number, y: number): boolean =>
    x >= minX - margin &&
    x <= maxX + margin &&
    y >= minY - margin &&
    y <= maxY + margin;
  for (const w of wires) {
    if (near(w.x1, w.y1) || near(w.x2, w.y2)) {
      bump(w.x1, w.y1);
      bump(w.x2, w.y2);
    }
  }
  return { minX, minY, maxX, maxY };
}

export function placementInventoryMatchKeys(p: Placement): string[] | null {
  const ref = p.reference || '';
  if (ref.startsWith('#')) return null;
  if (/^[A-Za-z]+\?$/.test(ref)) return null;
  const fpTail = (p.footprint || '').split(':').pop() || '';
  const libTail = (p.libId || '').split(':').pop() || '';
  const keys = [p.value, fpTail, libTail].map(normalizePartKey).filter(Boolean);
  return keys.length ? keys : null;
}

/**
 * Count schematic instances that match inventory part_code (Value / footprint / lib tail).
 * Returns rows: { component_id, part_code, qty, refs }.
 */
export function aggregateSchematicInventoryMatches(placements: Placement[], components: Array<{ id: number; part_code: string }>): SchematicMatch[] {
  const byNorm = new Map<string, { id: number; part_code: string }>();
  for (const c of components) {
    const k = normalizePartKey(c.part_code);
    if (k) byNorm.set(k, c);
  }
  const byCompId = new Map<number, SchematicMatch>();
  for (const p of placements) {
    const keys = placementInventoryMatchKeys(p);
    if (!keys) continue;
    let comp: { id: number; part_code: string } | null = null;
    for (const k of keys) {
      if (byNorm.has(k)) {
        comp = byNorm.get(k)!;
        break;
      }
    }
    if (!comp) continue;
    const id = comp.id;
    if (!byCompId.has(id)) {
      byCompId.set(id, {
        component_id: id,
        part_code: comp.part_code,
        qty: 0,
        refs: [],
      });
    }
    const row = byCompId.get(id)!;
    row.qty += 1;
    const r = p.reference || '';
    if (r && row.refs.length < 16) row.refs.push(r);
  }
  return [...byCompId.values()];
}

/**
 * bomByNormKey: Map<string, { required: number, stock: number }>
 * inventoryNormKeys: Set<string> of all normalized part codes in inventory
 */
export function classifyPlacement(p: Placement, bomByNormKey: Map<string, { required: number; stock: number }>, inventoryNormKeys: Set<string>): PlacementStatus {
  const ref = p.reference || '';
  if (ref.startsWith('#')) return 'power';
  if (/^[A-Za-z]+\?$/.test(ref)) return 'unassigned';

  const fpTail = (p.footprint || '').split(':').pop() || '';
  const libTail = (p.libId || '').split(':').pop() || '';
  const candidates = [p.value, fpTail, libTail].map(normalizePartKey).filter(Boolean);

  let matched = '';
  for (const c of candidates) {
    if (bomByNormKey.has(c)) {
      matched = c;
      break;
    }
  }
  if (!matched) {
    for (const c of candidates) {
      if (inventoryNormKeys.has(c)) {
        matched = c;
        break;
      }
    }
  }

  if (!matched) return 'unknown';

  const bom = bomByNormKey.get(matched);
  if (bom) {
    const need = Math.max(1, Number(bom.required) || 1);
    const stock = Math.max(0, Number(bom.stock) || 0);
    return stock >= need ? 'ok' : 'short';
  }
  return 'extra';
}


export interface OverlayMarker {
  x: number;
  y: number;
  status: PlacementStatus;
  reference: string;
  value: string;
  /** Reference prefix (R, C, D, Q, U) for the fallback glyph when the library has no drawing. */
  glyph: string | null;
}

export interface OverlayModel {
  width: number;
  height: number;
  wires: Segment[];
  symbols: Segment[];
  markers: OverlayMarker[];
  refSize: number;
  dotR: number;
}

const VIEW_LONG_SIDE = 920;

/** Everything the overlay component draws, in view coordinates (long side 920). */
export function buildOverlayModel(src: string, bom: Map<string, { required: number; stock: number }>, inventory: Set<string>): OverlayModel | null {
  const placements = parseKicadPlacements(src);
  const wires = extractWireSegments(src);
  if (!placements.length && !wires.length) return null;
  const lib = parseLibSymbolDrawMap(src);
  const b = boundsForOverlay(placements, wires, 'tight');
  const dw = Math.max(1e-9, b.maxX - b.minX);
  const dh = Math.max(1e-9, b.maxY - b.minY);
  const longSide = Math.max(dw, dh);
  const s = VIEW_LONG_SIDE / longSide;
  const nx = (x: number) => (x - b.minX) * s;
  const ny = (y: number) => (y - b.minY) * s;
  const symbols: Segment[] = [];
  const markers: OverlayMarker[] = [];
  for (const p of placements) {
    const segs = resolveLibSegments(lib, p.libId, p.unit ?? 1);
    for (const seg of segs) {
      const a = worldPointFromLibLocal(p, seg.x1, seg.y1);
      const c = worldPointFromLibLocal(p, seg.x2, seg.y2);
      symbols.push({ x1: nx(a.x), y1: ny(a.y), x2: nx(c.x), y2: ny(c.y) });
    }
    const status = classifyPlacement(p, bom, inventory);
    if (status === 'power') continue;
    const prefix = (/^[A-Za-z]+/.exec(p.reference)?.[0] ?? '').toUpperCase();
    markers.push({ x: nx(p.x), y: ny(p.y), status, reference: p.reference || '?', value: p.value, glyph: segs.length ? null : prefix });
  }
  return {
    width: dw * s,
    height: dh * s,
    wires: wires.map((w) => ({ x1: nx(w.x1), y1: ny(w.y1), x2: nx(w.x2), y2: ny(w.y2) })),
    symbols,
    markers,
    refSize: Math.max(10, Math.min(15, 11 + longSide / 180)),
    dotR: Math.max(4.2, Math.min(7.5, 5 + longSide / 220)),
  };
}

/** BOM lines from a schematic: one per inventory part, counted by placements (for the import). */
export function bomFromSchematic(src: string, components: Array<{ id: number; part_code: string }>): { matches: SchematicMatch[]; unmatched: Placement[] } {
  const placements = parseKicadPlacements(src).filter((p) => !p.reference.startsWith('#'));
  const matches = aggregateSchematicInventoryMatches(placements, components);
  const matchedRefs = new Set(matches.flatMap((m) => m.refs));
  return { matches, unmatched: placements.filter((p) => !matchedRefs.has(p.reference)) };
}
