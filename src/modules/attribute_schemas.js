// ============================================================
// Category-based Attribute Schemas
//
// Defines extra parameters beyond the standard fixed columns
// for each component type. Values are stored in the JSON
// `attributes` column of the components table.
//
// SQLite JSON query example:
//   -- Find MOSFETs with Rds(on) < 50 mΩ
//   SELECT * FROM components
//    WHERE category LIKE '%MOSFET%'
//      AND CAST(json_extract(attributes, '$.rds_on') AS REAL) < 50;
//
// ============================================================

/**
 * Each entry defines:
 *   label   — section heading shown in the form
 *   fields  — array of field descriptors:
 *               key          unique JSON key
 *               label        human-readable label
 *               type         'number' | 'text' | 'select'
 *               unit         (optional) unit suffix for label
 *               placeholder  (optional) input placeholder
 *               options      (required for 'select') array of choice strings
 */
export const ATTRIBUTE_SCHEMAS = {
  mosfet: {
    label: 'MOSFET Parameters',
    fields: [
      { key: 'channel',  label: 'Channel Type', type: 'select', options: ['', 'N-Channel', 'P-Channel'] },
      { key: 'vgs_th',   label: 'V_GS(th)',     type: 'number', unit: 'V',   placeholder: 'e.g. 2.5' },
      { key: 'vgs_max',  label: 'V_GS Max',     type: 'number', unit: 'V',   placeholder: 'e.g. 20'  },
      { key: 'rds_on',   label: 'R_DS(on)',      type: 'number', unit: 'mΩ',  placeholder: 'e.g. 45'  },
      { key: 'qg',       label: 'Gate Charge',   type: 'number', unit: 'nC',  placeholder: 'e.g. 18'  },
      { key: 'ciss',     label: 'C_ISS',         type: 'number', unit: 'pF',  placeholder: 'e.g. 500' },
    ],
  },

  bjt: {
    label: 'BJT Parameters',
    fields: [
      { key: 'bjt_type', label: 'Type',         type: 'select', options: ['', 'NPN', 'PNP'] },
      { key: 'hfe',      label: 'h_FE (β)',      type: 'number',             placeholder: 'e.g. 200' },
      { key: 'vce_sat',  label: 'V_CE(sat)',     type: 'number', unit: 'V',  placeholder: 'e.g. 0.3' },
      { key: 'vceo',     label: 'V_CEO',         type: 'number', unit: 'V',  placeholder: 'e.g. 40'  },
      { key: 'ft',       label: 'f_T',           type: 'number', unit: 'MHz',placeholder: 'e.g. 300' },
    ],
  },

  igbt: {
    label: 'IGBT Parameters',
    fields: [
      { key: 'vces',    label: 'V_CES',          type: 'number', unit: 'V',  placeholder: 'e.g. 600' },
      { key: 'vce_sat', label: 'V_CE(sat)',       type: 'number', unit: 'V',  placeholder: 'e.g. 2.0' },
      { key: 'vge_th',  label: 'V_GE(th)',        type: 'number', unit: 'V',  placeholder: 'e.g. 5.5' },
      { key: 'qg',      label: 'Gate Charge',     type: 'number', unit: 'nC', placeholder: 'e.g. 100' },
    ],
  },

  thyristor: {
    label: 'Thyristor / SCR Parameters',
    fields: [
      { key: 'vdrm',  label: 'V_DRM',            type: 'number', unit: 'V',  placeholder: 'e.g. 400' },
      { key: 'it_av', label: 'I_T(AV)',           type: 'number', unit: 'A',  placeholder: 'e.g. 8.0' },
      { key: 'igt',   label: 'I_GT',             type: 'number', unit: 'mA', placeholder: 'e.g. 30'  },
      { key: 'vgt',   label: 'V_GT',             type: 'number', unit: 'V',  placeholder: 'e.g. 1.5' },
      { key: 'tq',    label: 'Turn-off Time',    type: 'number', unit: 'µs', placeholder: 'e.g. 15'  },
    ],
  },

  diode: {
    label: 'Diode Parameters',
    fields: [
      { key: 'diode_type', label: 'Diode Type',  type: 'select', options: ['', 'Rectifier', 'Schottky', 'Switching', 'TVS', 'PIN', 'Varactor'] },
      { key: 'vf',         label: 'V_F',         type: 'number', unit: 'V',  placeholder: 'e.g. 0.7' },
      { key: 'trr',        label: 't_rr',        type: 'number', unit: 'ns', placeholder: 'e.g. 50'  },
      { key: 'ir',         label: 'I_R (leakage)',type: 'number', unit: 'µA', placeholder: 'e.g. 1.0' },
    ],
  },

  zener: {
    label: 'Zener Diode Parameters',
    fields: [
      { key: 'vz',     label: 'V_Z',             type: 'number', unit: 'V',  placeholder: 'e.g. 5.1' },
      { key: 'iz_max', label: 'I_Z Max',         type: 'number', unit: 'mA', placeholder: 'e.g. 200' },
      { key: 'pz',     label: 'Power Diss.',     type: 'number', unit: 'W',  placeholder: 'e.g. 0.5' },
      { key: 'ztol',   label: 'Tolerance',       type: 'number', unit: '%',  placeholder: 'e.g. 5'   },
    ],
  },

  led: {
    label: 'LED Parameters',
    fields: [
      { key: 'color',      label: 'Color',       type: 'select', options: ['', 'Red', 'Green', 'Blue', 'White', 'Yellow', 'Orange', 'IR', 'UV'] },
      { key: 'vf',         label: 'V_F',         type: 'number', unit: 'V',   placeholder: 'e.g. 2.0' },
      { key: 'if_max',     label: 'I_F Max',     type: 'number', unit: 'mA',  placeholder: 'e.g. 20'  },
      { key: 'wavelength', label: 'Wavelength',  type: 'number', unit: 'nm',  placeholder: 'e.g. 630' },
      { key: 'luminosity', label: 'Luminosity',  type: 'number', unit: 'mcd', placeholder: 'e.g. 500' },
    ],
  },

  opamp: {
    label: 'Op-Amp Parameters',
    fields: [
      { key: 'channels',   label: 'Channels',    type: 'number',              placeholder: 'e.g. 1'   },
      { key: 'v_supply',   label: 'Supply',      type: 'text',                placeholder: 'e.g. ±15V'},
      { key: 'gbw',        label: 'GBW',         type: 'number', unit: 'MHz', placeholder: 'e.g. 1.0' },
      { key: 'slew_rate',  label: 'Slew Rate',   type: 'number', unit: 'V/µs',placeholder: 'e.g. 0.5' },
      { key: 'vos',        label: 'V_OS',        type: 'number', unit: 'mV',  placeholder: 'e.g. 2.0' },
    ],
  },

  voltage_regulator: {
    label: 'Voltage Regulator Parameters',
    fields: [
      { key: 'reg_type',  label: 'Type',         type: 'select', options: ['', 'LDO', 'Linear', 'Fixed', 'Adjustable', 'Buck', 'Boost', 'Buck-Boost'] },
      { key: 'v_out',     label: 'V_OUT',        type: 'number', unit: 'V',   placeholder: 'e.g. 5.0' },
      { key: 'v_in_max',  label: 'V_IN Max',     type: 'number', unit: 'V',   placeholder: 'e.g. 40'  },
      { key: 'i_out',     label: 'I_OUT Max',    type: 'number', unit: 'A',   placeholder: 'e.g. 1.0' },
      { key: 'dropout',   label: 'Dropout',      type: 'number', unit: 'V',   placeholder: 'e.g. 1.5' },
    ],
  },

  crystal: {
    label: 'Crystal / Oscillator Parameters',
    fields: [
      { key: 'frequency', label: 'Frequency',    type: 'number', unit: 'MHz', placeholder: 'e.g. 16'  },
      { key: 'load_cap',  label: 'Load Cap.',    type: 'number', unit: 'pF',  placeholder: 'e.g. 18'  },
      { key: 'freq_tol',  label: 'Tolerance',    type: 'number', unit: 'ppm', placeholder: 'e.g. 30'  },
    ],
  },

  inductor: {
    label: 'Inductor Parameters',
    fields: [
      { key: 'inductance', label: 'Inductance',  type: 'number', unit: 'µH',  placeholder: 'e.g. 10'  },
      { key: 'isat',       label: 'I_SAT',       type: 'number', unit: 'A',   placeholder: 'e.g. 2.0' },
      { key: 'dcr',        label: 'DCR',         type: 'number', unit: 'mΩ',  placeholder: 'e.g. 120' },
      { key: 'srf',        label: 'SRF',         type: 'number', unit: 'MHz', placeholder: 'e.g. 100' },
    ],
  },

  transformer: {
    label: 'Transformer Parameters',
    fields: [
      { key: 'turns_ratio', label: 'Turns Ratio', type: 'text',              placeholder: 'e.g. 1:1'       },
      { key: 'power_va',    label: 'Power',        type: 'number', unit: 'VA',placeholder: 'e.g. 10'        },
      { key: 'freq_range',  label: 'Freq. Range',  type: 'text',              placeholder: 'e.g. 20Hz-100kHz' },
    ],
  },

  sensor: {
    label: 'Sensor Parameters',
    fields: [
      { key: 'interface',   label: 'Interface',   type: 'select', options: ['', 'I2C', 'SPI', 'UART', 'Analog', '1-Wire', 'PWM', 'CAN'] },
      { key: 'measurement', label: 'Measures',    type: 'text',               placeholder: 'e.g. Temperature'   },
      { key: 'range',       label: 'Range',       type: 'text',               placeholder: 'e.g. -40 to +125°C' },
      { key: 'accuracy',    label: 'Accuracy',    type: 'text',               placeholder: 'e.g. ±0.5°C'        },
      { key: 'supply_v',    label: 'Supply',      type: 'text',               placeholder: 'e.g. 3.3–5V'        },
    ],
  },

  mcu: {
    label: 'Microcontroller Parameters',
    fields: [
      { key: 'core',      label: 'CPU Core',      type: 'text',               placeholder: 'e.g. ARM Cortex-M0' },
      { key: 'freq_max',  label: 'Max Freq.',     type: 'number', unit: 'MHz', placeholder: 'e.g. 72'           },
      { key: 'flash',     label: 'Flash',         type: 'number', unit: 'KB',  placeholder: 'e.g. 64'           },
      { key: 'ram',       label: 'RAM',           type: 'number', unit: 'KB',  placeholder: 'e.g. 20'           },
      { key: 'supply_v',  label: 'Supply',        type: 'text',               placeholder: 'e.g. 2.0–3.6V'      },
      { key: 'io_pins',   label: 'I/O Pins',      type: 'number',             placeholder: 'e.g. 32'            },
    ],
  },
};

