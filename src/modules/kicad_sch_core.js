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

/**
 * Next placed (symbol ...) instance in a .kicad_sch file (skips symbol_instances header).
 */
export function nextSymbolBlock(src, searchFrom = 0) {
  const needle = '(symbol ';
  let i = src.indexOf(needle, searchFrom);
  while (i !== -1) {
    if (src.startsWith('(symbol_instances', i)) {
      i = src.indexOf(needle, i + 1);
      continue;
    }
    const blk = balancedParen(src, i);
    if (!blk) return null;
    return { block: blk.content, endIndex: blk.end };
  }
  return null;
}

export function extractPropertyValue(block, propName) {
  const esc = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\(property\\s+"${esc}"\\s+"((?:\\\\.|[^"\\\\])*)"`, 'm');
  const m = block.match(re);
  if (!m) return '';
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function extractFirstAt(block) {
  const m = block.match(/\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\)/);
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
    let at = extractPropertyAt(block, 'Reference')
      || extractPropertyAt(block, 'Value')
      || extractFirstAt(block);
    if (!at) at = { x: 0, y: 0 };
    placements.push({
      reference: reference.trim(),
      value: value.trim(),
      footprint: footprint.trim(),
      libId,
      x: at.x,
      y: at.y,
    });
  }
  return placements;
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

export function buildSchOverlaySvg(placements, wires, bounds, bomByNormKey, inventoryNormKeys) {
  const dw = Math.max(1e-9, bounds.maxX - bounds.minX);
  const dh = Math.max(1e-9, bounds.maxY - bounds.minY);
  const longSide = Math.max(dw, dh);
  const s = SCH_VIEW_LONG_SIDE / longSide;
  const vw = dw * s;
  const vh = dh * s;
  const nx = x => (x - bounds.minX) * s;
  const ny = y => (bounds.maxY - y) * s;

  const gid = `g${Math.random().toString(36).slice(2, 11)}`;
  const gridStep = Math.max(14, Math.min(48, Math.round(SCH_VIEW_LONG_SIDE / 22)));

  const lines = wires.map(seg => {
    const x1 = nx(seg.x1);
    const y1 = ny(seg.y1);
    const x2 = nx(seg.x2);
    const y2 = ny(seg.y2);
    return `<line x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}" stroke="var(--sch-wire)" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;
  }).join('\n');

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
    const label = escSvgText(p.reference || '?');
    const rawVal = (p.value || '').trim();
    const sub = escSvgText(rawVal.length > 22 ? `${rawVal.slice(0, 20)}...` : rawVal);
    const lx = cx + dotR + 5;
    const ty = cy - refSize * 0.15;
    const vy = cy + valSize * 0.95;
    markers.push(`
      <g class="sch-marker" data-status="${st}">
        <circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="${dotR.toFixed(2)}" fill="${stroke}" fill-opacity="0.96" stroke="var(--sch-marker-halo)" stroke-width="1.1" vector-effect="non-scaling-stroke" />
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
    <rect x="0" y="0" width="${vw.toFixed(2)}" height="${vh.toFixed(2)}" fill="url(#${gid})" opacity="0.9" />
    <g class="sch-wires">${lines}</g>
    <g class="sch-markers">${markers.join('')}</g>
  </svg>`;
}

export function parseKicadSchForOverlay(src, options = {}) {
  const tight = options.tightBounds !== false;
  const placements = parseKicadPlacements(src);
  const wires = extractWireSegments(src);
  const bounds = tight
    ? boundsForOverlay(placements, wires, 'tight')
    : boundsFromPlacementsAndWires(placements, wires);
  return { placements, wires, bounds };
}
