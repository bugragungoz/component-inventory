import { describe, expect, it } from 'vitest';
import { classifyLibraryPart } from './libraryMap';
import { isCanonicalCategory, subcategoriesFor } from './taxonomy';

describe('library categories', () => {
  it('maps the supplier categories into the taxonomy', () => {
    expect(classifyLibraryPart('Triode/MOS Tube/Transistor', 'MOSFETs', '55V 49A N-Channel')).toEqual({ category: 'Transistors', subcategory: 'MOSFET N-Channel' });
    expect(classifyLibraryPart('Transistors/Thyristors', 'Bipolar (BJT)', 'PNP 40V')).toEqual({ category: 'Transistors', subcategory: 'BJT PNP' });
    expect(classifyLibraryPart('Triode/MOS Tube/Transistor', 'TRIACs', '')).toEqual({ category: 'Thyristors', subcategory: 'TRIAC' });
    expect(classifyLibraryPart('Power Supply Chip', 'Linear Voltage Regulators (LDO)')).toEqual({ category: 'ICs', subcategory: 'LDO Regulator' });
    expect(classifyLibraryPart('Operational Amplifier/Comparator', 'Comparators')).toEqual({ category: 'ICs', subcategory: 'Comparator' });
    expect(classifyLibraryPart('Inductors, Coils, Chokes', 'Pulse Transformers(LAN)')).toEqual({ category: 'Transformers', subcategory: 'Pulse / Current' });
    expect(classifyLibraryPart('Industrial control electrical', '')).toEqual({ category: '', subcategory: '' });
  });

  it('only returns names the taxonomy has', () => {
    const cats = ['Transistors/Thyristors', 'Triode/MOS Tube/Transistor', 'Power Management (PMIC)', 'Power Supply Chip', 'Inductors, Coils, Chokes', 'Operational Amplifier/Comparator',
      'Optocoupler/LED/Digital Tube/Photoelectric Device', 'Relays', 'Connectors', 'Sensors', 'Logic ICs', 'RF and Wireless', 'Displays', 'LED Drivers'];
    const subs = ['MOSFETs', 'Bipolar (BJT)', 'IGBTs', 'Darlington Transistor Arrays', 'DC-DC Converters', 'Gate Drive ICs', 'Power Modules', 'Power Inductors', 'Audio Transformers',
      'Instrumentation OpAmps', 'Optocouplers - Phototransistor Output', 'Solid State Relays - MOS Output (PhotoMOS)', 'Reed Relays', 'IDC Connectors', 'Humidity Sensor', ''];
    for (const c of cats) for (const s of subs) for (const d of ['', 'N-Channel', 'PNP']) {
      const r = classifyLibraryPart(c, s, d);
      if (r.category) expect(isCanonicalCategory(r.category)).toBe(true);
      if (r.subcategory) expect(subcategoriesFor(r.category, [], 'en')).toContain(r.subcategory);
    }
  });
});
