/**
 * Category-specific parameters, stored in the `attributes` JSON column (ported from the old app's
 * attribute_schemas.js). Field labels that are symbols (V_GS(th), R_DS(on)) stay as they are in
 * every language; word labels are translated with `attr.<key>`.
 */

export interface AttributeField {
  key: string;
  /** Symbol or English label; translated when `attr.<key>` exists. */
  label: string;
  type: 'number' | 'text' | 'select';
  unit?: string;
  placeholder?: string;
  options?: string[];
}

export interface AttributeSchema {
  label: string;
  fields: AttributeField[];
}

export const ATTRIBUTE_SCHEMAS: Record<string, AttributeSchema> = {
  mosfet: {
    label: 'MOSFET Parameters',
    fields: [
      { key: 'channel',  label: 'Channel Type', type: 'select', options: ['', 'N-Channel', 'P-Channel'] },
      { key: 'vgs_th',   label: 'V_GS(th)',     type: 'number', unit: 'V',   placeholder: '2.5' },
      { key: 'vgs_max',  label: 'V_GS Max',     type: 'number', unit: 'V',   placeholder: '20'  },
      { key: 'rds_on',   label: 'R_DS(on)',      type: 'number', unit: 'mΩ',  placeholder: '45'  },
      { key: 'qg',       label: 'Gate Charge',   type: 'number', unit: 'nC',  placeholder: '18'  },
      { key: 'ciss',     label: 'C_ISS',         type: 'number', unit: 'pF',  placeholder: '500' },
    ],
  },

  bjt: {
    label: 'BJT Parameters',
    fields: [
      { key: 'bjt_type', label: 'Type',         type: 'select', options: ['', 'NPN', 'PNP'] },
      { key: 'hfe',      label: 'h_FE (β)',      type: 'number',             placeholder: '200' },
      { key: 'vce_sat',  label: 'V_CE(sat)',     type: 'number', unit: 'V',  placeholder: '0.3' },
      { key: 'vceo',     label: 'V_CEO',         type: 'number', unit: 'V',  placeholder: '40'  },
      { key: 'ft',       label: 'f_T',           type: 'number', unit: 'MHz',placeholder: '300' },
    ],
  },

  igbt: {
    label: 'IGBT Parameters',
    fields: [
      { key: 'vces',    label: 'V_CES',          type: 'number', unit: 'V',  placeholder: '600' },
      { key: 'vce_sat', label: 'V_CE(sat)',       type: 'number', unit: 'V',  placeholder: '2.0' },
      { key: 'vge_th',  label: 'V_GE(th)',        type: 'number', unit: 'V',  placeholder: '5.5' },
      { key: 'qg',      label: 'Gate Charge',     type: 'number', unit: 'nC', placeholder: '100' },
    ],
  },

  thyristor: {
    label: 'Thyristor / SCR Parameters',
    fields: [
      { key: 'vdrm',  label: 'V_DRM',            type: 'number', unit: 'V',  placeholder: '400' },
      { key: 'it_av', label: 'I_T(AV)',           type: 'number', unit: 'A',  placeholder: '8.0' },
      { key: 'igt',   label: 'I_GT',             type: 'number', unit: 'mA', placeholder: '30'  },
      { key: 'vgt',   label: 'V_GT',             type: 'number', unit: 'V',  placeholder: '1.5' },
      { key: 'tq',    label: 'Turn-off Time',    type: 'number', unit: 'µs', placeholder: '15'  },
    ],
  },

  diode: {
    label: 'Diode Parameters',
    fields: [
      { key: 'diode_type', label: 'Diode Type',  type: 'select', options: ['', 'Rectifier', 'Schottky', 'Switching', 'TVS', 'PIN', 'Varactor'] },
      { key: 'vf',         label: 'V_F',         type: 'number', unit: 'V',  placeholder: '0.7' },
      { key: 'trr',        label: 't_rr',        type: 'number', unit: 'ns', placeholder: '50'  },
      { key: 'ir',         label: 'I_R (leakage)',type: 'number', unit: 'µA', placeholder: '1.0' },
    ],
  },

  zener: {
    label: 'Zener Diode Parameters',
    fields: [
      { key: 'vz',     label: 'V_Z',             type: 'number', unit: 'V',  placeholder: '5.1' },
      { key: 'iz_max', label: 'I_Z Max',         type: 'number', unit: 'mA', placeholder: '200' },
      { key: 'pz',     label: 'Power Diss.',     type: 'number', unit: 'W',  placeholder: '0.5' },
      { key: 'ztol',   label: 'Tolerance',       type: 'number', unit: '%',  placeholder: '5'   },
    ],
  },

  led: {
    label: 'LED Parameters',
    fields: [
      { key: 'color',      label: 'Color',       type: 'select', options: ['', 'Red', 'Green', 'Blue', 'White', 'Yellow', 'Orange', 'IR', 'UV'] },
      { key: 'vf',         label: 'V_F',         type: 'number', unit: 'V',   placeholder: '2.0' },
      { key: 'if_max',     label: 'I_F Max',     type: 'number', unit: 'mA',  placeholder: '20'  },
      { key: 'wavelength', label: 'Wavelength',  type: 'number', unit: 'nm',  placeholder: '630' },
      { key: 'luminosity', label: 'Luminosity',  type: 'number', unit: 'mcd', placeholder: '500' },
    ],
  },

  opamp: {
    label: 'Op-Amp Parameters',
    fields: [
      { key: 'channels',   label: 'Channels',    type: 'number',              placeholder: '1'   },
      { key: 'v_supply',   label: 'Supply',      type: 'text',                placeholder: '±15V'},
      { key: 'gbw',        label: 'GBW',         type: 'number', unit: 'MHz', placeholder: '1.0' },
      { key: 'slew_rate',  label: 'Slew Rate',   type: 'number', unit: 'V/µs',placeholder: '0.5' },
      { key: 'vos',        label: 'V_OS',        type: 'number', unit: 'mV',  placeholder: '2.0' },
    ],
  },

  voltage_regulator: {
    label: 'Voltage Regulator Parameters',
    fields: [
      { key: 'reg_type',  label: 'Type',         type: 'select', options: ['', 'LDO', 'Linear', 'Fixed', 'Adjustable', 'Buck', 'Boost', 'Buck-Boost'] },
      { key: 'v_out',     label: 'V_OUT',        type: 'number', unit: 'V',   placeholder: '5.0' },
      { key: 'v_in_max',  label: 'V_IN Max',     type: 'number', unit: 'V',   placeholder: '40'  },
      { key: 'i_out',     label: 'I_OUT Max',    type: 'number', unit: 'A',   placeholder: '1.0' },
      { key: 'dropout',   label: 'Dropout',      type: 'number', unit: 'V',   placeholder: '1.5' },
    ],
  },

  crystal: {
    label: 'Crystal / Oscillator Parameters',
    fields: [
      { key: 'frequency', label: 'Frequency',    type: 'number', unit: 'MHz', placeholder: '16'  },
      { key: 'load_cap',  label: 'Load Cap.',    type: 'number', unit: 'pF',  placeholder: '18'  },
      { key: 'freq_tol',  label: 'Tolerance',    type: 'number', unit: 'ppm', placeholder: '30'  },
    ],
  },

  inductor: {
    label: 'Inductor Parameters',
    fields: [
      { key: 'inductance', label: 'Inductance',  type: 'number', unit: 'µH',  placeholder: '10'  },
      { key: 'isat',       label: 'I_SAT',       type: 'number', unit: 'A',   placeholder: '2.0' },
      { key: 'dcr',        label: 'DCR',         type: 'number', unit: 'mΩ',  placeholder: '120' },
      { key: 'srf',        label: 'SRF',         type: 'number', unit: 'MHz', placeholder: '100' },
    ],
  },

  transformer: {
    label: 'Transformer Parameters',
    fields: [
      { key: 'turns_ratio', label: 'Turns Ratio', type: 'text',              placeholder: '1:1'       },
      { key: 'power_va',    label: 'Power',        type: 'number', unit: 'VA',placeholder: '10'        },
      { key: 'freq_range',  label: 'Freq. Range',  type: 'text',              placeholder: '20Hz-100kHz' },
    ],
  },

  sensor: {
    label: 'Sensor Parameters',
    fields: [
      { key: 'interface',   label: 'Interface',   type: 'select', options: ['', 'I2C', 'SPI', 'UART', 'Analog', '1-Wire', 'PWM', 'CAN'] },
      { key: 'measurement', label: 'Measures',    type: 'text',               placeholder: 'Temperature'   },
      { key: 'range',       label: 'Range',       type: 'text',               placeholder: '-40 to +125°C' },
      { key: 'accuracy',    label: 'Accuracy',    type: 'text',               placeholder: '±0.5°C'        },
      { key: 'supply_v',    label: 'Supply',      type: 'text',               placeholder: '3.3-5V'        },
    ],
  },

  mcu: {
    label: 'Microcontroller Parameters',
    fields: [
      { key: 'core',      label: 'CPU Core',      type: 'text',               placeholder: 'ARM Cortex-M0' },
      { key: 'freq_max',  label: 'Max Freq.',     type: 'number', unit: 'MHz', placeholder: '72'           },
      { key: 'flash',     label: 'Flash',         type: 'number', unit: 'KB',  placeholder: '64'           },
      { key: 'ram',       label: 'RAM',           type: 'number', unit: 'KB',  placeholder: '20'           },
      { key: 'supply_v',  label: 'Supply',        type: 'text',               placeholder: '2.0-3.6V'      },
      { key: 'io_pins',   label: 'I/O Pins',      type: 'number',             placeholder: '32'            },
    ],
  },
};

