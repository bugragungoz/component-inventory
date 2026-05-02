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
