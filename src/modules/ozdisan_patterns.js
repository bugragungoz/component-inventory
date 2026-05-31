/**
 * Part-code patterns common on Ozdisan (Viking, Royal Ohm, Walsin, etc.).
 * Sourced from Ozdisan catalog paths and distributor datasheets.
 */

export const OZDISAN_PART_PATTERNS = [
  // Royal Ohm CQ series — 0402 thick-film (Ozdisan: smt direncler)
  {
    pattern: /^CQ02WGF[0-9A-Z]{4,}/,
    result: {
      category: 'Resistors',
      subcategory: 'SMD',
      package: '0402',
      manufacturer: 'Royal Ohm',
      description: '0402 thick film chip resistor 1%',
    },
  },
  {
    pattern: /^CQ02WGJ[0-9A-Z]{4,}/,
    result: {
      category: 'Resistors',
      subcategory: 'SMD',
      package: '0402',
      manufacturer: 'Royal Ohm',
      description: '0402 thick film chip resistor 5%',
    },
  },
  // Viking CRT — 0603 thick-film resistor
  {
    pattern: /^CRT03[F7E][0-9A-Z]{4,}/,
    result: {
      category: 'Resistors',
      subcategory: 'SMD',
      package: '0603',
      manufacturer: 'Viking',
      description: '0603 thick film chip resistor',
    },
  },
  // Viking MCF — 0603 MLCC (Ozdisan: smt kondansatorler)
  {
    pattern: /^MCF03KTB[0-9A-Z]{4,}/,
    result: {
      category: 'Capacitors',
      subcategory: 'MLCC',
      package: '0603',
      manufacturer: 'Viking',
      description: '0603 MLCC ceramic capacitor',
    },
  },
  // Thin-film 0402
  {
    pattern: /^RI0402L[0-9A-Z]{4,}/,
    result: {
      category: 'Resistors',
      subcategory: 'SMD',
      package: '0402',
      manufacturer: 'Yageo',
      description: '0402 thin film chip resistor',
    },
  },
  // Walsin WR04 — 0402
  {
    pattern: /^WR04X[0-9A-Z]{4,}/,
    result: {
      category: 'Resistors',
      subcategory: 'SMD',
      package: '0402',
      manufacturer: 'Walsin',
      description: '0402 thick film chip resistor',
    },
  },
  // Cement / wirewound power
  {
    pattern: /^RX24[-_]?[0-9A-Z]+/,
    result: {
      category: 'Resistors',
      subcategory: 'Wirewound',
      manufacturer: 'RX24',
      description: 'Wirewound power resistor',
    },
  },
  {
    pattern: /^RX[0-9]{2}[-_]?[0-9A-Z]*W/i,
    result: {
      category: 'Resistors',
      subcategory: 'Power',
      description: 'Power wirewound resistor',
    },
  },
  // WH148 rotary potentiometer (Ozdisan: potansiyometreler)
  {
    pattern: /^WH148[-_]?[0-9A-Z]*/,
    result: {
      category: 'Potentiometers',
      subcategory: 'Rotary',
      manufacturer: 'WH148',
      description: '16mm rotary potentiometer',
    },
  },
  // Royal Ohm 0603 CQ03 (related family)
  {
    pattern: /^CQ03SAF[0-9A-Z]{4,}/,
    result: {
      category: 'Resistors',
      subcategory: 'SMD',
      package: '0603',
      manufacturer: 'Royal Ohm',
      description: '0603 thick film chip resistor',
    },
  },
];
