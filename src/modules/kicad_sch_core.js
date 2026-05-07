/**
 * Minimal KiCad 6+ / 7+ .kicad_sch s-expression parsing for overlay preview.
 * Coordinates are treated as mm (KiCad default in modern schematics).
 */

export function normalizePartKey(s) {
  if (s == null || s === '') return '';
  return String(s).toUpperCase().replace(/[\s\-_.]/g, '');
}

export function balancedParen(src, start) {
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

export function nextSymbolBlock(src, searchFrom = 0) {
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

export function extractPropertyValue(block, propName) {
  const esc = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\(property\\s+"${esc}"\\s+"((?:\\\\.|[^"\\\\])*)"`, 'm');
  const m = block.match(re);
  if (!m) return '';
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function extractFirstAt(block) {
  // Matches (at X Y) or (at X Y ROT) ignoring any extra flags before the closing parenthesis
  const m = block.match(/\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?[^)]*\)/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), rot: m[3] != null ? parseFloat(m[3]) : 0 };
}

export function extractPropertyAt(block, propName) {
  const esc = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\(property\\s+"${esc}"\\s+"[^"]*"[\\s\\S]*?\\(at\\s+([-\\d.]+)\\s+([-\\d.]+)`,
    'm'
  );
  const m = block.match(re);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

export function extractLibId(block) {
  const m = block.match(/\(lib_id\s+"([^"]*)"\)/);
  return m ? m[1] : '';
}

export function extractWireSegments(src) {
  const segments = [];
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
    const pairs = [];
    const xyRe = /\(xy\s+([-\d.]+)\s+([-\d.]+)\)/g;
    let xm;
    while ((xm = xyRe.exec(ptsBlk.content)) !== null) {
      pairs.push({ x: parseFloat(xm[1]), y: parseFloat(xm[2]) });
    }
    for (let k = 1; k < pairs.length; k++) {
      segments.push({
        x1: pairs[k - 1].x,
        y1: pairs[k - 1].y,
        x2: pairs[k].x,
        y2: pairs[k].y,
      });
    }
  }
  return segments;
}

