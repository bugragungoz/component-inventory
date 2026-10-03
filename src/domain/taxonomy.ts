/**
 * The fixed category taxonomy. Stored values are English; labels come from the locale files
 * (`category.<Name>`, `subcategory.<Name>`). Every category and subcategory has an icon id
 * (src/components/categoryIcons.ts). Keep the category names in step with
 * crates/inventory-core/src/taxonomy.rs (a test compares them).
 */

export const UNCATEGORIZED = 'Uncategorized';

export interface CategoryDef {
  name: string;
  icon: string;
  subcategories: Array<{ name: string; icon: string }>;
}

const sub = (icon: string, ...names: string[]) => names.map((name) => ({ name, icon }));

export const TAXONOMY: CategoryDef[] = [
  {
    name: 'Resistors',
    icon: 'resistor',
    subcategories: [
      ...sub('resistor-axial', 'Carbon Film', 'Metal Film', 'Through-Hole'),
      ...sub('resistor-wirewound', 'Wirewound'),
      ...sub('chip-smd', 'SMD', 'Thick Film', 'Thin Film'),
      ...sub('resistor-power', 'Power'),
      ...sub('resistor-precision', 'Precision'),
      ...sub('resistor-network', 'Network / Array'),
      ...sub('shunt', 'Shunt'),
    ],
  },
  {
    name: 'Potentiometers',
    icon: 'potentiometer',
    subcategories: [
      ...sub('trimpot', 'Trimpot', 'Single-turn'),
      ...sub('trimpot-multiturn', 'Multi-turn'),
      ...sub('knob', 'Linear', 'Rotary'),
      ...sub('knob-log', 'Logarithmic'),
      ...sub('slider', 'Slide'),
    ],
  },
  { name: 'Thermistors', icon: 'thermistor', subcategories: [...sub('thermistor-ntc', 'NTC'), ...sub('thermistor-ptc', 'PTC')] },
  { name: 'Varistors', icon: 'varistor', subcategories: sub('varistor-disc', 'MOV', 'SIOV') },
  {
    name: 'Capacitors',
    icon: 'capacitor',
    subcategories: [
      ...sub('capacitor-polarized', 'Electrolytic'),
      ...sub('capacitor-disc', 'Ceramic'),
      ...sub('capacitor-tantalum', 'Tantalum'),
      ...sub('capacitor-film', 'Film'),
      ...sub('capacitor-can', 'Polymer'),
      ...sub('capacitor-super', 'Supercapacitor'),
      ...sub('chip-mlcc', 'MLCC', 'SMD'),
      ...sub('capacitor-variable', 'Variable / Trimmer'),
    ],
  },
  {
    name: 'Inductors',
    icon: 'inductor',
    subcategories: [
      ...sub('inductor', 'Inductor'),
      ...sub('inductor-core', 'Ferrite Core'),
      ...sub('toroid', 'Toroid Core'),
      ...sub('choke', 'Common Mode Choke'),
      ...sub('inductor-power', 'Power'),
      ...sub('inductor-smd', 'SMD'),
      ...sub('ferrite-bead', 'Ferrite Bead'),
    ],
  },
  {
    name: 'Transformers',
    icon: 'transformer',
    subcategories: [
      ...sub('transformer-up', 'Step-Up'),
      ...sub('transformer-down', 'Step-Down'),
      ...sub('transformer-isolation', 'Isolation'),
      ...sub('transformer-audio', 'Audio'),
      ...sub('toroid-transformer', 'Toroidal'),
      ...sub('transformer-pulse', 'Pulse / Current'),
    ],
  },
  {
    name: 'Transistors',
    icon: 'transistor',
    subcategories: [
      ...sub('bjt-npn', 'BJT NPN - General Purpose', 'BJT NPN - HV', 'BJT NPN - HC', 'BJT NPN - HF', 'BJT NPN'),
      ...sub('bjt-pnp', 'BJT PNP - General Purpose', 'BJT PNP - HV', 'BJT PNP - HC', 'BJT PNP - HF', 'BJT PNP'),
      ...sub('mosfet-n', 'MOSFET N-Channel', 'MOSFET N-Channel - HV', 'MOSFET N-Channel - HC', 'MOSFET N-Channel - Logic-Level', 'Power MOSFET'),
      ...sub('mosfet-p', 'MOSFET P-Channel', 'MOSFET P-Channel - HV', 'MOSFET P-Channel - HC'),
      ...sub('igbt', 'IGBT'),
      ...sub('jfet', 'JFET'),
      ...sub('darlington', 'Darlington NPN', 'Darlington PNP', 'Darlington Array'),
    ],
  },
  { name: 'Thyristors', icon: 'thyristor', subcategories: [...sub('scr', 'SCR'), ...sub('triac', 'TRIAC'), ...sub('diac', 'DIAC')] },
  {
    name: 'Diodes',
    icon: 'diode',
    subcategories: [
      ...sub('diode', 'Rectifier', 'Signal', 'Switching'),
      ...sub('diode-schottky', 'Schottky'),
      ...sub('diode-zener', 'Zener'),
      ...sub('diode-tvs', 'TVS'),
      ...sub('diode-fast', 'Fast Recovery'),
      ...sub('bridge', 'Bridge Rectifier'),
      ...sub('diode-varactor', 'Varactor'),
    ],
  },
  {
    name: 'LEDs',
    icon: 'led',
    subcategories: [
      ...sub('led', 'Indicator'),
      ...sub('led-power', 'High-Power'),
      ...sub('led-rgb', 'RGB'),
      ...sub('led-addressable', 'Addressable'),
      ...sub('led-ir', 'IR'),
      ...sub('led-uv', 'UV'),
      ...sub('laser', 'Laser'),
      ...sub('led-segment', '7-Segment'),
      ...sub('photo', 'Photodiode / Phototransistor'),
    ],
  },
  {
    name: 'ICs',
    icon: 'ic',
    subcategories: [
      ...sub('opamp', 'Op-Amp', 'Op-Amps', 'Instrumentation Amplifier'),
      ...sub('comparator', 'Comparator'),
      ...sub('timer', 'Timer'),
      ...sub('regulator', 'Voltage Regulator', 'Linear Regulator', 'LDO Regulator'),
      ...sub('regulator-switching', 'Switching Regulator', 'Buck Converter', 'Boost Converter', 'DC-DC Converter'),
      ...sub('reference', 'Voltage Reference'),
      ...sub('gate-driver', 'Gate Driver'),
      ...sub('motor', 'Motor Driver', 'Stepper Driver'),
      ...sub('pwm', 'PWM Controller'),
      ...sub('optocoupler', 'Optocoupler'),
      ...sub('logic-gate', 'Logic Gate', 'Logic'),
      ...sub('shift-register', 'Shift Register'),
      ...sub('mux', 'Multiplexer'),
      ...sub('led-driver', 'LED Driver'),
      ...sub('serial', 'RS-232 Driver', 'USB-UART'),
      ...sub('bus', 'RS-485 Transceiver', 'CAN Transceiver', 'I/O Expander', 'Interface'),
      ...sub('wireless', 'WiFi / BT SoC'),
      ...sub('antenna', 'RF Transceiver'),
      ...sub('speaker', 'Audio Amplifier'),
      ...sub('adc', 'ADC'),
      ...sub('dac', 'DAC'),
      ...sub('memory', 'EEPROM / Flash', 'EEPROM', 'Flash Memory'),
      ...sub('clock', 'Real-Time Clock', 'RTC'),
      ...sub('battery-charger', 'Battery Charger'),
      ...sub('current-sense', 'Current Sensor'),
      ...sub('microcontroller', 'Microcontroller'),
    ],
  },
  {
    name: 'Microcontrollers',
    icon: 'microcontroller',
    subcategories: [
      ...sub('microcontroller', 'STM32 (ARM Cortex-M)', 'AVR (Atmel)', 'PIC', 'MSP430', 'RP2040 (Pi Pico)', '8051'),
      ...sub('wireless', 'ESP32 / ESP8266'),
    ],
  },
  {
    name: 'Sensors',
    icon: 'sensor',
    subcategories: [
      ...sub('thermometer', 'Temperature'),
      ...sub('humidity', 'Humidity'),
      ...sub('gauge', 'Pressure'),
      ...sub('magnet', 'Hall Effect'),
      ...sub('current-sense', 'Current'),
      ...sub('axes', 'Accelerometer'),
      ...sub('rotation', 'Gyroscope'),
      ...sub('imu', 'IMU'),
      ...sub('proximity', 'Proximity'),
      ...sub('distance', 'Distance / ToF'),
      ...sub('ultrasonic', 'Ultrasonic'),
      ...sub('motion', 'PIR (Motion)'),
      ...sub('light', 'Light / Color'),
      ...sub('gas', 'Gas'),
      ...sub('force', 'Force / Strain'),
    ],
  },
  {
    name: 'Relays',
    icon: 'relay',
    subcategories: [
      ...sub('relay', 'SPST', 'SPDT'),
      ...sub('relay-dpdt', 'DPDT'),
      ...sub('relay-ssr', 'Solid State'),
      ...sub('reed', 'Reed'),
    ],
  },
  {
    name: 'Connectors',
    icon: 'connector',
    subcategories: [
      ...sub('header', 'Pin Header'),
      ...sub('header-female', 'Socket'),
      ...sub('terminal', 'Terminal Block'),
      ...sub('ic-socket', 'IC Socket'),
      ...sub('housing', 'JST', 'Molex'),
      ...sub('usb', 'USB'),
      ...sub('rj45', 'RJ45'),
      ...sub('dsub', 'D-Sub'),
      ...sub('dc-jack', 'DC Jack'),
      ...sub('bullet', 'XT60 / XT30'),
      ...sub('coax', 'RF / Coaxial'),
      ...sub('idc', 'IDC / Ribbon'),
    ],
  },
  {
    name: 'Crystals',
    icon: 'crystal',
    subcategories: [
      ...sub('crystal', 'Crystal', 'HC-49/S'),
      ...sub('oscillator', 'Oscillator (XO)'),
      ...sub('tcxo', 'TCXO'),
      ...sub('resonator', 'Resonator'),
    ],
  },
  {
    name: 'Switches',
    icon: 'switch',
    subcategories: [
      ...sub('tactile', 'Tactile'),
      ...sub('slide-switch', 'Slide'),
      ...sub('toggle', 'Toggle'),
      ...sub('rotary-switch', 'Rotary', 'Encoder'),
      ...sub('dip', 'DIP'),
      ...sub('rocker', 'Rocker'),
      ...sub('limit', 'Limit'),
    ],
  },
  {
    name: 'Modules',
    icon: 'module',
    subcategories: [
      ...sub('module-power', 'Power Supply'),
      ...sub('module-sensor', 'Sensor Board'),
      ...sub('display', 'Display'),
      ...sub('module-rf', 'RF / Wireless'),
      ...sub('motor', 'Motor Driver'),
      ...sub('devboard', 'Development Board'),
      ...sub('programmer', 'Programmer / Debugger'),
      ...sub('meter', 'Panel Meter'),
    ],
  },
  {
    name: 'Mechanical',
    icon: 'mechanical',
    subcategories: [
      ...sub('heatsink', 'Heat Sink'),
      ...sub('standoff', 'Standoff'),
      ...sub('screw', 'Screw / Nut'),
      ...sub('fan', 'Fan'),
      ...sub('cable', 'Cable / Wire'),
      ...sub('pcb', 'PCB / Board'),
      ...sub('enclosure', 'Enclosure'),
      ...sub('battery-holder', 'Battery Holder'),
    ],
  },
  {
    name: 'Consumables',
    icon: 'consumables',
    subcategories: [
      ...sub('solder', 'Solder'),
      ...sub('flux', 'Flux'),
      ...sub('heat-shrink', 'Heat Shrink'),
      ...sub('tape', 'Insulating Tape'),
      ...sub('spray', 'Cleaner'),
      ...sub('pliers', 'Hand Tools'),
    ],
  },
  { name: UNCATEGORIZED, icon: 'uncategorized', subcategories: [] },
];

