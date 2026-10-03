/**
 * Category and subcategory icons (section 2 of the rebuild brief): single-stroke outlines on a
 * 24 px grid, 1.6 px stroke, round caps, drawn in `muted` and `accent-ink` when selected. They
 * redraw the old app's schematic shapes (resistor box, capacitor plates, coil, DIP chip, BJT circle,
 * diode, crystal, header...) in the Bugra style and fill every gap. A gallery for review is
 * rendered to docs/design/category-icons.png by `npm run test:visual`.
 */
const C = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const R = (x: number, y: number, w: number, h: number, r = 0) =>
  r
    ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
    : `M${x} ${y}h${w}v${h}h${-w}z`;
const DOT = (x: number, y: number) => `M${x} ${y}h.01`;

// Shared building blocks.
const LEADS = 'M2 12h4M18 12h4';
const RES_BOX = R(6, 9, 12, 6, 1);
const CAP = ['M2 12h8', 'M14 12h8', 'M10 6.5v11', 'M14 6.5v11'];
const COIL = 'M3 13h1.5a2.4 2.4 0 0 1 4.5 0 2.4 2.4 0 0 1 4.5 0 2.4 2.4 0 0 1 4.5 0H21';
const DIODE = ['M2 12h6.5', 'M15.5 12H22', 'M8.5 7l7 5-7 5z', 'M15.5 7v10'];
const DIP = [R(7, 4, 10, 16, 1.5), 'M10.5 4a1.5 1.5 0 0 0 3 0', 'M4 8h3M4 12h3M4 16h3M17 8h3M17 12h3M17 16h3'];
const QFP = [R(6, 6, 12, 12, 1.5), 'M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3', DOT(9, 9)];
const BJT_BODY = [C(13, 12, 7.5), 'M3 12h6.5', 'M9.5 8v8', 'M9.5 10l5.5-3.5V3', 'M9.5 14l5.5 3.5V21'];
const MOS_BODY = ['M3 12h5.5', 'M8.5 7.5v9', 'M11 7v3M11 10.8v2.4M11 14v3', 'M11 8.5h5V3', 'M11 15.5h5V21', 'M11 12h5v3.5'];
const RELAY_COIL = [R(3, 8, 7, 8, 1), 'M3 12h7', 'M6.5 5v3M6.5 16v3'];
const BOARD = R(3, 5, 18, 14, 2);
const BOARD_HOLES = [DOT(5.8, 7.8), DOT(18.2, 7.8), DOT(5.8, 16.2), DOT(18.2, 16.2)];
const CHIP_SMD = [R(5, 8, 14, 8, 1.2), 'M8 8v8', 'M16 8v8'];
const CRYSTAL = ['M2 12h4', 'M18 12h4', 'M6 7v10', 'M18 7v10', R(8.5, 8, 7, 8, 0.8)];
const HEADER = [R(4, 9, 16, 6, 1), DOT(7, 12), DOT(10, 12), DOT(14, 12), DOT(17, 12)];
const coil = (side: 'left' | 'right', turns: number) => {
  const h = 16 / turns;
  const r = +(h / 2).toFixed(3);
  const bump = side === 'left' ? `a${r} ${r} 0 0 1 0 ${h.toFixed(3)}` : `a${r} ${r} 0 0 0 0 ${h.toFixed(3)}`;
  return side === 'left' ? `M3 4h2.5${bump.repeat(turns)}H3` : `M21 4h-2.5${bump.repeat(turns)}H21`;
};
const CORE = ['M11 4v16', 'M13 4v16'];
const TRANSFORMER = [coil('left', 4), coil('right', 4), ...CORE];
// Two emission arrows leaving the diode (up and away from the cathode), heads drawn open.
const LED_RAYS = ['M13.5 6l3.5-3.5', 'M14.4 2.5H17v2.6', 'M16.5 8.5l3.5-3.5', 'M17.4 5H20v2.6'];
/** A diode drawn on the edge from (x1, y1) to (x2, y2), pointing towards the second point. */
function edgeDiode(x1: number, y1: number, x2: number, y2: number): string[] {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  const [px, py] = [-uy, ux];
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const f = (n: number) => +n.toFixed(2);
  const a = 1.7; // half the triangle's length along the edge
  const w = 2; // half its width
  const [bx, by] = [mx - ux * a, my - uy * a];
  const [tx, ty] = [mx + ux * a, my + uy * a];
  return [
    `M${f(bx + px * w)} ${f(by + py * w)}L${f(tx)} ${f(ty)}L${f(bx - px * w)} ${f(by - py * w)}z`,
    `M${f(tx + px * w)} ${f(ty + py * w)}L${f(tx - px * w)} ${f(ty - py * w)}`,
  ];
}
/** A bridge rectifier: four diodes on a diamond, all conducting towards + (top) from - (bottom). */
const BRIDGE = [
  'M12 3L21 12L12 21L3 12z',
  ...edgeDiode(3, 12, 12, 3),
  ...edgeDiode(21, 12, 12, 3),
  ...edgeDiode(12, 21, 3, 12),
  ...edgeDiode(12, 21, 21, 12),
];
const SENSOR_WAVES = ['M7.8 7.8a6 6 0 0 0 0 8.4', 'M16.2 7.8a6 6 0 0 1 0 8.4', 'M5 5a10 10 0 0 0 0 14', 'M19 5a10 10 0 0 1 0 14'];

