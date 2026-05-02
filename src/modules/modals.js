import {
  state, addComponent, updateComponent, deleteComponent,
  showToast, refreshDatalistsGlobal
} from '../app.js';
import { initSortHeaders } from './table.js';
import { lookupComponent, categorizeByDescription } from './hardcoded_datasheet.js';
import { readFile, copyFile, mkdir } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { t } from './i18n.js';
import { rankCandidates } from './fuzzy_search.js';
import { UNCATEGORIZED_CATEGORY } from './constants.js';

// ============================================================
// Curated category -> subcategories map
// Drives the subcategory datalist so users no longer see NPN/PNP
// suggestions when they have selected "Resistors", etc.
// ============================================================
// Canonical taxonomy. Keep ONE name per main category (English plural).
// Locale labels are display-only via i18n; the underlying value stored in
// the DB stays in English so import/export and grouping stay stable.
const CATEGORY_SUBCATEGORIES = {
  'Resistors':      ['Carbon Film', 'Metal Film', 'Wirewound', 'SMD', 'Through-Hole', 'Thick Film', 'Thin Film', 'Power', 'Precision'],
  'Potentiometers': ['Trimpot', 'Linear', 'Logarithmic', 'Multi-turn', 'Single-turn'],
  'Thermistors':    ['NTC', 'PTC'],
  'Varistors':      ['MOV', 'SIOV'],
  'Capacitors':     ['Electrolytic', 'Ceramic', 'Tantalum', 'Film', 'Polymer', 'Supercapacitor', 'MLCC', 'SMD'],
  'Inductors':      ['Inductor', 'Ferrite Core', 'Toroid Core', 'Common Mode Choke', 'Power', 'SMD'],
  'Transformers':   ['Step-Up', 'Step-Down', 'Isolation', 'Audio', 'Toroidal'],

  // Transistors: subcategory captures BJT/MOSFET/JFET/IGBT/Darlington
  // PLUS the user's HV (high voltage) / HC (high current) / HF (high
  // frequency) / GP (general purpose) shelves so a single physical box
  // maps to one subcategory.
  'Transistors':    [
    'BJT NPN - General Purpose', 'BJT NPN - HV', 'BJT NPN - HC', 'BJT NPN - HF',
    'BJT PNP - General Purpose', 'BJT PNP - HV', 'BJT PNP - HC', 'BJT PNP - HF',
    'MOSFET N-Channel', 'MOSFET N-Channel - HV', 'MOSFET N-Channel - HC', 'MOSFET N-Channel - Logic-Level',
    'MOSFET P-Channel', 'MOSFET P-Channel - HV', 'MOSFET P-Channel - HC',
    'IGBT', 'JFET',
    'Darlington NPN', 'Darlington PNP',
  ],

  'Thyristors':     ['SCR', 'TRIAC', 'DIAC'],

  // Diodes: a flat list with the most common types only. Standalone LEDs
  // get their own main category for clarity.
  'Diodes':         ['Rectifier', 'Schottky', 'Zener', 'TVS', 'Fast Recovery', 'Bridge Rectifier'],
  'LEDs':           ['Indicator', 'High-Power', 'RGB', 'Addressable', 'IR', 'UV', 'Laser'],

  // ICs: collapsed to functional purpose. Voltage regulator family is one
  // group instead of three (LDO/Linear/Switching). Microcontrollers stay
  // as a top-level category so flashing-tools and pinouts are easy to pick.
  'ICs':            [
    'Op-Amp', 'Comparator', 'Timer',
    'Voltage Regulator', 'Switching Regulator', 'Gate Driver', 'Motor Driver',
    'PWM Controller', 'Optocoupler', 'Logic Gate', 'Shift Register',
    'LED Driver', 'RS-232 Driver', 'RS-485 Transceiver', 'CAN Transceiver',
    'WiFi / BT SoC', 'RF Transceiver', 'Audio Amplifier', 'ADC', 'DAC',
    'EEPROM / Flash', 'Real-Time Clock',
  ],
  'Microcontrollers': ['STM32 (ARM Cortex-M)', 'AVR (Atmel)', 'PIC', 'ESP32 / ESP8266', 'MSP430', 'RP2040 (Pi Pico)', '8051'],

  'Sensors':        [
    'Temperature', 'Humidity', 'Pressure', 'Hall Effect',
    'Current', 'Accelerometer', 'Gyroscope', 'IMU',
    'Proximity', 'Distance / ToF', 'Ultrasonic', 'PIR (Motion)',
    'Light / Color', 'Gas', 'Force / Strain',
  ],
  'Relays':         ['SPST', 'SPDT', 'DPDT', 'Solid State', 'Reed'],
  'Connectors':     ['Pin Header', 'Socket', 'Terminal Block', 'IC Socket', 'JST', 'Molex', 'USB', 'RJ45', 'D-Sub', 'DC Jack', 'XT60 / XT30'],
  'Crystals':       ['Crystal', 'Oscillator (XO)', 'TCXO', 'Resonator'],
  'Mechanical':     ['Heat Sink', 'Standoff', 'Screw / Nut', 'Fan', 'Cable / Wire'],
  'Switches':       ['Tactile', 'Slide', 'Toggle', 'Rotary', 'DIP', 'Rocker', 'Limit'],
  'Consumables':    ['Solder', 'Flux', 'Heat Shrink', 'Insulating Tape', 'Cleaner'],
  'Modules':        ['Power Supply', 'Sensor Board', 'Display', 'RF / Wireless', 'Motor Driver', 'Development Board'],
};