export const CANONICAL_CATEGORIES: string[] = TAXONOMY.map((c) => c.name);

const byName = new Map(TAXONOMY.map((c) => [c.name, c]));

const iconKey = (s: string) => s.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();

/**
 * Icons for category names the old app used and owners still have (kept as they are, not
 * renamed): without these they fell back to the neutral tag.
 */
const LEGACY_CATEGORY_ICONS: Record<string, string> = {
  'connectors & sockets': 'header',
  'crystals & oscillators': 'crystal',
  electromechanical: 'gear',
  'leds & optoelectronics': 'led',
  'legacy parts (sony/vcr)': 'asic',
  'legacy parts': 'asic',
  'protection devices': 'shield',
  'consumables & tools': 'consumables',
};

/** Subcategory names from the old app (and close spellings) that are not in the taxonomy. */
const SUBCATEGORY_ICON_ALIASES: Record<string, string> = {
  'pin header': 'header',
  'ic socket': 'ic-socket',
  'ferrite core': 'toroid-core',
  'hand tool': 'pliers',
  'hand tools': 'pliers',
  'knob / hardware': 'screwdriver',
  'pcb / board': 'pcb-board',
  solder: 'solder',
  'soldering supplies': 'jar',
  flux: 'flux',
  crystal: 'crystal',
  relay: 'relay',
  switch: 'switch',
  led: 'led',
  'led indicator': 'led',
  'bridge rectifier': 'bridge',
  zener: 'diode-zener',
  schottky: 'diode-schottky',
  'rectifier - standard': 'diode',
  'rectifier - fast recovery': 'diode-fast',
  'rectifier - ultra-fast recovery': 'diode-fast',
  'ultra fast recovery': 'diode-fast',
  'tvs / transient suppressor': 'diode-tvs',
  'pptc resettable fuse': 'fuse-ptc',
  fuse: 'fuse',
  'varistor / mov': 'varistor',
  'hybrid ic / custom module': 'asic',
  'vcr system ic': 'asic',
  'potentiometer / trimmer': 'trimpot',
  'ceramic (mlcc)': 'chip-mlcc',
  'ceramic disc': 'capacitor-disc',
  'current/power': 'current-sense',
  'pir sensor': 'motion',
  'dc-dc converter module': 'module-power',
  'buck converter': 'module-power',
  'current sensor module': 'module-sensor',
  'ir receiver module': 'module-sensor',
  'rf & tuner module': 'module-rf',
  'rotary encoder module': 'rotary-switch',
  'voltmeter / ammeter': 'meter',
  'darlington driver': 'darlington',
  'audio processor / dac': 'dac',
  'adc / data acquisition': 'adc',
  'led / backlight driver': 'led-driver',
  'power switch / off-line smps': 'regulator-switching',
};

