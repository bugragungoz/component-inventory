import { describe, it, expect } from 'vitest';
import { lookupComponent, lookupCanonical, categorizeByDescription, applyDbData } from '../hardcoded_datasheet.js';

describe('hardcoded_datasheet', () => {
  it('finds known component by exact code', () => {
    const hit = lookupComponent('LM7805');
    expect(hit).not.toBeNull();
    expect(hit.category).toBe('ICs');
  });

  it('returns canonical key for alias/prefix style input', () => {
    const info = lookupCanonical('LM7805CP');
    expect(info).not.toBeNull();
    expect(info.canonical).toBe('LM7805');
    expect(info.match).toBe('prefix');
  });

  it('categorizes description into optocoupler', () => {
    const cat = categorizeByDescription('High speed optocoupler phototransistor output');
    expect(cat).toEqual({ category: 'ICs', subcategory: 'Optocoupler' });
  });

  it('classifies STPS Schottky family as Diodes, not MOSFET', () => {
    const sch = lookupComponent('STPS745FP');
    expect(sch).not.toBeNull();
    expect(sch.category).toBe('Diodes');
    expect(sch.subcategory).toBe('Schottky');
    const mos = lookupComponent('STP16NF06');
    expect(mos).not.toBeNull();
    expect(mos.category).toBe('Transistors');
    expect(mos.subcategory).toBe('Power MOSFET');
  });

  it('classifies common SMD passive MPNs from distributor exports', () => {
    const r1 = lookupComponent('0805S8J0104KT5E');
    expect(r1).not.toBeNull();
    expect(r1.category).toBe('Resistors');
    expect(r1.subcategory).toBe('SMD');

    const c1 = lookupComponent('CL10A105KB8NNNC');
    expect(c1).not.toBeNull();
    expect(c1.category).toBe('Capacitors');
    expect(c1.subcategory).toBe('MLCC');

    const c2 = lookupComponent('CC0402KRX7R9BB104');
    expect(c2).not.toBeNull();
    expect(c2.category).toBe('Capacitors');

    const z = lookupComponent('BZV85-C9V1');
    expect(z).not.toBeNull();
    expect(z.category).toBe('Diodes');
    expect(z.subcategory).toBe('Zener');
  });

  it('applies DB category over Uncategorized placeholder', () => {
    const merged = applyDbData(
      { category: 'Uncategorized', description: '', datasheet_url: '' },
      { category: 'Resistors', subcategory: 'SMD', description: '0805 SMD Chip Resistor' }
    );
    expect(merged.category).toBe('Resistors');
    expect(merged.subcategory).toBe('SMD');
  });

  it('categorizes Turkish product descriptions', () => {
    const cat = categorizeByDescription('0805 SMD DIRENC 100R %1');
    expect(cat).not.toBeNull();
    expect(cat.category).toBe('Resistors');
  });

  it('classifies widespread part-code families', () => {
    expect(lookupComponent('2N3904')?.category).toBe('Transistors');
    expect(lookupComponent('BAT54C')?.subcategory).toBe('Schottky');
    expect(lookupComponent('AMS1117-3.3')?.subcategory).toBe('LDO Regulator');
    expect(lookupComponent('NE555P')?.subcategory).toBe('Timer');
    expect(lookupComponent('W25Q128JVSIQ')?.subcategory).toBe('Flash');
    expect(lookupComponent('ESP32-WROOM-32')?.category).toBe('ICs');
    expect(lookupComponent('TAJ106K016RNJ')?.subcategory).toBe('Tantalum');
    expect(lookupComponent('BLM18PG121SN1D')?.subcategory).toBe('Ferrite Core');
  });

  it('fills only empty fields while preserving existing values', () => {
    const merged = applyDbData(
      { category: 'Custom', description: '', datasheet_url: '', voltage_max: null },
      { category: 'ICs', description: 'Timer IC', datasheet_url: 'https://example.test/ds.pdf', voltage_max: 35 }
    );
    expect(merged.category).toBe('Custom');
    expect(merged.description).toBe('Timer IC');
    expect(merged.datasheet_url).toBe('https://example.test/ds.pdf');
    expect(merged.voltage_max).toBe(35);
  });
});