/**
 * Aliases that should be rewritten to canonical category names. Used by both
 * the live form (auto-rewrite while typing) and the bulk auto-categorize
 * normalisation pass. Keys are lowercased and stripped of trailing punctuation.
 */
const CATEGORY_ALIASES = {
  // English variants
  'diode':            'Diodes',
  'ic':               'ICs',
  'integrated circuit':'ICs',
  'mosfet':           'Transistors',
  'mosfets':          'Transistors',
  'bjt':              'Transistors',
  'bjts':             'Transistors',
  'transistor':       'Transistors',
  'igbt':             'Transistors',
  'igbts':            'Transistors',
  'resistor':         'Resistors',
  'capacitor':        'Capacitors',
  'cap':              'Capacitors',
  'inductor':         'Inductors',
  'connector':        'Connectors',
  'sensor':           'Sensors',
  'crystal':          'Crystals',
  'oscillator':       'Crystals',
  'relay':            'Relays',
  'led':              'LEDs',
  'leds':             'LEDs',
  'microcontroller':  'Microcontrollers',
  'mcu':              'Microcontrollers',
  'mcus':             'Microcontrollers',
  'switch':           'Switches',
  'module':           'Modules',
  // Turkish variants
  'diyot':            'Diodes',
  'diyotlar':         'Diodes',
  'direnc':           'Resistors',
  'direncler':        'Resistors',
  'kondansator':      'Capacitors',
  'kondansatorler':   'Capacitors',
  'bobin':            'Inductors',
  'bobinler':         'Inductors',
  'transistorler':    'Transistors',
  'sensorler':        'Sensors',
  'roleler':          'Relays',
  'role':             'Relays',
  'konektor':         'Connectors',
  'konektorler':      'Connectors',
  'mikrodenetleyici': 'Microcontrollers',
  'mikrodenetleyiciler':'Microcontrollers',
};

/**
 * Normalise an arbitrary category string to the canonical form used by the
 * taxonomy (e.g. "diode" -> "Diodes"). Returns the input unchanged when no
 * alias matches and the category is not in the canonical set; this keeps
 * truly user-defined categories intact.
 */
export function normaliseCategory(input) {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  if (CATEGORY_SUBCATEGORIES[raw]) return raw; // already canonical
  const key = raw.toLocaleLowerCase('tr-TR').replace(/[\s\-_/.]+$/, '');
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  // Try plural/singular fold (drop trailing s)
  const folded = key.endsWith('s') ? key.slice(0, -1) : key + 's';
  if (CATEGORY_ALIASES[folded]) return CATEGORY_ALIASES[folded];
  // Case-insensitive match against canonical keys
  const canon = Object.keys(CATEGORY_SUBCATEGORIES)
    .find(k => k.toLocaleLowerCase('tr-TR') === key);
  return canon || raw;
}

export const CANONICAL_CATEGORIES = Object.keys(CATEGORY_SUBCATEGORIES);

/**
 * Resolve subcategory candidates for the given category.
 * Falls back to all known subcategories when the category does not match.
 */
function getSubcategoryCandidatesFor(category) {
  const cat = (category || '').trim();
  if (!cat) return getAllSubcategories();

  // Exact match
  if (CATEGORY_SUBCATEGORIES[cat]) {
    return mergeWithUserData(cat, CATEGORY_SUBCATEGORIES[cat]);
  }
  // Case-insensitive match
  const key = Object.keys(CATEGORY_SUBCATEGORIES)
    .find(k => k.toLocaleLowerCase('tr-TR') === cat.toLocaleLowerCase('tr-TR'));
  if (key) return mergeWithUserData(key, CATEGORY_SUBCATEGORIES[key]);

  // Prefix family match (e.g. "Resistors - precision" -> "Resistors")
  for (const k of Object.keys(CATEGORY_SUBCATEGORIES)) {
    if (cat.toLocaleLowerCase('tr-TR').startsWith(k.toLocaleLowerCase('tr-TR'))) {
      return mergeWithUserData(k, CATEGORY_SUBCATEGORIES[k]);
    }
  }
  return getAllSubcategories();
}

