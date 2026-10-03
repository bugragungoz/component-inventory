/**
 * The parts library (patched.db) files parts under its supplier's categories ("Triode/MOS
 * Tube/Transistor", "Power Supply Chip" ...). This maps them to the app's taxonomy so a part
 * filled from the library lands in the same category as one typed by hand. Unknown names come
 * back empty: better no category than a wrong one.
 */
import { UNCATEGORIZED } from './taxonomy';

export interface Classified {
  category: string;
  subcategory: string;
}

const has = (s: string, re: RegExp) => re.test(s);

function transistor(sub: string, desc: string): Classified {
  const s = `${sub} ${desc}`;
  if (has(s, /triac/i)) return { category: 'Thyristors', subcategory: 'TRIAC' };
  if (has(s, /thyristor|\bscr\b/i)) return { category: 'Thyristors', subcategory: 'SCR' };
  if (has(sub, /tvs|esd|surge/i)) return { category: 'Diodes', subcategory: 'TVS' };
  if (has(s, /igbt/i)) return { category: 'Transistors', subcategory: 'IGBT' };
  if (has(s, /jfet/i)) return { category: 'Transistors', subcategory: 'JFET' };
  if (has(sub, /darlington.*array/i)) return { category: 'Transistors', subcategory: 'Darlington Array' };
  if (has(s, /darlington/i)) return { category: 'Transistors', subcategory: has(desc, /\bpnp\b/i) ? 'Darlington PNP' : 'Darlington NPN' };
  if (has(sub, /mosfet/i)) {
    if (has(desc, /\bp[- ]?(ch|channel)\b|p-mos/i)) return { category: 'Transistors', subcategory: 'MOSFET P-Channel' };
    if (has(desc, /\bn[- ]?(ch|channel)\b|n-mos/i)) return { category: 'Transistors', subcategory: 'MOSFET N-Channel' };
    return { category: 'Transistors', subcategory: 'Power MOSFET' };
  }
  if (has(sub, /bipolar|bjt|digital transistor/i)) {
    if (has(desc, /\bpnp\b/i)) return { category: 'Transistors', subcategory: 'BJT PNP' };
    if (has(desc, /\bnpn\b/i)) return { category: 'Transistors', subcategory: 'BJT NPN' };
  }
  return { category: 'Transistors', subcategory: '' };
}

function power(sub: string): Classified {
  if (has(sub, /ldo|linear/i)) return { category: 'ICs', subcategory: 'LDO Regulator' };
  if (has(sub, /dc-dc/i)) return { category: 'ICs', subcategory: 'DC-DC Converter' };
  if (has(sub, /gate driv/i)) return { category: 'ICs', subcategory: 'Gate Driver' };
  if (has(sub, /motor driver/i)) return { category: 'ICs', subcategory: 'Motor Driver' };
  if (has(sub, /power module/i)) return { category: 'Modules', subcategory: 'Power Supply' };
  return { category: 'ICs', subcategory: '' };
}

function inductor(sub: string): Classified {
  if (has(sub, /audio transformer/i)) return { category: 'Transformers', subcategory: 'Audio' };
  if (has(sub, /pulse transformer|current (sense )?transformer|current transformers/i)) return { category: 'Transformers', subcategory: 'Pulse / Current' };
  if (has(sub, /transformer/i)) return { category: 'Transformers', subcategory: '' };
  if (has(sub, /power inductor/i)) return { category: 'Inductors', subcategory: 'Power' };
  if (has(sub, /smd/i)) return { category: 'Inductors', subcategory: 'SMD' };
  return { category: 'Inductors', subcategory: 'Inductor' };
}

function amplifier(sub: string): Classified {
  if (has(sub, /comparator/i)) return { category: 'ICs', subcategory: 'Comparator' };
  if (has(sub, /instrumentation/i)) return { category: 'ICs', subcategory: 'Instrumentation Amplifier' };
  if (has(sub, /audio/i)) return { category: 'ICs', subcategory: 'Audio Amplifier' };
  if (has(sub, /current.?sens/i)) return { category: 'ICs', subcategory: 'Current Sensor' };
  return { category: 'ICs', subcategory: 'Op-Amp' };
}

export function classifyLibraryPart(category: string, subcategory: string, description = ''): Classified {
  const c = category.trim();
  const s = subcategory.trim();
  if (/transistor|thyristor|mos tube/i.test(c)) return transistor(s, description);
  if (/^inductors/i.test(c)) return inductor(s);
  if (/power management|power supply chip/i.test(c)) return power(s);
  if (/amplifier|comparator/i.test(c)) return amplifier(s);
  if (/led driver|nixie/i.test(c)) return { category: 'ICs', subcategory: 'LED Driver' };
  if (/optocoupler|optoelectronic|photoelectric/i.test(c)) {
    if (/optocoupler/i.test(s)) return { category: 'ICs', subcategory: 'Optocoupler' };
    if (/solid state relay|photomos/i.test(s)) return { category: 'Relays', subcategory: 'Solid State' };
    if (/phototransistor|photointerrupter/i.test(s)) return { category: 'LEDs', subcategory: 'Photodiode / Phototransistor' };
    return { category: 'LEDs', subcategory: '' };
  }
  if (/^relays?$/i.test(c)) return { category: 'Relays', subcategory: /reed/i.test(s) ? 'Reed' : '' };
  if (/^connectors?$/i.test(c)) return { category: 'Connectors', subcategory: /ic \/ transistor socket/i.test(s) ? 'IC Socket' : /idc/i.test(s) ? 'IDC / Ribbon' : /coaxial|rf/i.test(s) ? 'RF / Coaxial' : '' };
  if (/^sensors?$/i.test(c)) {
    if (/humidity/i.test(s)) return { category: 'Sensors', subcategory: 'Humidity' };
    if (/temperature/i.test(s)) return { category: 'Sensors', subcategory: 'Temperature' };
    if (/ultrasonic/i.test(s)) return { category: 'Sensors', subcategory: 'Ultrasonic' };
    if (/photointerrupter/i.test(s)) return { category: 'Sensors', subcategory: 'Proximity' };
    return { category: 'Sensors', subcategory: '' };
  }
  if (/^logic/i.test(c)) return { category: 'ICs', subcategory: 'Logic' };
  if (/rf and wireless|radio frequency/i.test(c)) return { category: 'ICs', subcategory: 'RF Transceiver' };
  if (/data acquisition/i.test(c)) return { category: 'ICs', subcategory: 'ADC' };
  if (/crystal|oscillator|resonator/i.test(c)) return { category: 'Crystals', subcategory: '' };
  if (/^diodes?$/i.test(c)) return { category: 'Diodes', subcategory: '' };
  if (/^leds?$/i.test(c)) return { category: 'LEDs', subcategory: '' };
  if (/^displays?$/i.test(c)) return { category: 'Modules', subcategory: 'Display' };
  if (/embedded processor|microcontroller/i.test(c)) return { category: 'Microcontrollers', subcategory: '' };
  if (/^ics?$/i.test(c)) return { category: 'ICs', subcategory: '' };
  return { category: '', subcategory: '' };
}

export const NOT_CLASSIFIED: Classified = { category: UNCATEGORIZED, subcategory: '' };

/** The same part with its category and subcategory in the app's taxonomy. */
export function withTaxonomy<T extends { category: string; subcategory: string; description: string }>(p: T): T {
  const c = classifyLibraryPart(p.category, p.subcategory, p.description);
  return { ...p, category: c.category, subcategory: c.subcategory };
}