export function parseKicadPlacements(src) {
  const placements = [];
  let pos = 0;
  let sym;
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
    const unit = unitM ? parseInt(unitM[1], 10) : 1;
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

function forEachTopLevelExpr(body, cb) {
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

function stripSymbolHeader(blockWithParens) {
  const inner = blockWithParens.slice(1, -1).trimStart();
  const m = inner.match(/^symbol\s+"([^"]*)"\s*/);
  if (!m) return { name: '', body: inner };
  return { name: String(m[1]).trim(), body: inner.slice(m[0].length) };
}

function extractPtsFromPolylineOrPts(expr) {
  const pi = expr.indexOf('(pts');
  if (pi === -1) return [];
  const ptsBlk = balancedParen(expr, pi);
  if (!ptsBlk) return [];
  const pairs = [];
  const xyRe = /\(xy\s+([-\d.]+)\s+([-\d.]+)\)/g;
  let xm;
  while ((xm = xyRe.exec(ptsBlk.content)) !== null) {
    pairs.push({ x: parseFloat(xm[1]), y: parseFloat(xm[2]) });
  }
  return pairs;
}

function addArcSegments(segs, sx, sy, mx, my, ex, ey) {
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
  const normSweep = s => {
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
  let bestSweep = candidates[0];
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

function addDrawablePrimitive(expr, segs) {
  if (expr.startsWith('(polyline')) {
    const pairs = extractPtsFromPolylineOrPts(expr);
    for (let i = 1; i < pairs.length; i++) {
      segs.push({
        x1: pairs[i - 1].x,
        y1: pairs[i - 1].y,
        x2: pairs[i].x,
        y2: pairs[i].y,
      });
    }
    return;
  }
  if (expr.startsWith('(rectangle')) {
    const sm = expr.match(/\(start\s+([-\d.]+)\s+([-\d.]+)\)/);
    const em = expr.match(/\(end\s+([-\d.]+)\s+([-\d.]+)\)/);
    if (sm && em) {
      const x1 = parseFloat(sm[1]);
      const y1 = parseFloat(sm[2]);
      const x2 = parseFloat(em[1]);
      const y2 = parseFloat(em[2]);
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
    const cx = parseFloat(cm[1]);
    const cy = parseFloat(cm[2]);
    const rad = Math.abs(parseFloat(cm[3]));
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
        parseFloat(stm[1]),
        parseFloat(stm[2]),
        parseFloat(midm[1]),
        parseFloat(midm[2]),
        parseFloat(endm[1]),
        parseFloat(endm[2])
      );
    }
    return;
  }
  if (expr.startsWith('(pin')) {
    const atPin = expr.match(/\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?/);
    const lenM = expr.match(/\(length\s+([-\d.]+)\)/);
    if (atPin && lenM) {
      const px = parseFloat(atPin[1]);
      const py = parseFloat(atPin[2]);
      const pr = atPin[3] != null ? parseFloat(atPin[3]) : 0;
      const L = parseFloat(lenM[1]);
      const rad = (pr * Math.PI) / 180;
      const x2 = px + L * Math.cos(rad);
      const y2 = py + L * Math.sin(rad);
      segs.push({ x1: px, y1: py, x2, y2 });
    }
  }
}

function registerLibSymbol(blockWithParens, out) {
  const { name, body } = stripSymbolHeader(blockWithParens);
  if (!name) return;
  const segs = [];
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

export function parseLibSymbolDrawMap(src) {
  const out = new Map();
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
export function resolveLibSegments(libMap, libId, unit = 1) {
  const segs = [];
  const seen = new Set();
  const add = arr => {
    if (!arr || !arr.length) return;
    for (const l of arr) {
      const k = `${l.x1}|${l.y1}|${l.x2}|${l.y2}`;
      if (seen.has(k)) continue;
      seen.add(k);
      segs.push(l);
    }
  };

  const collectForUnit = u => {
    const acc = [];
    const s = new Set();
    const add2 = arr => {
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
      const uNum = parseInt(um[1], 10);
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
    if (subs.length === 1) add(libMap.get(subs[0]));
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
function worldPointFromLibLocal(p, lx, ly) {
  let x = lx;
  let y = -ly;
  if (p.mirrorY) x = -x;
  if (p.mirrorX) y = -y;
  const rad = ((Number(p.rot) || 0) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x + x * c + y * s, y: p.y - x * s + y * c };
}

export function boundsFromPlacementsAndWires(placements, wires) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const bump = (x, y) => {
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
export function boundsForOverlay(placements, wires, mode = 'tight') {
  if (mode !== 'tight') {
    return boundsFromPlacementsAndWires(placements, wires);
  }
  const pts = [];
  for (const p of placements) {
    const ref = p.reference || '';
    if (ref.startsWith('#')) continue;
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push({ x: p.x, y: p.y });
  }
  if (!pts.length) {
    return boundsFromPlacementsAndWires(placements, wires);
  }

  let minX;
  let minY;
  let maxX;
  let maxY;
  if (pts.length >= 6) {
    const xs = pts.map(p => p.x).sort((a, b) => a - b);
    const ys = pts.map(p => p.y).sort((a, b) => a - b);
    const q = (arr, lo, hi) => {
      const n = arr.length;
      const i0 = Math.max(0, Math.min(n - 1, Math.floor((n - 1) * lo)));
      const i1 = Math.max(0, Math.min(n - 1, Math.ceil((n - 1) * hi)));
      return [Math.min(arr[i0], arr[i1]), Math.max(arr[i0], arr[i1])];
    };
    const [xLo, xHi] = q(xs, 0.02, 0.98);
    const [yLo, yHi] = q(ys, 0.02, 0.98);
    minX = xLo;
    maxX = xHi;
    minY = yLo;
    maxY = yHi;
    if (maxX - minX < 2) {
      minX = xs[0];
      maxX = xs[xs.length - 1];
    }
    if (maxY - minY < 2) {
      minY = ys[0];
      maxY = ys[ys.length - 1];
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

  const bump = (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  };

  const margin = 44;
  const near = (x, y) =>
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

export function placementInventoryMatchKeys(p) {
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
export function aggregateSchematicInventoryMatches(placements, components) {
  const byNorm = new Map();
  for (const c of components) {
    const k = normalizePartKey(c.part_code);
    if (k) byNorm.set(k, c);
  }
  const byCompId = new Map();
  for (const p of placements) {
    const keys = placementInventoryMatchKeys(p);
    if (!keys) continue;
    let comp = null;
    for (const k of keys) {
      if (byNorm.has(k)) {
        comp = byNorm.get(k);
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
    const row = byCompId.get(id);
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
export function classifyPlacement(p, bomByNormKey, inventoryNormKeys) {
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

const STATUS_STROKE = {
  ok: '#22c55e',
  short: '#f59e0b',
  unknown: '#ef4444',
  extra: '#94a3b8',
  unassigned: '#64748b',
  power: '#475569',
};

function escSvgText(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const SCH_VIEW_LONG_SIDE = 920;

function refPrefix(reference) {
  const m = String(reference || '').match(/^[A-Za-z]+/);
  return (m ? m[0] : '').toUpperCase();
}

function symbolGlyph(prefix, cx, cy, size, color) {
  const s = Math.max(3.5, size);
  const left = cx - s * 1.15;
  const right = cx + s * 1.15;
  const top = cy - s * 0.72;
  const bottom = cy + s * 0.72;

  if (prefix === 'R') {
    const step = (right - left) / 8;
    const y0 = cy;
    return `<line x1="${(left - 3).toFixed(2)}" y1="${y0.toFixed(2)}" x2="${left.toFixed(2)}" y2="${y0.toFixed(2)}" stroke="${color}" stroke-width="1.2" />
      <polyline points="${left.toFixed(2)},${y0.toFixed(2)} ${(left + step).toFixed(2)},${(y0 - s * 0.45).toFixed(2)} ${(left + step * 2).toFixed(2)},${(y0 + s * 0.45).toFixed(2)} ${(left + step * 3).toFixed(2)},${(y0 - s * 0.45).toFixed(2)} ${(left + step * 4).toFixed(2)},${(y0 + s * 0.45).toFixed(2)} ${(left + step * 5).toFixed(2)},${(y0 - s * 0.45).toFixed(2)} ${(left + step * 6).toFixed(2)},${(y0 + s * 0.45).toFixed(2)} ${(left + step * 7).toFixed(2)},${(y0 - s * 0.45).toFixed(2)} ${right.toFixed(2)},${y0.toFixed(2)}" fill="none" stroke="${color}" stroke-width="1.2" />
      <line x1="${right.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${(right + 3).toFixed(2)}" y2="${y0.toFixed(2)}" stroke="${color}" stroke-width="1.2" />`;
  }
  if (prefix === 'C') {
    return `<line x1="${(left - 3).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(left + s * 0.15).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${color}" stroke-width="1.2" />
      <line x1="${(left + s * 0.2).toFixed(2)}" y1="${top.toFixed(2)}" x2="${(left + s * 0.2).toFixed(2)}" y2="${bottom.toFixed(2)}" stroke="${color}" stroke-width="1.25" />
      <line x1="${(right - s * 0.2).toFixed(2)}" y1="${top.toFixed(2)}" x2="${(right - s * 0.2).toFixed(2)}" y2="${bottom.toFixed(2)}" stroke="${color}" stroke-width="1.25" />
      <line x1="${(right - s * 0.15).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(right + 3).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${color}" stroke-width="1.2" />`;
  }
  if (prefix === 'D') {
    const tipX = right - s * 0.2;
    const backX = left + s * 0.15;
    return `<line x1="${(left - 3).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${backX.toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${color}" stroke-width="1.2" />
      <polygon points="${backX.toFixed(2)},${top.toFixed(2)} ${backX.toFixed(2)},${bottom.toFixed(2)} ${tipX.toFixed(2)},${cy.toFixed(2)}" fill="none" stroke="${color}" stroke-width="1.2" />
      <line x1="${tipX.toFixed(2)}" y1="${top.toFixed(2)}" x2="${tipX.toFixed(2)}" y2="${bottom.toFixed(2)}" stroke="${color}" stroke-width="1.25" />
      <line x1="${tipX.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(right + 3).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${color}" stroke-width="1.2" />`;
  }
  if (prefix === 'Q') {
    const r = s * 0.72;
    return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${color}" stroke-width="1.2" />
      <line x1="${(cx - r - 3).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx - r).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${color}" stroke-width="1.2" />
      <line x1="${cx.toFixed(2)}" y1="${(cy - r).toFixed(2)}" x2="${cx.toFixed(2)}" y2="${(cy - r - 3).toFixed(2)}" stroke="${color}" stroke-width="1.2" />
      <line x1="${(cx + r * 0.35).toFixed(2)}" y1="${(cy + r * 0.35).toFixed(2)}" x2="${(cx + r + 3).toFixed(2)}" y2="${(cy + r + 3).toFixed(2)}" stroke="${color}" stroke-width="1.2" />`;
  }
  if (prefix === 'U' || prefix === 'IC') {
    return `<rect x="${(left + 0.5).toFixed(2)}" y="${(top + 0.2).toFixed(2)}" width="${(right - left - 1).toFixed(2)}" height="${(bottom - top - 0.4).toFixed(2)}" rx="${Math.max(0.6, s * 0.1).toFixed(2)}" fill="none" stroke="${color}" stroke-width="1.2" />
      <line x1="${(left - 3).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${left.toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${color}" stroke-width="1.2" />
      <line x1="${right.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(right + 3).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${color}" stroke-width="1.2" />`;
  }
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(s * 0.55).toFixed(2)}" fill="none" stroke="${color}" stroke-width="1.2" />`;
}

export function buildSchOverlaySvg(placements, wires, bounds, bomByNormKey, inventoryNormKeys, libDrawMap = new Map()) {
  const dw = Math.max(1e-9, bounds.maxX - bounds.minX);
  const dh = Math.max(1e-9, bounds.maxY - bounds.minY);
  const longSide = Math.max(dw, dh);
  const s = SCH_VIEW_LONG_SIDE / longSide;
  const vw = dw * s;
  const vh = dh * s;
  const nx = x => (x - bounds.minX) * s;
  const ny = y => (y - bounds.minY) * s;

  const gid = `g${Math.random().toString(36).slice(2, 11)}`;
  const gridStep = Math.max(18, Math.min(56, Math.round(SCH_VIEW_LONG_SIDE / 20)));

  const lines = wires.map(seg => {
    const x1 = nx(seg.x1);
    const y1 = ny(seg.y1);
    const x2 = nx(seg.x2);
    const y2 = ny(seg.y2);
    return `<line x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}" stroke="var(--sch-wire)" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;
  }).join('\n');

  const symbolShapes = [];
  for (const p of placements) {
    const segs = resolveLibSegments(libDrawMap, p.libId, p.unit != null ? p.unit : 1);
    if (!segs.length) continue;
    for (const s0 of segs) {
      const a = worldPointFromLibLocal(p, s0.x1, s0.y1);
      const b = worldPointFromLibLocal(p, s0.x2, s0.y2);
      symbolShapes.push(
        `<line x1="${nx(a.x).toFixed(3)}" y1="${ny(a.y).toFixed(3)}" x2="${nx(b.x).toFixed(3)}" y2="${ny(b.y).toFixed(3)}" stroke="var(--sch-symbol)" stroke-width="1.15" stroke-linecap="round" opacity="0.92" vector-effect="non-scaling-stroke" />`
      );
    }
  }

  const markers = [];
  const refSize = Math.max(10, Math.min(15, 11 + longSide / 180));
  const valSize = Math.max(8.5, refSize - 2);
  const dotR = Math.max(4.2, Math.min(7.5, 5 + longSide / 220));

  for (const p of placements) {
    const st = classifyPlacement(p, bomByNormKey, inventoryNormKeys);
    if (st === 'power') continue;
    const cx = nx(p.x);
    const cy = ny(p.y);
    const stroke = STATUS_STROKE[st] || STATUS_STROKE.unknown;
    const prefix = refPrefix(p.reference);
    const libSegs = resolveLibSegments(libDrawMap, p.libId, p.unit != null ? p.unit : 1);
    const useFallbackGlyph = !libSegs.length;
    const statusR = useFallbackGlyph ? dotR * 0.55 : dotR * 0.38;
    const label = escSvgText(p.reference || '?');
    const rawVal = (p.value || '').trim();
    const sub = escSvgText(rawVal.length > 22 ? `${rawVal.slice(0, 20)}...` : rawVal);
    const lx = cx + dotR + 5;
    const ty = cy - refSize * 0.15;
    const vy = cy + valSize * 0.95;
    markers.push(`
      <g class="sch-marker" data-status="${st}">
        ${useFallbackGlyph ? symbolGlyph(prefix, cx, cy, dotR, 'var(--sch-wire)') : ''}
        <circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="${statusR.toFixed(2)}" fill="${stroke}" fill-opacity="0.98" stroke="var(--sch-marker-halo)" stroke-width="1.1" vector-effect="non-scaling-stroke" />
        <text x="${lx.toFixed(2)}" y="${ty.toFixed(2)}" fill="var(--text-primary)" font-size="${refSize.toFixed(2)}" font-weight="600" font-family="var(--font-mono, 'JetBrains Mono', monospace)" stroke="var(--sch-label-stroke)" stroke-width="0.35" paint-order="stroke fill">${label}</text>
        ${rawVal ? `<text x="${lx.toFixed(2)}" y="${vy.toFixed(2)}" fill="var(--text-muted)" font-size="${valSize.toFixed(2)}" font-family="var(--font-mono, 'JetBrains Mono', monospace)" stroke="var(--sch-label-stroke)" stroke-width="0.28" paint-order="stroke fill">${sub}</text>` : ''}
      </g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="schematic overlay" style="display:block;background:transparent">
    <defs>
      <pattern id="${gid}" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse">
        <path d="M ${gridStep} 0 L 0 0 0 ${gridStep}" fill="none" stroke="var(--sch-grid-line)" stroke-width="0.55" />
      </pattern>
    </defs>
    <rect x="0" y="0" width="${vw.toFixed(2)}" height="${vh.toFixed(2)}" fill="var(--sch-canvas)" />
    <rect x="0" y="0" width="${vw.toFixed(2)}" height="${vh.toFixed(2)}" fill="url(#${gid})" opacity="0.28" />
    <g class="sch-wires">${lines}</g>
    <g class="sch-symbols">${symbolShapes.join('')}</g>
    <g class="sch-markers">${markers.join('')}</g>
  </svg>`;
}

export function parseKicadSchForOverlay(src, options = {}) {
  const tight = options.tightBounds !== false;
  const placements = parseKicadPlacements(src);
  const wires = extractWireSegments(src);
  const libDrawMap = parseLibSymbolDrawMap(src);
  const bounds = tight
    ? boundsForOverlay(placements, wires, 'tight')
    : boundsFromPlacementsAndWires(placements, wires);
  return { placements, wires, bounds, libDrawMap };
}