function mergeWithUserData(category, curated) {
  const userSubs = state.components
    .filter(c => (c.category || '').toLocaleLowerCase('tr-TR') === category.toLocaleLowerCase('tr-TR'))
    .map(c => c.subcategory)
    .filter(Boolean);
  const set = new Set(curated);
  for (const u of userSubs) set.add(u);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr-TR', { sensitivity: 'base' }));
}

function getAllSubcategories() {
  const set = new Set();
  for (const arr of Object.values(CATEGORY_SUBCATEGORIES)) {
    for (const s of arr) set.add(s);
  }
  for (const c of state.components) {
    if (c.subcategory) set.add(c.subcategory);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr-TR', { sensitivity: 'base' }));
}

/** Repopulate the subcategory datalist scoped to the current category value. */
function refreshSubcategoryList(category) {
  const dl = document.getElementById('list-subcategory');
  if (!dl) return;
  const candidates = getSubcategoryCandidatesFor(category);
  dl.innerHTML = candidates.map(v => `<option value="${escapeAttr(v)}">`).join('');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ============================================================
// Initialize all modal interactions
// ============================================================
export function initModals() {
  initSortHeaders();
  initAddButton();
  initEditForm();
  initDeleteConfirm();
  initDetailActions();
  initImagePicker();
  initBuiltinSearch();
}

// ============================================================
// Open the edit modal in "add" mode
// ============================================================
function initAddButton() {
  document.getElementById('btn-add').addEventListener('click', () => openEditModal(null));
  document.getElementById('btn-add-empty').addEventListener('click', () => openEditModal(null));

  const importEmpty = document.getElementById('btn-import-empty');
  if (importEmpty) {
    importEmpty.addEventListener('click', () => {
      document.getElementById('overlay-import').style.display = '';
    });
  }
}

// ============================================================
// Edit modal (Add / Edit)
// ============================================================
function openEditModal(comp) {
  const title  = document.getElementById('modal-edit-title');
  const idEl   = document.getElementById('edit-id');

  refreshDatalistsGlobal();

  // Reset DB hit banner
  const banner = document.getElementById('db-hit-banner');
  if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }

  if (comp) {
    title.textContent = t('edit.edit');
    idEl.value = comp.id;
    setField('edit-part-code',   comp.part_code);
    setField('edit-category',    comp.category);
    setField('edit-subcategory', comp.subcategory);
    setField('edit-quantity',    comp.quantity);
    setField('edit-package',     comp.package);
    setField('edit-manufacturer',comp.manufacturer);
    setField('edit-mpn',         comp.mpn);
    setField('edit-preferred-supplier', comp.preferred_supplier || '');
    setField('edit-location',    comp.location);
    setField('edit-voltage-max', comp.voltage_max ?? '');
    setField('edit-current-max', comp.current_max ?? '');
    setField('edit-unit-price',  comp.unit_price ?? '');
    setField('edit-description', comp.description);
    setField('edit-datasheet-url', comp.datasheet_url);
    setField('edit-notes',       comp.notes);
    setField('edit-resistance',  comp.resistance  || '');
    setField('edit-tolerance',   comp.tolerance   || '');
    setField('edit-power-rating',comp.power_rating ?? '');
    setImagePreview(comp.image_path || '');
    existingAttrs = parseAttrs(comp.attributes);
  } else {
    title.textContent = t('edit.add');
    idEl.value = '';
    document.getElementById('form-edit').reset();
    // Default qty placeholder reflects user setting (visible only when field is empty)
    const qtyEl = document.getElementById('edit-quantity');
    if (qtyEl) {
      const def = parseInt(localStorage.getItem('defaultQty') || '1', 10);
      qtyEl.placeholder = isNaN(def) ? '1' : String(def);
      qtyEl.value = '';
    }
    setImagePreview('');
  }

  // Refresh subcategory candidates against the current category value
  refreshSubcategoryList(document.getElementById('edit-category').value);
  updateTypeFields(document.getElementById('edit-category').value);
  document.getElementById('overlay-edit').style.display = '';
  setTimeout(() => document.getElementById('edit-part-code').focus(), 60);
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

/** Safely parse the JSON attributes string stored in the database. */
function parseAttrs(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (_) { return {}; }
}

// ============================================================
// Type-specific field visibility + smart description
// ============================================================
const CAT_TYPE = {
  resistor:   ['Resistors', 'Potentiometers', 'Thermistors', 'Varistors'],
  capacitor:  ['Capacitors'],
  inductor:   ['Inductors', 'Transformers', 'Coils'],
  transistor: ['Transistors', 'MOSFETs', 'IGBTs', 'Thyristors'],
  diode:      ['Diodes'],
  ic:         ['ICs', 'Microcontrollers', 'Sensors', 'Relays', 'Optocouplers'],
};

function detectType(category) {
  const cat = (category || '').toLowerCase();
  if (['resistors','potentiometers','thermistors','varistors'].some(k => cat.includes(k.slice(0,6)))) return 'resistor';
  if (cat.includes('capacitor')) return 'capacitor';
  if (cat.includes('inductor') || cat.includes('transformer') || cat.includes('coil')) return 'inductor';
  if (cat.includes('transistor') || cat.includes('mosfet') || cat.includes('igbt') || cat.includes('thyristor')) return 'transistor';
  if (cat.includes('diode')) return 'diode';
  return 'generic';
}

function updateTypeFields(category) {
  const type = detectType(category);

  const showR = type === 'resistor';
  const showT = showR || type === 'capacitor' || type === 'inductor';
  const showP = showR;
  const showV = !showR;
  const showI = !showR && type !== 'capacitor';

  const setVis = (sel, show) =>
    document.querySelectorAll(sel).forEach(el => { el.style.display = show ? '' : 'none'; });

  setVis('.type-field-resistance', showR);
  setVis('.type-field-tolerance',  showT);
  setVis('.type-field-power',      showP);
  setVis('.type-field-voltage',    showV);
  setVis('.type-field-current',    showI);

  // Update contextual labels
  const lblV = document.getElementById('lbl-voltage-max');
  const lblI = document.getElementById('lbl-current-max');
  if (lblV) lblV.textContent = type === 'capacitor' ? t('edit.vmax.cap') : t('edit.vmax');
  if (lblI) lblI.textContent = type === 'transistor' ? t('edit.imax.fet') : t('edit.imax');
}

/**
 * Renders (or hides) the "Advanced Parameters" section based on
 * the selected category and subcategory. Preserves existing
 * attribute values passed via `attrs`.
 *
 * @param {string} category
 * @param {string} [subcategory]
 * @param {Object} [attrs]  - existing attribute values (from DB)
 */
function updateAttributeFields(category, subcategory = '', attrs = {}) {
  const section   = document.getElementById('attr-fields-section');
  const container = document.getElementById('attr-fields-container');
  const titleEl   = document.getElementById('attr-fields-title');
  if (!section || !container) return;

  const schema = getSchemaForCategory(category, subcategory);
  if (schema) {
    titleEl.textContent = schema.label;
    renderAttributeFields(container, schema, attrs);
    section.style.display = '';
  } else {
    section.style.display = 'none';
    container.innerHTML = '';
  }
}

/** Builds a description string from the form fields based on component type. */
function buildAutoDescription() {
  const cat  = document.getElementById('edit-category').value.trim();
  const sub  = document.getElementById('edit-subcategory').value.trim();
  const type = detectType(cat);

  const res   = document.getElementById('edit-resistance')?.value.trim();
  const tol   = document.getElementById('edit-tolerance')?.value.trim();
  const pwr   = document.getElementById('edit-power-rating')?.value.trim();
  const vmax  = document.getElementById('edit-voltage-max')?.value.trim();
  const imax  = document.getElementById('edit-current-max')?.value.trim();

  const parts = [];

  if (type === 'resistor') {
    if (res)  parts.push(res.match(/[a-zA-Z]/) ? res : res + '\u03A9');  // add Ω if no unit
    if (tol)  parts.push(tol.endsWith('%') ? tol : tol + '%');
    if (pwr)  parts.push(pwr + 'W');
    parts.push(sub || 'Resistor');
  } else if (type === 'capacitor') {
    if (res)  parts.push(res);  // capacitance can be stored in resistance field for caps
    if (vmax) parts.push(vmax + 'V');
    if (tol)  parts.push(tol);
    parts.push(sub || 'Capacitor');
  } else if (type === 'inductor') {
    if (res)  parts.push(res);
    if (imax) parts.push(imax + 'A');
    if (tol)  parts.push(tol);
    parts.push(sub || 'Inductor');
  } else if (type === 'transistor') {
    if (sub && (sub.toLowerCase().includes('npn') || sub.toLowerCase().includes('pnp'))) {
      parts.push(sub);
    } else {
      const chan = sub.toLowerCase().includes('p-ch') ? 'P-Ch' : 'N-Ch';
      parts.push(chan, sub || 'MOSFET');
    }
    if (vmax) parts.push(vmax + 'V');
    if (imax) parts.push(imax + 'A');
  } else if (type === 'diode') {
    parts.push(sub || 'Diode');
    if (vmax) parts.push(vmax + 'V');
    if (imax) parts.push(imax + 'A');
  } else {
    parts.push(sub || cat);
    if (vmax) parts.push(vmax + 'V');
    if (imax) parts.push(imax + 'A');
  }

  return parts.filter(Boolean).join(' ');
}

function initEditForm() {
  // Listen for custom event from table.js
  document.addEventListener('open-edit', e => openEditModal(e.detail));

  const saveBtn = document.getElementById('btn-save-component');
  saveBtn.addEventListener('click', async () => {
    await handleSave();
  });

  document.getElementById('form-edit').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleSave();
    }
  });

  // Auto-clear canonical uncategorized value on focus; restore on blur if empty
  const catInput = document.getElementById('edit-category');
  catInput?.addEventListener('focus', function() {
    if (this.value === UNCATEGORIZED_CATEGORY) this.value = '';
  });
  catInput?.addEventListener('blur', function() {
    if (!this.value.trim()) this.value = UNCATEGORIZED_CATEGORY;
  });

  // Dynamic type fields and subcategory list when category changes
  catInput?.addEventListener('input', function() {
    const sub = document.getElementById('edit-subcategory')?.value || '';
    updateTypeFields(this.value);
    refreshSubcategoryList(this.value);
  });

  // Smart subcategory autocorrect: on blur, snap to closest curated value
  // when the user typed a near-miss (e.g. "BJT NP" -> "BJT NPN").
  const subInput = document.getElementById('edit-subcategory');
  subInput?.addEventListener('blur', function() {
    const cur = this.value.trim();
    if (!cur) return;
    const candidates = getSubcategoryCandidatesFor(catInput.value);
    if (candidates.includes(cur)) return;
    const ranked = rankCandidates(cur, candidates, 1);
    if (ranked.length > 0 && ranked[0].score < 1.5) {
      this.value = ranked[0].value;
    }
  });

  // Live DB hit banner: as the user types a part code, show a hint when it
  // matches a built-in database entry so they know Lookup DB will succeed.
  const pcInput = document.getElementById('edit-part-code');
  const banner  = document.getElementById('db-hit-banner');
  pcInput?.addEventListener('input', () => {
    if (!banner) return;
    const code = pcInput.value.trim();
    if (!code) { banner.style.display = 'none'; return; }
    const hit = lookupComponent(code);
    if (hit) {
      banner.style.display = '';
      banner.innerHTML =
        `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>` +
        `<span><strong>${escapeAttr(code)}</strong> &mdash; ${escapeAttr(hit.description || hit.category || '')}</span>`;
    } else {
      banner.style.display = 'none';
    }
  });

  // Auto-fill: use Description text to suggest Category + Subcategory
  document.getElementById('btn-auto-desc')?.addEventListener('click', () => {
    const desc = document.getElementById('edit-description').value.trim();
    if (!desc) {
      showToast(t('toast.descRequired'), 'warning');
      return;
    }
    const result = categorizeByDescription(desc);
    if (!result) {
      showToast(t('toast.noMatch'), 'info');
      return;
    }
    const catEl = document.getElementById('edit-category');
    const subEl = document.getElementById('edit-subcategory');
    if (result.category) {
      catEl.value = result.category;
      updateTypeFields(result.category);
      refreshSubcategoryList(result.category);
    }
    if (result.subcategory) { subEl.value = result.subcategory; }
    showToast(t('toast.descSet', { cat: result.category }), 'success');
  });

  // Hardcoded DB lookup button (now in modal-body, no scrolling needed).
  // Fills only EMPTY fields (never overwrites user input).
  document.getElementById('btn-db-lookup').addEventListener('click', () => {
    const partCode = document.getElementById('edit-part-code').value.trim();
    if (!partCode) {
      showToast(t('toast.partCodeFirst'), 'warning');
      return;
    }
    const data = lookupComponent(partCode);
    if (!data) {
      showToast(t('toast.notInDb', { code: partCode }), 'info');
      return;
    }

    // Map DB fields -> input ids; null/undefined and "Uncategorized" are skipped.
    const mappings = [
      { id: 'edit-category',      v: data.category,      treatUncatAsEmpty: true },
      { id: 'edit-subcategory',   v: data.subcategory },
      { id: 'edit-package',       v: data.package },
      { id: 'edit-manufacturer',  v: data.manufacturer },
      { id: 'edit-mpn',           v: data.mpn },
      { id: 'edit-preferred-supplier', v: data.preferred_supplier },
      { id: 'edit-description',   v: data.description },
      { id: 'edit-datasheet-url', v: data.datasheet_url },
      { id: 'edit-voltage-max',   v: data.voltage_max },
      { id: 'edit-current-max',   v: data.current_max },
      { id: 'edit-resistance',    v: data.resistance },
      { id: 'edit-tolerance',     v: data.tolerance },
      { id: 'edit-power-rating',  v: data.power_rating },
      { id: 'edit-notes',         v: data.notes },
    ];

    let filled = 0;
    for (const m of mappings) {
      const el = document.getElementById(m.id);
      if (!el || m.v == null || m.v === '') continue;
      const cur = (el.value || '').trim();
      const empty = !cur || (m.treatUncatAsEmpty && cur === UNCATEGORIZED_CATEGORY);
      if (empty) { setField(m.id, m.v); filled++; }
    }

    refreshSubcategoryList(document.getElementById('edit-category').value);
    updateTypeFields(document.getElementById('edit-category').value);

    if (filled > 0) {
      showToast(t('toast.dbApplied', { code: partCode }) + ' (' + filled + ')', 'success');
    } else {
      showToast(t('toast.dbApplied', { code: partCode }), 'info');
    }
  });
}

