/**
 * Part-code pattern rules for common SMD passives and small-signal parts
 * (typical in distributor exports such as Ozdisan, Mouser, Digi-Key).
 * Each entry: { pattern: RegExp, result: object }
 */

const SMD_PKG = '0201|0402|0603|0805|1206|1210|1812|2010|2512';

export const SMD_PART_PATTERNS = [
  // Yageo / Uniroyal chip resistors: 0805S8J0104KT5E, 0805W8F4702T5E
  {
    pattern: new RegExp(`^(${SMD_PKG})[A-Z0-9]{2,}`),
    result: { category: 'Resistors', subcategory: 'SMD', description: 'SMD Chip Resistor' },
  },
  // Yageo RC series: RC0805FR-0710KL
  {
    pattern: new RegExp(`^RC0?(${SMD_PKG})`),
    result: { category: 'Resistors', subcategory: 'SMD', manufacturer: 'Yageo', description: 'SMD Chip Resistor' },
  },
  // Panasonic / other ERJ SMD resistors
  {
    pattern: /^ERJ[-]?[0-9A-Z]{4,}/,
    result: { category: 'Resistors', subcategory: 'SMD', manufacturer: 'Panasonic', description: 'SMD Chip Resistor' },
  },
  // Vishay CRCW / RCWE
  {
    pattern: /^CRCW0(402|603|805|1206)/,
    result: { category: 'Resistors', subcategory: 'SMD', manufacturer: 'Vishay', description: 'SMD Thick Film Resistor' },
  },
  // Samsung MLCC: CL10=0603, CL21=0805, CL31=1206, CL05=0402
  {
    pattern: /^CL05[A-Z0-9]{4,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '0402', manufacturer: 'Samsung', description: 'MLCC Ceramic Capacitor' },
  },
  {
    pattern: /^CL10[A-Z0-9]{4,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '0603', manufacturer: 'Samsung', description: 'MLCC Ceramic Capacitor' },
  },
  {
    pattern: /^CL21[A-Z0-9]{4,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '0805', manufacturer: 'Samsung', description: 'MLCC Ceramic Capacitor' },
  },
  {
    pattern: /^CL31[A-Z0-9]{4,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '1206', manufacturer: 'Samsung', description: 'MLCC Ceramic Capacitor' },
  },
  // Yageo MLCC: CC0402KRX7R9BB104
  {
    pattern: /^CC0402[A-Z0-9]{3,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '0402', manufacturer: 'Yageo', description: 'MLCC Ceramic Capacitor' },
  },
  {
    pattern: /^CC0603[A-Z0-9]{3,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '0603', manufacturer: 'Yageo', description: 'MLCC Ceramic Capacitor' },
  },
  {
    pattern: /^CC0805[A-Z0-9]{3,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '0805', manufacturer: 'Yageo', description: 'MLCC Ceramic Capacitor' },
  },
  {
    pattern: /^CC1206[A-Z0-9]{3,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', package: '1206', manufacturer: 'Yageo', description: 'MLCC Ceramic Capacitor' },
  },
  // Murata GRM MLCC
  {
    pattern: /^GRM(15|18|21|31|32|39)/,
    result: { category: 'Capacitors', subcategory: 'MLCC', manufacturer: 'Murata', description: 'MLCC Ceramic Capacitor' },
  },
  // TDK / generic C#### EIA size MLCC (C1608, C3216, etc.)
  {
    pattern: /^C(1608|2012|3216|3225|4532|5750)[A-Z0-9]{2,}/,
    result: { category: 'Capacitors', subcategory: 'MLCC', manufacturer: 'TDK', description: 'MLCC Ceramic Capacitor' },
  },
  // STMicro / Philips zener: BZV85-C9V1
  {
    pattern: /^BZV\d+/,
    result: { category: 'Diodes', subcategory: 'Zener', description: 'Zener Diode' },
  },
  // SMD zener arrays
  {
    pattern: /^BZX8[45]/,
    result: { category: 'Diodes', subcategory: 'Zener', package: 'SOT-23', description: 'SMD Zener Diode' },
  },
  // Allegro Hall-effect switches: A1126LLHLX-T, A3144
  {
    pattern: /^A(112[0-9]|314[0-9]|130[0-9]|132[0-9])/,
    result: { category: 'Sensors', subcategory: 'Hall Effect', manufacturer: 'Allegro', description: 'Hall Effect Sensor IC' },
  },
  // SMD small-signal / Schottky suffix W
  {
    pattern: /^1N4148W/,
    result: { category: 'Diodes', subcategory: 'Small Signal', package: 'SOD-123', description: 'SMD Small Signal Diode' },
  },
  // PCB / copper clad (Turkish supplier descriptions in part code)
  {
    pattern: /^(BAKIR|BAKIRPLAKET|PERTINAK|PERTINAX|FR4PLAKET)/,
    result: { category: 'Mechanical', subcategory: 'PCB / Board', description: 'Copper Clad / PCB Material' },
  },
  // Zero-ohm jumper / fusible resistor links
  {
    pattern: new RegExp(`^(${SMD_PKG})0{2,3}[A-Z0-9]*`),
    result: { category: 'Resistors', subcategory: 'SMD', description: 'SMD Zero-Ohm Jumper' },
  },
  // Vishay Dale WSL / NH
  {
    pattern: /^NH[A-Z0-9]{3,}/,
    result: { category: 'Resistors', subcategory: 'SMD', manufacturer: 'Vishay', description: 'SMD Resistor' },
  },
  // Kemet / Yageo inductor-style cap codes that look like passives
  {
    pattern: /^C[0-9]{4}C[0-9]/,
    result: { category: 'Capacitors', subcategory: 'MLCC', description: 'MLCC Ceramic Capacitor' },
  },
  // Diodes Inc SMD Schottky SBR
  {
    pattern: /^SBR[0-9]/,
    result: { category: 'Diodes', subcategory: 'Schottky', description: 'SMD Schottky Rectifier' },
  },
  // ON Semi NSR Schottky
  {
    pattern: /^NSR[0-9]/,
    result: { category: 'Diodes', subcategory: 'Schottky', description: 'SMD Schottky Diode' },
  },
  // Infineon BCR current regulator (often miscategorized)
  {
    pattern: /^BCR[0-9]/,
    result: { category: 'ICs', subcategory: 'Linear Regulator', manufacturer: 'Infineon', description: 'Linear Current Regulator' },
  },
  // NXP PMEG Schottky
  {
    pattern: /^PMEG[0-9]/,
    result: { category: 'Diodes', subcategory: 'Schottky', manufacturer: 'Nexperia', description: 'SMD Schottky Rectifier' },
  },
  // Kingbright / Everlight LED chip LEDs
  {
    pattern: /^APT[0-9]/,
    result: { category: 'Diodes', subcategory: 'LED', description: 'SMD LED' },
  },
  {
    pattern: /^EAST[0-9]/,
    result: { category: 'Diodes', subcategory: 'LED', manufacturer: 'Everlight', description: 'SMD LED' },
  },
];

/**
 * Match a normalised part code (uppercase, no spaces/dashes) against SMD patterns.
 * @param {string} key
 * @returns {object|null}
 */
export function matchSmdPartCode(key) {
  if (!key) return null;
  for (const { pattern, result } of SMD_PART_PATTERNS) {
    const m = pattern.exec(key);
    if (!m) continue;
    const out = { ...result };
    // Derive package from EIA size prefix when not set (e.g. 0805S8J...)
    if (!out.package && m[1] && /^0?\d{4}$/.test(m[1])) {
      out.package = m[1].replace(/^0/, '') || m[1];
    }
    return out;
  }
  return null;
}