export function detectSchemaKey(category: string, subcategory = ''): string | null {
  const cat = (category    || '').toLowerCase().trim();
  const sub = (subcategory || '').toLowerCase().trim();

  // --- subcategory takes priority ---
  if (sub.includes('bjt') || sub.includes('npn') || sub.includes('pnp')) return 'bjt';
  if (
    sub.includes('mosfet') ||
    sub.includes('n-channel') || sub.includes('p-channel') ||
    sub.includes('n-ch')     || sub.includes('p-ch')
  ) return 'mosfet';
  if (sub.includes('igbt'))                                              return 'igbt';
  if (sub.includes('thyristor') || sub.includes('scr') || sub.includes('triac')) return 'thyristor';
  if (sub.includes('zener'))                                             return 'zener';
  if (sub.includes('led'))                                               return 'led';

  // --- category-level matching ---
  if (cat.includes('mosfet') || cat.includes('n-ch') || cat.includes('p-ch')) return 'mosfet';
  if (cat.includes('bjt') || cat.includes('npn') || cat.includes('pnp'))       return 'bjt';
  if (cat.includes('igbt'))                                                     return 'igbt';
  if (cat.includes('thyristor') || cat.includes('scr') || cat.includes('triac')) return 'thyristor';
  if (cat.includes('zener'))                                                    return 'zener';
  if (cat.includes('led'))                                                      return 'led';
  if (cat.includes('diode'))                                                    return 'diode';
  if (cat.includes('op-amp') || cat.includes('op amp') || cat.includes('opamp') || cat.includes('operational')) return 'opamp';
  if (cat.includes('voltage regulator') || cat.includes('ldo') || (cat.includes('regulator') && !cat.includes('sensor'))) return 'voltage_regulator';
  if (cat.includes('crystal') || cat.includes('oscillator') || cat.includes('xtal')) return 'crystal';
  if (cat.includes('transformer'))                                              return 'transformer';
  if (cat.includes('inductor') || cat.includes('coil'))                        return 'inductor';
  if (cat.includes('sensor') || cat.includes('sensör'))                        return 'sensor';
  if (cat.includes('microcontroller') || cat.includes('mcu'))                  return 'mcu';

  return null;
}


export function schemaFor(category: string, subcategory = ''): AttributeSchema | null {
  const key = detectSchemaKey(category, subcategory);
  return key ? ATTRIBUTE_SCHEMAS[key] ?? null : null;
}

/** Every field across schemas, by key (for labels and units in the detail panel). */
export const ATTRIBUTE_FIELDS: Record<string, AttributeField> = Object.fromEntries(
  Object.values(ATTRIBUTE_SCHEMAS).flatMap((s) => s.fields.map((f) => [f.key, f])),
);