/** Every subcategory of the taxonomy by name, whatever category it sits in. */
const ANY_SUBCATEGORY = new Map<string, string>();
for (const c of TAXONOMY) for (const s of c.subcategories) if (!ANY_SUBCATEGORY.has(iconKey(s.name))) ANY_SUBCATEGORY.set(iconKey(s.name), s.icon);

/** Icon id for a category (unknown user-made categories get a neutral tag). */
export function categoryIcon(category: string): string {
  return byName.get(category)?.icon ?? LEGACY_CATEGORY_ICONS[iconKey(category)] ?? (category ? 'custom' : 'uncategorized');
}

/** Icon id for a subcategory: its own when known (in its category or any other), otherwise the category's. */
export function subcategoryIcon(category: string, subcategory: string): string {
  const def = byName.get(category);
  const hit = def?.subcategories.find((s) => s.name === subcategory);
  if (hit) return hit.icon;
  const key = iconKey(subcategory);
  return SUBCATEGORY_ICON_ALIASES[key] ?? (key ? ANY_SUBCATEGORY.get(key) : undefined) ?? categoryIcon(category);
}

export function isCanonicalCategory(name: string): boolean {
  return byName.has(name);
}

const ALIASES: Record<string, string> = {
  'thyristors & triacs': 'Thyristors', thyristor: 'Thyristors', triac: 'Thyristors', triacs: 'Thyristors', scr: 'Thyristors',
  unclassified: UNCATEGORIZED, uncategorised: UNCATEGORIZED, other: UNCATEGORIZED, misc: UNCATEGORIZED,
  'consumables & tools': 'Consumables', consumable: 'Consumables', tool: 'Consumables', tools: 'Consumables',
  diode: 'Diodes', ic: 'ICs', 'integrated circuit': 'ICs', 'integrated circuits': 'ICs',
  mosfet: 'Transistors', mosfets: 'Transistors', bjt: 'Transistors', bjts: 'Transistors', transistor: 'Transistors',
  igbt: 'Transistors', igbts: 'Transistors', resistor: 'Resistors', capacitor: 'Capacitors', cap: 'Capacitors',
  inductor: 'Inductors', transformer: 'Transformers', connector: 'Connectors', sensor: 'Sensors', crystal: 'Crystals',
  oscillator: 'Crystals', relay: 'Relays', led: 'LEDs', microcontroller: 'Microcontrollers', mcu: 'Microcontrollers',
  mcus: 'Microcontrollers', switch: 'Switches', module: 'Modules',
  diyot: 'Diodes', diyotlar: 'Diodes', direnc: 'Resistors', 'direnç': 'Resistors', direncler: 'Resistors', 'dirençler': 'Resistors',
  kondansator: 'Capacitors', 'kondansatör': 'Capacitors', kondansatorler: 'Capacitors', 'kondansatörler': 'Capacitors',
  bobin: 'Inductors', bobinler: 'Inductors', transistorler: 'Transistors', 'transistörler': 'Transistors',
  sensorler: 'Sensors', 'sensörler': 'Sensors', roleler: 'Relays', 'röleler': 'Relays', role: 'Relays', 'röle': 'Relays',
  konektor: 'Connectors', 'konnektör': 'Connectors', konektorler: 'Connectors', 'konnektörler': 'Connectors',
  mikrodenetleyici: 'Microcontrollers', mikrodenetleyiciler: 'Microcontrollers',
};