/** A gear outline: `teeth` teeth between radius `root` and `tip`. */
function gear(cx: number, cy: number, root: number, tip: number, teeth: number): string {
  const f = (n: number) => +n.toFixed(2);
  const pt = (r: number, a: number) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  const step = (2 * Math.PI) / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${pt(root, a - step * 0.32)}L${pt(tip, a - step * 0.2)}L${pt(tip, a + step * 0.2)}L${pt(root, a + step * 0.32)}`;
  }
  return `${d}z`;
}

export const CATEGORY_ICONS: Record<string, string[]> = {
  // ---- Categories ----
  resistor: [LEADS, RES_BOX],
  potentiometer: [LEADS, RES_BOX, 'M12 3v5', 'M10 6l2 2.5 2-2.5'],
  thermistor: [LEADS, RES_BOX, 'M5 19l3-3h11'],
  varistor: [LEADS, RES_BOX, 'M5 18.5h2.5L16.5 5.5'],
  capacitor: CAP,
  inductor: [COIL],
  transformer: TRANSFORMER,
  transistor: BJT_BODY.concat(['M15 17.5l-3.2-.4 1.4-2.3']),
  thyristor: [...DIODE, 'M15.5 12l3 4.5V21'],
  diode: DIODE,
  led: [...DIODE.map((d) => d.replace('M15.5 12H22', 'M15.5 12H18')), ...LED_RAYS],
  ic: DIP,
  microcontroller: QFP,
  sensor: [C(12, 12, 2.5), ...SENSOR_WAVES],
  // Coil (with its diagonal), the dashed mechanical link and the switch blade it moves.
  relay: [R(3, 8, 6, 8, 1), 'M3 16l6-8', 'M6 5v3M6 16v3', 'M9 12.5h1.2M12 12.5h1.2M15 12.5h1.5', 'M16 21v-4l4.5-8.5', 'M19.5 3v4.5'],
  connector: [R(8, 3, 8, 18, 1.5), 'M3 7h5M3 12h5M3 17h5', DOT(12, 7), DOT(12, 12), DOT(12, 17)],
  crystal: CRYSTAL,
  switch: ['M2 15h5', 'M17 15h5', DOT(7, 15), DOT(17, 15), 'M7 15l9-6'],
  module: [BOARD, ...BOARD_HOLES, R(9, 9, 6, 6, 1)],
  mechanical: ['M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z', C(12, 12, 3.2)],
  // A pen-style soldering iron: handle, grip rings, metal shaft and tip.
  // A pen soldering iron held at an angle: handle with a grip ring, shaft, tip and cable.
  consumables: ['M6.6 20.6l5.5-5.5a2.2 2.2 0 0 0-3.1-3.1l-5.5 5.5a2.2 2.2 0 0 0 3.1 3.1z', 'M6.2 15.2l2.6 2.6', 'M11.6 12.4L18 6', 'M17.1 5.1l4.1-2.3-2.3 4.1z', 'M3.4 20.6L2 22'],
  uncategorized: [R(4, 4, 16, 16, 3), 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7', DOT(12, 17)],
  custom: ['M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z', DOT(8, 8)],

  // ---- Resistors ----
  'resistor-axial': [LEADS, R(6, 8.5, 12, 7, 3.5), 'M9.5 8.5v7', 'M12 8.5v7', 'M14.5 8.5v7'],
  'resistor-wirewound': [LEADS, RES_BOX, 'M8 15l1.5-6M11 15l1.5-6M14 15l1.5-6'],
  'chip-smd': CHIP_SMD,
  'resistor-power': ['M2 12h3M19 12h3', R(5, 7, 14, 10, 1.5), 'M8 7v10M16 7v10', 'M10.5 10h3M10.5 14h3'],
  'resistor-precision': [LEADS, RES_BOX, 'M12 3v4', 'M10 5h4', 'M10 19.5h4'],
  'resistor-network': [R(3, 7, 18, 7, 1), 'M6 14v4M10 14v4M14 14v4M18 14v4', DOT(5.5, 10.5)],
  shunt: ['M2 12h3M19 12h3', R(5, 9.5, 14, 5, 1), 'M8 9.5V6M16 9.5V6'],

  // ---- Potentiometers ----
  trimpot: [R(5, 5, 14, 14, 2), C(12, 12, 4), 'M9.5 14.5l5-5', 'M8 19v2.5M12 19v2.5M16 19v2.5'],
  'trimpot-multiturn': [R(3, 7, 18, 9, 1.5), 'M6 11.5h.01', 'M14 9.5a2 2 0 1 1 0 4', 'M7 16v4M12 16v4M17 16v4'],
  knob: [C(12, 10, 6.5), 'M12 10l3.5-3.5', 'M8 19h8'],
  'knob-log': [C(12, 10, 6.5), 'M12 10l3.5-3.5', 'M7 20c3 0 6-1 10-4'],
  slider: [R(3, 9, 18, 6, 3), R(10, 6, 4, 12, 1)],

  // ---- Thermistors and varistors ----
  'thermistor-ntc': [LEADS, RES_BOX, 'M5 19l3-3h11', 'M19.5 3v4', 'M18 5.5l1.5 1.5L21 5.5'],
  'thermistor-ptc': [LEADS, RES_BOX, 'M5 19l3-3h11', 'M19.5 7V3', 'M18 4.5L19.5 3 21 4.5'],
  'varistor-disc': [C(12, 9, 6), 'M9 15v6M15 15v6', 'M9 9h6'],

  // ---- Capacitors ----
  'capacitor-polarized': ['M2 12h8', 'M15 12h7', 'M10 6.5v11', 'M15.5 6.5a8 8 0 0 0 0 11', 'M5 7h3M6.5 5.5v3'],
  'capacitor-disc': [C(12, 9, 6), 'M10 15v6M14 15v6'],
  'capacitor-tantalum': ['M12 3c-3 4-5 7-5 9.5a5 5 0 0 0 10 0C17 10 15 7 12 3z', 'M10 18v3M14 18v3', 'M10 11h4M12 9v4'],
  'capacitor-film': [R(5, 6, 14, 11, 1.5), 'M9 17v4M15 17v4', 'M8.5 11.5h7'],
  'capacitor-can': [R(7, 3, 10, 15, 2), 'M7 6.5h10', 'M10 18v3M14 18v3'],
  'capacitor-super': ['M2 12h7', 'M15 12h7', 'M9 6v12M10.5 6v12', 'M13.5 6v12M15 6v12'],
  'chip-mlcc': [...CHIP_SMD, 'M11 10.5v3M13 10.5v3'],
  'capacitor-variable': [...CAP, 'M6 18L18 6', 'M15 6h3v3'],

  // ---- Inductors ----
  'inductor-core': [COIL, 'M3 8h18', 'M3 6h18'],
  toroid: [C(12, 12, 8), C(12, 12, 4), 'M6 6.5l2.8 2.8M18 6.5l-2.8 2.8M6 17.5l2.8-2.8M18 17.5l-2.8-2.8'],
  choke: ['M3 9h1.5a2.4 2.4 0 0 1 4.5 0 2.4 2.4 0 0 1 4.5 0 2.4 2.4 0 0 1 4.5 0H21', 'M3 17h1.5a2.4 2.4 0 0 1 4.5 0 2.4 2.4 0 0 1 4.5 0 2.4 2.4 0 0 1 4.5 0H21', 'M3 12.5h18', DOT(4, 6), DOT(4, 20)],
  'inductor-power': [R(5, 5, 14, 14, 3), C(12, 12, 4), 'M12 8a4 4 0 0 1 0 8'],
  'inductor-smd': [R(4, 6, 16, 12, 2), 'M8 6v12M16 6v12', 'M10 12h4'],
  'ferrite-bead': ['M2 12h5', 'M17 12h5', R(7, 8, 10, 8, 4), 'M10 8v8M14 8v8'],

  // ---- Transformers ----
  'transformer-up': [coil('left', 3), coil('right', 5), ...CORE],
  'transformer-down': [coil('left', 5), coil('right', 3), ...CORE],
  'transformer-isolation': [...TRANSFORMER, 'M12 1.5v1.5M12 21v1.5'],
  'transformer-audio': [coil('left', 4), ...CORE, 'M15.5 9.5h2l3.5-3v11l-3.5-3h-2z'],
  'toroid-transformer': [C(12, 12, 8), C(12, 12, 4), 'M4 12h4M16 12h4', 'M12 4v4M12 16v4'],
  'transformer-pulse': [...TRANSFORMER, DOT(7, 3.5), DOT(17, 3.5)],

  // ---- Transistors ----
  'bjt-npn': BJT_BODY.concat(['M15 17.5l-3.2-.4 1.4-2.3']),
  'bjt-pnp': BJT_BODY.concat(['M10 14.6l3.2.4-1.4 2.3']),
  'mosfet-n': [...MOS_BODY, 'M11 12l2.5-1.5v3z'],
  'mosfet-p': [...MOS_BODY, 'M16 12l-2.5-1.5v3z'],
  igbt: ['M3 12h5.5', 'M8.5 7.5v9', 'M11 7v10', 'M11 9.5l5-3V3', 'M11 14.5l5 3V21', 'M16 17.5l-3-.3 1.2-2.3'],
  jfet: ['M3 15h7', 'M10 7v10', 'M10 9h6V3', 'M10 15.5h6V21', 'M7 13.5l2.5 1.5L7 16.5'],
  darlington: [C(13, 12, 8), 'M3 12h4', 'M7 9v6', 'M7 10.5l4-2.5V4', 'M7 13.5l3.5 2', 'M12 14v-4.5', 'M12 11l4-2.5V4', 'M12 13l4 2.5V20'],

  // ---- Thyristors ----
  scr: [...DIODE, 'M15.5 12l3 4.5V21'],
  triac: ['M2 12h4', 'M18 12h4', 'M6 4v16', 'M18 4v16', 'M6 6l12 5-12 0z', 'M18 13l-12 5 12 0z', 'M6 18l-3 3'],
  diac: ['M2 12h4', 'M18 12h4', 'M6 4v16', 'M18 4v16', 'M6 6l12 5-12 0z', 'M18 13l-12 5 12 0z'],

  // ---- Diodes ----
  'diode-schottky': [...DIODE.slice(0, 3), 'M15.5 7v10', 'M15.5 7h2v1.5', 'M15.5 17h-2v-1.5'],
  'diode-zener': [...DIODE.slice(0, 3), 'M15.5 7v10', 'M15.5 7l2-1.5', 'M15.5 17l-2 1.5'],
  'diode-tvs': ['M2 12h3', 'M19 12h3', 'M5 8l6 4-6 4z', 'M19 8l-6 4 6 4z', 'M12 7v10', 'M12 7l1.5-1M12 17l-1.5 1'],
  'diode-fast': [...DIODE, 'M3 5h4M5.5 3.5L7 5 5.5 6.5'],
  bridge: BRIDGE,
  'diode-varactor': [...DIODE.slice(0, 3), 'M15.5 7v10', 'M18 7v10', 'M18 12h4'],

  // ---- LEDs ----
  'led-power': [...DIODE.map((d) => d.replace('M15.5 12H22', 'M15.5 12H18')), ...LED_RAYS, 'M4 20h16'],
  'led-rgb': [C(8, 9, 4), C(16, 9, 4), C(12, 15.5, 4)],
  'led-addressable': [R(4, 4, 16, 16, 2.5), C(12, 12, 3.5), 'M2 8h2M2 16h2M20 8h2M20 16h2'],
  'led-ir': [...DIODE.map((d) => d.replace('M15.5 12H22', 'M15.5 12H18')), 'M17.5 5c1-1 2-1 3 0', 'M19 3c2-2 3-1 3 0'],
  'led-uv': [...DIODE.map((d) => d.replace('M15.5 12H22', 'M15.5 12H18')), 'M18 5l1-2M20.5 6.5l2-1M19.5 9h2.5'],
  laser: [...DIODE.map((d) => d.replace('M15.5 12H22', 'M15.5 12H18')), 'M17 5l5-3'],
  'led-segment': [R(5, 3, 14, 18, 2), 'M9 7h6', 'M9 12h6', 'M9 17h6', 'M9 7v10', 'M15 7v10'],
  photo: [...DIODE, 'M3 5.5l2.5 2.5M5.5 8h-2M5.5 8V6', 'M6 3l2.5 2.5M8.5 5.5h-2M8.5 5.5v-2'],

  // ---- ICs ----
  opamp: ['M6 4v16l14-8z', 'M2 8h4M2 16h4', 'M20 12h2', 'M7.5 8h2.5M8.75 6.75v2.5', 'M7.5 16h2.5'],
  comparator: ['M6 4v16l14-8z', 'M2 8h4M2 16h4', 'M20 12h2', 'M8 14h2v-4h2'],
  timer: [...DIP, C(12, 12, 2.6), 'M12 10.5V12l1 .8'],
  regulator: [R(5, 7, 14, 10, 1.5), 'M2 10h3', 'M19 10h3', 'M12 17v4', 'M8 12h2M14 12h2'],
  'regulator-switching': [R(5, 7, 14, 10, 1.5), 'M2 10h3', 'M19 10h3', 'M12 17v4', 'M8 13.5h2v-3h2v3h2v-3h2'],
  reference: ['M2 12h6.5', 'M15.5 12H22', 'M8.5 7l7 5-7 5z', 'M15.5 7v10', 'M12 14.5V21'],
  'gate-driver': [R(4, 5, 12, 14, 1.5), 'M16 9h2.5a2 2 0 0 1 2 2v2', 'M16 15h5', 'M7 9h3M7 12h5M7 15h3'],
  motor: [C(12, 12, 7), 'M8.5 15.5v-7l3.5 4 3.5-4v7'],
  pwm: [R(3, 4, 18, 16, 2), 'M5 15h3v-6h3v6h3v-6h3v6h2'],
  optocoupler: [R(3, 4, 18, 16, 2), 'M6 8.5l3 3.5-3 3.5z', 'M9 8.5v7', 'M12 10.5l2 1.5M12 13.5l2 1.5', 'M16 8v8', 'M16 10l3-2', 'M16 14l3 2'],
  'logic-gate': ['M5 5h6a7 7 0 0 1 0 14H5z', 'M2 9h3M2 15h3', 'M18 12h4'],
  'shift-register': [R(2.5, 8, 5, 8, 1), R(9.5, 8, 5, 8, 1), R(16.5, 8, 5, 8, 1), 'M7.5 12h2M14.5 12h2', 'M4 5h16', 'M17.5 3.5L19 5l-1.5 1.5'],
  mux: ['M6 3l12 4v10L6 21z', 'M2 7h4M2 12h4M2 17h4', 'M18 12h4', 'M12 19v3'],
  'led-driver': [R(3, 6, 10, 12, 1.5), 'M13 12h2', 'M15 8.5l5 3.5-5 3.5z', 'M20 8.5v7', 'M18 4.5l2-2'],
  serial: [R(3, 7, 18, 10, 5), DOT(7.5, 10.5), DOT(11, 10.5), DOT(14.5, 10.5), DOT(9.25, 13.5), DOT(12.75, 13.5), DOT(16.5, 10.5)],
  bus: ['M2 9h20', 'M2 15h20', 'M6 9v6', 'M12 9v6', 'M18 9v6'],
  wireless: [...DIP, 'M9.5 10a3.5 3.5 0 0 1 5 0', 'M11 12a1.4 1.4 0 0 1 2 0', DOT(12, 14)],
  antenna: ['M12 10v11', 'M8 21h8', C(12, 8, 1.6), 'M8.5 4.5a5 5 0 0 0 0 7', 'M15.5 4.5a5 5 0 0 1 0 7', 'M6 2a8.5 8.5 0 0 0 0 12', 'M18 2a8.5 8.5 0 0 1 0 12'],
  speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a7.5 7.5 0 0 1 0 11'],
  adc: ['M2 12c1.5-5 3-5 4.5 0s3 5 4.5 0', 'M13 16h2.5v-3H18v-3h2.5v-3H22', 'M2 20h20'],
  dac: ['M2 16h2.5v-3H7v-3h2.5V7H11', 'M13 12c1.5-5 3-5 4.5 0s3 5 4.5 0', 'M2 20h20'],
  memory: [R(4, 6, 16, 12, 1.5), 'M7 6V3M10 6V3M14 6V3M17 6V3M7 18v3M10 18v3M14 18v3M17 18v3', 'M8 10h8M8 14h5'],
  clock: [C(12, 12, 8.5), 'M12 7v5l3.5 2'],
  'battery-charger': [R(3, 7, 16, 10, 1.5), 'M19 10.5h2v3h-2', 'M11.5 8.5L9 12.5h3.5L10 15.5'],
  'current-sense': [C(12, 12, 8), 'M8 15l1.6-6h.8L12 15', 'M8.6 13h3', 'M14 11h3M15.5 9.5v3'],

  // ---- Sensors ----
  thermometer: ['M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z', 'M12 9v7', 'M16 6h2M16 9h2M16 12h2'],
  humidity: ['M12 3.5c3.5 4.5 6 7.5 6 10.5a6 6 0 0 1-12 0c0-3 2.5-6 6-10.5z', 'M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5'],
  gauge: ['M4 16a8 8 0 1 1 16 0', 'M12 16l4-5', 'M6.5 16h11'],
  magnet: ['M6 4v8a6 6 0 0 0 12 0V4', 'M6 4h4v8a2 2 0 0 0 4 0V4h4', 'M6 8h4M14 8h4'],
  axes: ['M5 19V5', 'M5 19h14', 'M5 19l9-7', 'M3.5 6.5L5 5l1.5 1.5', 'M17.5 17.5L19 19l-1.5 1.5'],
  rotation: [C(12, 12, 3), 'M19 12a7 7 0 1 1-2-4.9', 'M19 4v4h-4'],
  imu: [R(4, 4, 16, 16, 2), 'M8 16V8', 'M8 16h8', 'M8 16l5.5-4', C(15, 9, 1.5)],
  proximity: [R(3, 8, 5, 8, 1), 'M10.5 9a4 4 0 0 1 0 6', 'M13.5 7a7 7 0 0 1 0 10', 'M18 4v16'],
  distance: ['M4 6v12', 'M20 6v12', 'M4 12h16', 'M7 9.5L4.5 12 7 14.5', 'M17 9.5l2.5 2.5-2.5 2.5'],
  ultrasonic: [C(7.5, 12, 4), C(16.5, 12, 4), C(7.5, 12, 1.5), C(16.5, 12, 1.5), 'M3 18h18'],
  motion: [C(12, 5, 2), 'M12 7v6l-3 6', 'M12 13l3 6', 'M8 10h8', 'M19 7a4 4 0 0 1 0 6M5 7a4 4 0 0 0 0 6'],
  light: [C(12, 12, 4), 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4'],
  gas: ['M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.4A3.3 3.3 0 0 1 17 18z', 'M9 21h.01M13 21h.01M17 21h.01'],
  force: ['M12 3v9', 'M9 9l3 3 3-3', 'M4 15h16', 'M4 18h16', 'M7 15v3M17 15v3'],

  // ---- Relays ----
  'relay-dpdt': [...RELAY_COIL, 'M14 5.5l4.5 2', 'M14 13.5l4.5 2', 'M20 4v3M20 12v3', 'M14 6.5v.01M14 14.5v.01'],
  'relay-ssr': [R(3, 5, 18, 14, 2), 'M6 9l3 3-3 3z', 'M9 9v6', 'M12 12h2', 'M15 9v6l3-3z'],
  reed: [R(3, 8, 18, 8, 4), 'M2 12h5l5 1.5', 'M22 12h-6'],

  // ---- Connectors ----
  header: HEADER.concat(['M7 9V5M10 9V5M14 9V5M17 9V5']),
  'header-female': [R(4, 8, 16, 8, 1), R(6, 10.5, 2, 3, 0.5), R(9, 10.5, 2, 3, 0.5), R(13, 10.5, 2, 3, 0.5), R(16, 10.5, 2, 3, 0.5)],
  terminal: [R(3, 7, 18, 12, 1.5), C(8, 12, 2), C(16, 12, 2), 'M7 12h2M15 12h2', 'M3 16h18'],
  'ic-socket': [R(6, 3, 12, 18, 1.5), 'M10.5 3a1.5 1.5 0 0 0 3 0', R(8.5, 7, 7, 10, 0.8)],
  housing: [R(4, 6, 16, 12, 2), R(7, 9, 3, 4, 0.6), R(14, 9, 3, 4, 0.6), 'M8 18v2M16 18v2'],
  usb: ['M12 2.5v15', C(12, 19.5, 2), 'M12 7l-4 3v3', 'M12 10l4-3V5', R(14.8, 3, 2.4, 2.4, 0.3), C(8, 14, 1.2)],
  rj45: [R(4, 5, 16, 14, 1.5), 'M8 19v-5h8v5', 'M9 8v3M11 8v3M13 8v3M15 8v3'],
  dsub: ['M3 7h18l-2.5 10h-13z', DOT(7, 10), DOT(10, 10), DOT(14, 10), DOT(17, 10), DOT(8.5, 14), DOT(12, 14), DOT(15.5, 14)],
  'dc-jack': [R(4, 6, 12, 12, 1.5), C(10, 12, 3), DOT(10, 12), 'M16 9h4M16 15h4'],
  bullet: [R(3, 7, 7, 10, 2), R(14, 7, 7, 10, 2), 'M6.5 10v4M17.5 10v4', 'M10 12h4'],
  coax: [C(12, 12, 8), C(12, 12, 4), DOT(12, 12)],
  idc: [R(3, 7, 18, 10, 1.5), 'M6 10h12M6 14h12', 'M9 17v4M12 17v4M15 17v4'],

  // ---- Crystals ----
  oscillator: [R(3, 5, 18, 14, 2), 'M6 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 3-4'],
  tcxo: [...CRYSTAL, 'M12 2v3'],
  resonator: [...CRYSTAL, 'M12 16v6'],

  // ---- Switches ----
  tactile: [R(4, 6, 16, 12, 2), C(12, 12, 3.5), 'M2 9h2M2 15h2M20 9h2M20 15h2'],
  'slide-switch': [R(3, 8, 18, 8, 1.5), R(6, 10, 5, 4, 0.8), 'M7 16v3M12 16v3M17 16v3'],
  toggle: [R(4, 13, 16, 7, 1.5), 'M12 13L16 4', C(16.5, 3.8, 1.4)],
  'rotary-switch': [C(12, 12, 7), C(12, 12, 2.5), 'M12 9.5V5', 'M12 2.5v1M21.5 12h-1M2.5 12h1M18.7 5.3l-.7.7M5.3 5.3l.7.7'],
  dip: [R(3, 6, 18, 12, 1.5), R(5.5, 8.5, 2.5, 7, 0.5), R(10.75, 8.5, 2.5, 7, 0.5), R(16, 8.5, 2.5, 7, 0.5), 'M5.5 9.5h2.5M10.75 14.5h2.5M16 9.5h2.5'],
  rocker: [R(4, 6, 16, 12, 2), 'M7 15l10-4.5', 'M12 6v1.5'],
  limit: [R(3, 11, 14, 9, 1.5), 'M13 11L19 5', C(20, 4, 1.4), 'M6 20v2M14 20v2'],

  // ---- Modules ----
  'module-power': [BOARD, ...BOARD_HOLES, 'M13 8l-3 4.5h4l-3 4'],
  'module-sensor': [BOARD, ...BOARD_HOLES, C(12, 12, 2), 'M9 9a4.2 4.2 0 0 0 0 6M15 9a4.2 4.2 0 0 1 0 6'],
  display: [R(3, 5, 18, 12, 2), R(6, 8, 12, 6, 0.5), 'M8 21h8', 'M12 17v4'],
  'module-rf': [BOARD, ...BOARD_HOLES, 'M12 15V9', 'M9.5 10a3.5 3.5 0 0 1 5 0'],
  devboard: [BOARD, ...BOARD_HOLES, R(9, 9, 6, 6, 0.8), 'M3 10h-1v4h1'],
  programmer: [R(6, 3, 12, 13, 2), 'M10 16v5h4v-5', 'M9 7h6', 'M9 10h4'],
  meter: [R(3, 5, 18, 14, 2), 'M6 15a6 6 0 0 1 12 0', 'M12 15l3-4'],

  // ---- Mechanical ----
  heatsink: ['M3 20h18', 'M5 20V8M9 20V5M13 20V5M17 20V8M21 20V10', 'M3 20V10'],
  standoff: ['M8 3h8l2 3v12l-2 3H8l-2-3V6z', 'M6 8h12M6 16h12'],
  screw: [C(12, 5.5, 3), 'M10.5 5.5h3', 'M10 8.5v11l2 2 2-2v-11', 'M10 11l4 1.5M10 14l4 1.5M10 17l4 1.5'],
  fan: [R(3, 3, 18, 18, 2.5), C(12, 12, 2), 'M12 10c-1-3 0-5 3-5', 'M14 12c3-1 5 0 5 3', 'M12 14c1 3 0 5-3 5', 'M10 12c-3 1-5 0-5-3'],
  cable: ['M3 19c4 0 4-5 8-5s4-5 8-5', 'M19 9V5', 'M17 5h4', 'M3 19v2'],
  pcb: [R(3, 5, 18, 14, 2), ...BOARD_HOLES, 'text:12,12.3,6.4:PCB'],
  enclosure: ['M3 8l9-4 9 4v9l-9 4-9-4z', 'M3 8l9 4 9-4', 'M12 12v9'],
  'battery-holder': [R(3, 7, 16, 10, 1.5), 'M19 10.5h2v3h-2', 'M7 12h3M8.5 10.5v3', 'M13 12h3'],

  // ---- Consumables ----
  // A spool of solder wire seen from the side, with the free end hanging down.
  solder: ['M7 4.5a2.5 7.5 0 1 0 0 15a2.5 7.5 0 1 0 0-15z', 'M15 4.5a2.5 7.5 0 0 1 0 15', 'M7 4.5h8M7 19.5h8', 'M7 10.2a.8 1.8 0 1 0 0 3.6a.8 1.8 0 1 0 0-3.6z', 'M17.3 9.5c2.2 0 3.2 1.2 3.2 3.2V21'],
  flux: ['M9 3h6v3H9z', 'M8 6h8l1 3v10.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5V9z', 'M7 13h10'],
  'heat-shrink': [R(3, 8, 18, 8, 4), 'M7 8v8M17 8v8', 'M10 12h4'],
  tape: [C(12, 12, 8), C(12, 12, 3.5), 'M20 12h2v8h-8'],
  spray: ['M8 9h8v11.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5z', 'M10 9V6h4v3', 'M14 6h3', 'M19 4h.01M20 7h.01M19 10h.01'],
  tool: ['M14.5 4.5a4 4 0 0 0-5 5L3.5 15.5l5 5 6-6a4 4 0 0 0 5-5l-2.5 2.5-3-3z'],
  // A small jar (paste, flux) with its lid and label.
  jar: [R(6.5, 3.5, 11, 3.5, 1), 'M7.5 7h9v11.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z', 'M10 12.5h4'],
  pliers: ['M10.2 2.5c-.4 2.5.2 5 1.8 6.6', 'M13.8 2.5c.4 2.5-.2 5-1.8 6.6', C(12, 10.6, 1.6), 'M10.9 11.8C9.5 14.5 8 17.5 7 21.5', 'M13.1 11.8c1.4 2.7 2.9 5.7 3.9 9.7'],
  screwdriver: [R(9, 13, 6, 8.5, 2), 'M11 15.5v3.5M13 15.5v3.5', 'M12 13V5.5', 'M10.8 5.5h2.4l-.4-3h-1.6z'],
  // A ferrite toroid: the ring core alone, no winding.
  'toroid-core': [C(12, 12, 8.5), C(12, 12, 4)],
  // A bare board with its mounting holes and the word PCB.
  'pcb-board': [R(3, 5, 18, 14, 2), ...BOARD_HOLES, 'text:12,12.3,6.4:PCB'],
  gear: [gear(12, 12, 6.8, 9.2, 8), C(12, 12, 3)],
  // A custom chip (the old app's legacy and VCR parts): a package with the word ASIC.
  asic: [R(5, 5, 14, 14, 1.5), 'M9 2.5V5M12 2.5V5M15 2.5V5M9 19v2.5M12 19v2.5M15 19v2.5M2.5 9H5M2.5 12H5M2.5 15H5M19 9h2.5M19 12h2.5M19 15h2.5', 'text:12,12.2,4.6:ASIC'],
  // Protection devices: a shield with a surge bolt.
  shield: ['M12 2.8l7.5 3v5.7c0 4.6-3.1 8.2-7.5 9.7-4.4-1.5-7.5-5.1-7.5-9.7V5.8z', 'M12.8 7.5l-3 5h3.2l-1.8 4'],
  fuse: ['M2 12h20', R(6, 9, 12, 6, 1)],
  // A resettable PPTC fuse: the fuse with the diagonal of a temperature-dependent part.
  'fuse-ptc': ['M2 12h20', R(6, 9, 12, 6, 1), 'M5 18.5h2.5L16.5 5.5'],
};
