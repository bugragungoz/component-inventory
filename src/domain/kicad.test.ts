import { describe, it, expect } from 'vitest';
import {
  normalizePartKey,
  parseKicadPlacements,
  extractWireSegments,
  classifyPlacement,
  aggregateSchematicInventoryMatches,
  parseLibSymbolDrawMap,
  resolveLibSegments,
  buildOverlayModel,
  boundsForOverlay,
} from './kicad';

const MINIMAL_SCH = `(kicad_sch (version 20231120) (generator eeschema)
  (lib_symbols
    (symbol "Device:R" (pin_numbers hide)
      (symbol "Device:R_1_0"
        (polyline (pts (xy -3.81 0) (xy -2.54 0)) (stroke (width 0) (type default)))
        (polyline (pts (xy 2.54 0) (xy 3.81 0)) (stroke (width 0) (type default)))
      )
    )
  )
  (symbol (lib_id "Device:R") (at 10 20 0) (unit 1)
    (property "Reference" "R1" (at 11 19 0) (effects (font (size 1.27 1.27))))
    (property "Value" "10K" (at 12 21 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 0 0 0))
  )
  (wire (pts (xy 5 5) (xy 15 5)) (stroke (width 0) (type default)) (uuid "w-1"))
)`;

describe('kicad_sch_core', () => {
  it('normalizes part keys', () => {
    expect(normalizePartKey('10 k')).toBe('10K');
    expect(normalizePartKey('LM-7805')).toBe('LM7805');
  });

  it('parses one resistor placement and one wire segment', () => {
    const placements = parseKicadPlacements(MINIMAL_SCH);
    expect(placements).toHaveLength(1);
    expect(placements[0]!.reference).toBe('R1');
    expect(placements[0]!.value).toBe('10K');
    expect(placements[0]!.libId).toBe('Device:R');
    const wires = extractWireSegments(MINIMAL_SCH);
    expect(wires).toHaveLength(1);
    expect(wires[0]).toEqual({ x1: 5, y1: 5, x2: 15, y2: 5 });
  });

  it('classifies BOM stock vs requirement', () => {
    const p = {
      reference: 'R1',
      value: '10K',
      footprint: '',
      libId: 'Device:R',
      x: 10,
      y: 20,
      rot: 0,
      unit: 1,
      mirrorX: false,
      mirrorY: false,
    };
    const bomOk = new Map([['10K', { required: 1, stock: 5 }]]);
    expect(classifyPlacement(p, bomOk, new Set())).toBe('ok');
    const bomShort = new Map([['10K', { required: 10, stock: 2 }]]);
    expect(classifyPlacement(p, bomShort, new Set())).toBe('short');
    const bomMiss = new Map();
    const inv = new Set(['10K']);
    expect(classifyPlacement(p, bomMiss, inv)).toBe('extra');
    expect(classifyPlacement(p, bomMiss, new Set())).toBe('unknown');
  });

  it('skips power symbols', () => {
    const p = { reference: '#PWR01', value: '+3V3', footprint: '', libId: 'power:foo', x: 0, y: 0, rot: 0, unit: 1, mirrorX: false, mirrorY: false };
    expect(classifyPlacement(p, new Map(), new Set())).toBe('power');
  });

  it('placements, wires and bounds', () => {
    const placements = parseKicadPlacements(MINIMAL_SCH);
    const wires = extractWireSegments(MINIMAL_SCH);
    const bounds = boundsForOverlay(placements, wires, 'tight');
    expect(placements.length).toBe(1);
    expect(wires.length).toBe(1);
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });

  it('parses unit and resolves nested lib symbol segments by unit', () => {
    const placements = parseKicadPlacements(MINIMAL_SCH);
    expect(placements[0]!.unit).toBe(1);
    const map = parseLibSymbolDrawMap(MINIMAL_SCH);
    expect(map.has('Device:R_1_0')).toBe(true);
    const segs = resolveLibSegments(map, 'Device:R', 1);
    expect(segs.length).toBeGreaterThanOrEqual(2);
  });

  it('buildOverlayModel draws lib geometry and colors markers by stock', () => {
    const model = buildOverlayModel(MINIMAL_SCH, new Map([['10K', { required: 1, stock: 5 }]]), new Set())!;
    expect(model.symbols.length).toBeGreaterThanOrEqual(2);
    expect(model.markers[0]).toMatchObject({ reference: 'R1', value: '10K', status: 'ok', glyph: null });
    expect(model.width).toBeGreaterThan(0);
  });

  it('aggregateSchematicInventoryMatches counts by inventory part_code', () => {
    const placements = parseKicadPlacements(MINIMAL_SCH);
    const components = [{ id: 7, part_code: '10K' }];
    const agg = aggregateSchematicInventoryMatches(placements, components);
    expect(agg).toHaveLength(1);
    expect(agg[0]!.component_id).toBe(7);
    expect(agg[0]!.qty).toBe(1);
    expect(agg[0]!.refs).toContain('R1');
  });

  it('ignores non-instance wire blocks without uuid', () => {
    const src = `(kicad_sch
      (wire (pts (xy 0 0) (xy 100 0)) (stroke (width 0) (type default)))
      (wire (pts (xy 1 1) (xy 2 2)) (stroke (width 0) (type default)) (uuid "inst-1"))
    )`;
    const wires = extractWireSegments(src);
    expect(wires).toHaveLength(1);
    expect(wires[0]).toEqual({ x1: 1, y1: 1, x2: 2, y2: 2 });
  });
});