// Safely parse a numeric input — returns null when empty, preserves 0
function parseOptFloat(id) {
  const v = document.getElementById(id).value.trim();
  if (v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

async function handleSave() {
  const idVal     = document.getElementById('edit-id').value;
  const partCode  = document.getElementById('edit-part-code').value.trim();

  if (!partCode) {
    showToast(t('toast.partCodeRequired'), 'error');
    return;
  }

  // Resolve default quantity when the field is empty.
  // Settings can override; falls back to 1 (never 0) so a freshly added
  // component is never mistakenly treated as out-of-stock.
  const qtyRaw = document.getElementById('edit-quantity').value;
  const defaultQty = parseInt(localStorage.getItem('defaultQty') || '1', 10);
  const quantity = qtyRaw === ''
    ? (isNaN(defaultQty) ? 1 : defaultQty)
    : (parseInt(qtyRaw, 10) || 0);

  const data = {
    part_code:    partCode,
    category:     normaliseCategory(document.getElementById('edit-category').value),
    subcategory:  document.getElementById('edit-subcategory').value.trim(),
    quantity,
    package:      document.getElementById('edit-package').value.trim(),
    manufacturer: document.getElementById('edit-manufacturer').value.trim(),
    mpn:          document.getElementById('edit-mpn').value.trim(),
    preferred_supplier: document.getElementById('edit-preferred-supplier').value.trim(),
    location:     document.getElementById('edit-location').value.trim(),
    voltage_max:  parseOptFloat('edit-voltage-max'),
    current_max:  parseOptFloat('edit-current-max'),
    description:  document.getElementById('edit-description').value.trim(),
    datasheet_url:document.getElementById('edit-datasheet-url').value.trim(),
    unit_price:   parseOptFloat('edit-unit-price'),
    notes:        document.getElementById('edit-notes').value.trim(),
    image_path:   document.getElementById('edit-image-path').value.trim(),
    resistance:   document.getElementById('edit-resistance')?.value.trim() || '',
    tolerance:    document.getElementById('edit-tolerance')?.value.trim()  || '',
    power_rating: parseOptFloat('edit-power-rating'),
    attributes:   collectAttributeValues(document.getElementById('attr-fields-container')),
  };

  const saveBtn = document.getElementById('btn-save-component');
  saveBtn.disabled = true;

  try {
    if (idVal) {
      await updateComponent(Number(idVal), data);
      showToast(t('toast.componentUpdated'), 'success');
    } else {
      await addComponent(data);
      showToast(t('toast.componentAdded'), 'success');
    }
    document.getElementById('overlay-edit').style.display = 'none';
  } catch (err) {
    showToast(t('toast.saveFailed') + (err.message || err), 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// ============================================================
// Image attachment helpers
// ============================================================
let _previewObjectUrl = null;

async function setImagePreview(imagePath) {
  const pathInput  = document.getElementById('edit-image-path');
  const preview    = document.getElementById('image-preview');
  const clearBtn   = document.getElementById('btn-clear-image');
  const placeholder = document.getElementById('image-preview-wrap').querySelector('svg');

  // Revoke previous object URL before creating a new one
  if (_previewObjectUrl) {
    URL.revokeObjectURL(_previewObjectUrl);
    _previewObjectUrl = null;
  }

  pathInput.value = imagePath;

  if (imagePath) {
    try {
      const bytes = await readFile(imagePath);
      const ext   = imagePath.split('.').pop().toLowerCase();
      const mime  = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png';
      const blob  = new Blob([bytes], { type: mime });
      _previewObjectUrl = URL.createObjectURL(blob);
      preview.src           = _previewObjectUrl;
      preview.style.display = '';
      if (placeholder) placeholder.style.display = 'none';
      clearBtn.style.display = '';
    } catch (_) {
      // File temporarily inaccessible — hide preview but preserve stored path
      preview.src           = '';
      preview.style.display = 'none';
      if (placeholder) placeholder.style.display = '';
      clearBtn.style.display = 'none';
    }
  } else {
    preview.src           = '';
    preview.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
    clearBtn.style.display = 'none';
  }
}

function initImagePicker() {
  document.getElementById('btn-pick-image').addEventListener('click', async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters:  [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      });
      if (!selected) return;

      const appDataDir = await invoke('get_app_data_dir');
      const imagesDir  = appDataDir + '/images';
      await mkdir(imagesDir, { recursive: true });

      const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      const ext        = (selected.split('.').pop() || '').toLowerCase();
      if (!allowedExt.includes(ext)) {
        showToast(t('toast.imageFmt'), 'error');
        return;
      }
      // Sanitize part code: keep only alphanumeric, dash, underscore (no path separators)
      const rawCode  = document.getElementById('edit-part-code').value.trim() || 'image';
      const partCode = rawCode.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
      const destPath = imagesDir + '/' + partCode + '_' + Date.now() + '.' + ext;

      await copyFile(selected, destPath);
      await setImagePreview(destPath);
    } catch (err) {
      showToast(t('toast.imageFailed') + (err.message || err), 'error');
    }
  });

  document.getElementById('btn-clear-image').addEventListener('click', () => setImagePreview(''));
}


// ============================================================
// Delete confirm
// ============================================================
let _deleteTargetId = null;

function initDeleteConfirm() {
  document.addEventListener('open-delete-confirm', e => {
    const comp = e.detail;
    _deleteTargetId = comp.id;
    document.getElementById('confirm-part-code').textContent = comp.part_code;
    document.getElementById('overlay-confirm').style.display = '';
  });

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if (_deleteTargetId === null) return;
    try {
      await deleteComponent(_deleteTargetId);
      showToast(t('toast.componentDeleted'), 'success');
      document.getElementById('overlay-confirm').style.display = 'none';
      document.getElementById('overlay-detail').style.display = 'none';
    } catch (err) {
      showToast(t('toast.deleteFailed') + (err.message || err), 'error');
    } finally {
      _deleteTargetId = null;
    }
  });
}