function foldName(s: string): string {
  return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/ı/g, 'i');
}

/** The canonical name for a category; user-made categories come back unchanged; empty is Uncategorized. */
export function normalizeCategory(input: string | null | undefined): string {
  const raw = String(input ?? '').trim();
  if (!raw) return UNCATEGORIZED;
  if (byName.has(raw)) return raw;
  const key = foldName(raw).replace(/[\s\-_/.]+$/, '');
  const canon = CANONICAL_CATEGORIES.find((c) => foldName(c) === key);
  if (canon) return canon;
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (foldName(alias) === key) return target;
  }
  return raw;
}

/** Curated subcategories for a category plus the ones already in use, sorted by locale. */
export function subcategoriesFor(category: string, inUse: Iterable<string>, locale: string): string[] {
  const set = new Set<string>(byName.get(category)?.subcategories.map((s) => s.name) ?? []);
  for (const s of inUse) if (s) set.add(s);
  return [...set].sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base' }));
}

/** Every icon id the taxonomy uses (for the icon gallery and a completeness test). */
export function allIconIds(): string[] {
  const ids = new Set<string>(['custom', 'uncategorized']);
  for (const c of TAXONOMY) {
    ids.add(c.icon);
    for (const s of c.subcategories) ids.add(s.icon);
  }
  return [...ids];
}

/** i18n key of a label; stored values that are not in the taxonomy are shown as they are. */
export function categoryLabelKey(name: string): string | null {
  return byName.has(name) ? `category.${name}` : null;
}

export function subcategoryLabelKey(name: string): string | null {
  for (const c of TAXONOMY) if (c.subcategories.some((s) => s.name === name)) return `subcategory.${name}`;
  return null;
}

export function allSubcategoryNames(): string[] {
  const set = new Set<string>();
  for (const c of TAXONOMY) for (const s of c.subcategories) set.add(s.name);
  return [...set];
}