// ============================================================
// Schema detection
// ============================================================

/**
 * Normalise category and subcategory strings to determine the
 * attribute schema key to use. Subcategory takes priority to
 * allow distinguishing BJT vs MOSFET within "Transistors".
 *
 * @param {string} category
 * @param {string} [subcategory]
 * @returns {string|null} key into ATTRIBUTE_SCHEMAS, or null
 */
export function detectSchemaKey(category, subcategory = '') {
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

/**
 * Returns the attribute schema for the given category/subcategory, or null
 * when no specific schema is defined for that combination.
 *
 * @param {string} category
 * @param {string} [subcategory]
 * @returns {{ label: string, fields: Array }|null}
 */
export function getSchemaForCategory(category, subcategory = '') {
  const key = detectSchemaKey(category, subcategory);
  return key ? ATTRIBUTE_SCHEMAS[key] : null;
}

// ============================================================
// UI helpers
// ============================================================

/** Minimal HTML-escape for rendering user-supplied values into HTML. */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders attribute input fields into `container`.
 *
 * @param {HTMLElement} container   - Target element (cleared then populated)
 * @param {{ label: string, fields: Array }|null} schema
 * @param {Object} [attrs]          - Existing attribute values (from JSON)
 */
export function renderAttributeFields(container, schema, attrs = {}) {
  if (!container) return;
  if (!schema) { container.innerHTML = ''; return; }

  let html = '';
  for (const field of schema.fields) {
    const value   = attrs[field.key] ?? '';
    const inputId = `attr-${field.key}`;
    const labelText = field.unit
      ? `${field.label} <span class="attr-unit">(${field.unit})</span>`
      : field.label;

    html += `<div class="form-group">
      <label for="${inputId}">${labelText}</label>`;

    if (field.type === 'select') {
      html += `<select id="${inputId}" data-attr-key="${field.key}">`;
      for (const opt of (field.options || [])) {
        const selected = opt === String(value) ? ' selected' : '';
        html += `<option value="${esc(opt)}"${selected}>${opt || '—'}</option>`;
      }
      html += `</select>`;
    } else {
      const inputType = field.type === 'number' ? 'number' : 'text';
      html += `<input
        type="${inputType}"
        id="${inputId}"
        data-attr-key="${field.key}"
        value="${esc(String(value))}"
        ${field.type === 'number' ? 'step="any" min="0"' : ''}
        placeholder="${esc(field.placeholder || '')}" />`;
    }

    html += `</div>`;
  }
  container.innerHTML = html;
}

/**
 * Walks the rendered attribute inputs inside `container` and
 * returns a plain object with non-empty values.
 *
 * @param {HTMLElement} container
 * @returns {Object}
 */
export function collectAttributeValues(container) {
  const attrs = {};
  if (!container) return attrs;
  container.querySelectorAll('[data-attr-key]').forEach(el => {
    const key = el.dataset.attrKey;
    const val = el.value.trim();
    if (val !== '') {
      attrs[key] = el.type === 'number' && val !== ''
        ? (isNaN(parseFloat(val)) ? val : parseFloat(val))
        : val;
    }
  });
  return attrs;
}