// ============================================================
// Detail modal actions
// ============================================================
function initDetailActions() {
  document.getElementById('btn-detail-edit').addEventListener('click', () => {
    const partCode = document.getElementById('detail-part-code').textContent;
    const comp = state.components.find(c => c.part_code === partCode);
    if (comp) {
      document.getElementById('overlay-detail').style.display = 'none';
      openEditModal(comp);
    }
  });

  document.getElementById('btn-detail-delete').addEventListener('click', () => {
    const partCode = document.getElementById('detail-part-code').textContent;
    const comp = state.components.find(c => c.part_code === partCode);
    if (comp) {
      document.getElementById('overlay-detail').style.display = 'none';
      document.dispatchEvent(new CustomEvent('open-delete-confirm', { detail: comp }));
    }
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('overlay-import').style.display = '';
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    document.getElementById('overlay-export').style.display = '';
  });

  document.getElementById('btn-backup-mgr').addEventListener('click', () => {
    document.getElementById('overlay-backup').style.display = '';
    document.dispatchEvent(new CustomEvent('backup-modal-opened'));
  });
}

// ============================================================
// Built-in Library Search (Auto-fill from patched.db)
// ============================================================
let _builtinDebounceTimer = null;

function initBuiltinSearch() {
  const input   = document.getElementById('builtin-search-input');
  const results  = document.getElementById('builtin-search-results');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    clearTimeout(_builtinDebounceTimer);
    const term = input.value.trim();

    if (term.length < 2) {
      results.style.display = 'none';
      results.innerHTML = '';
      return;
    }

    results.style.display = '';
    results.innerHTML = `<div class="builtin-dropdown-loading">${escHtmlLocal(t('builtin.searching'))}</div>`;

    _builtinDebounceTimer = setTimeout(async () => {
      try {
        const items = await invoke('search_builtin_library', { searchTerm: term });
        renderBuiltinResults(items, results);
      } catch (err) {
        results.innerHTML = `<div class="builtin-dropdown-empty">${escHtmlLocal(t('builtin.searchError', { err: String(err) }))}</div>`;
      }
    }, 300);
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.style.display = 'none';
    }
  });

  // Clear search field when the edit modal is opened fresh
  document.addEventListener('open-edit', () => {
    input.value = '';
    results.style.display = 'none';
    results.innerHTML = '';
  });
}

function renderBuiltinResults(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="builtin-dropdown-empty">${escHtmlLocal(t('builtin.noMatches'))}</div>`;
    return;
  }

  container.innerHTML = items.map((item, i) => {
    const desc = escHtmlLocal(item.description || '').slice(0, 80);
    const meta = [item.category, item.subcategory, item.package].filter(Boolean).join(' · ');
    return `<div class="builtin-dropdown-item" data-idx="${i}">
      <span class="builtin-part-code">${escHtmlLocal(item.part_code)}</span>
      <span class="builtin-desc">${desc}</span>
      <span class="builtin-meta">${escHtmlLocal(meta)}</span>
    </div>`;
  }).join('');

  // Attach click handlers
  container.querySelectorAll('.builtin-dropdown-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      applyBuiltinComponent(items[idx]);
      container.style.display = 'none';
      document.getElementById('builtin-search-input').value = '';
    });
  });
}

function applyBuiltinComponent(comp) {
  // Fill basic form fields
  if (comp.part_code)     setField('edit-part-code', comp.part_code);
  if (comp.category)      setField('edit-category', comp.category);
  if (comp.subcategory)   setField('edit-subcategory', comp.subcategory);
  if (comp.package)       setField('edit-package', comp.package);
  if (comp.manufacturer)  setField('edit-manufacturer', comp.manufacturer);
  if (comp.description)   setField('edit-description', comp.description);
  if (comp.datasheet_url) setField('edit-datasheet-url', comp.datasheet_url);

  // Trigger type-specific field visibility update
  const cat = comp.category || '';
  const sub = comp.subcategory || '';
  updateTypeFields(cat);

  // Parse attributes JSON and fill dynamic fields
  let attrs = {};
  try {
    attrs = typeof comp.attributes === 'string' ? JSON.parse(comp.attributes || '{}') : (comp.attributes || {});
  } catch (_) { /* ignore parse errors */ }

  // Render dynamic attribute fields and fill them with built-in library values
  updateAttributeFields(cat, sub, attrs);

  // Map well-known attribute keys to legacy form fields
  for (const [key, value] of Object.entries(attrs)) {
    const lk = key.toLowerCase();
    const strVal = String(value);

    if (lk.includes('voltage') || lk.includes('vdss') || lk.includes('vds'))  {
      setFieldIfEmpty('edit-voltage-max', parseNumericFromStr(strVal));
    } else if (lk.includes('current') && (lk.includes('drain') || lk.includes('id') || lk.includes('max') || lk.includes('rated'))) {
      setFieldIfEmpty('edit-current-max', parseNumericFromStr(strVal));
    } else if (lk.includes('resistance') || lk === 'rds_on' || lk.includes('rds(on)') || lk.includes('dcr')) {
      setFieldIfEmpty('edit-resistance', strVal);
    } else if (lk.includes('tolerance')) {
      setFieldIfEmpty('edit-tolerance', strVal);
    } else if (lk.includes('power') && (lk.includes('dissipation') || lk.includes('rating'))) {
      setFieldIfEmpty('edit-power-rating', parseNumericFromStr(strVal));
    }
  }

  showToast(t('builtin.applied', { code: comp.part_code }), 'success');
}

/** Set a field only if it's currently empty */
function setFieldIfEmpty(id, value) {
  const el = document.getElementById(id);
  if (el && !el.value && value != null && value !== '') {
    el.value = value;
  }
}

/** Extract leading numeric value from a string like "60V" or "83A" */
function parseNumericFromStr(str) {
  if (!str) return '';
  const m = str.match(/^\d+(\.\d+)?/);
  return m ? m[0] : str;
}

/** Minimal HTML escaping for dropdown rendering */
function escHtmlLocal(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
