import { state, escHtml, deleteComponents, showToast } from '../app.js';
import { lookupComponent, applyDbData }                 from './hardcoded_datasheet.js';
import { setLabelComponent }                             from './labels.js';
import { readFile }                                      from '@tauri-apps/plugin-fs';

// ============================================================
// Multi-select state
// ============================================================
const selectedIds = new Set();

function clearSelection() {
  selectedIds.clear();
  updateSelectionBar();
}

function updateSelectionBar() {
  const bar    = document.getElementById('selection-bar');
  const label  = document.getElementById('selection-count');
  const n      = selectedIds.size;
  if (!bar) return;
  bar.style.display = n > 0 ? 'flex' : 'none';
  if (label) label.textContent = `${n} component${n !== 1 ? 's' : ''} selected`;
  // Keep header checkbox in sync
  const headerCb = document.getElementById('cb-select-all');
  if (headerCb) {
    headerCb.checked = n > 0 && n === state.filtered.length;
    headerCb.indeterminate = n > 0 && n < state.filtered.length;
  }
}

function initSelectionBar() {
  const btnDel = document.getElementById('btn-sel-delete');
  const btnClr = document.getElementById('btn-sel-clear');
  if (btnDel) {
    btnDel.addEventListener('click', async () => {
      if (selectedIds.size === 0) return;
      const n = selectedIds.size;
      if (!confirm(`Delete ${n} selected component${n !== 1 ? 's' : ''}? This cannot be undone.`)) return;
      try {
        await deleteComponents(Array.from(selectedIds));
        clearSelection();
        showToast(`Deleted ${n} component${n !== 1 ? 's' : ''}`, 'success');
      } catch (err) {
        showToast('Delete failed: ' + (err.message || err), 'error');
      }
    });
  }
  if (btnClr) btnClr.addEventListener('click', clearSelection);
}

// ============================================================
// Category-specific column configuration
// ============================================================
// Columns: { key, label, numeric, width, render(c) }
const COL_ACTIONS = { key:'_actions', label:'Actions', width:'col-actions', render: () => '' };
const COL_CB      = { key:'_cb',      label:'',        width:'col-cb',      render: () => '' };

const DEFAULT_COLS = [
  { key:'part_code',   label:'Part Code',    sort:'part_code',   width:'col-pc',  render: c => `<span class="td-truncate mono" style="font-size:12px;font-weight:500" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span>` },
  { key:'category',    label:'Category',     sort:'category',    width:'col-cat', render: c => c.category ? `<span class="badge badge-cat">${escHtml(c.category)}</span>` : '' },
  { key:'subcategory', label:'Subcategory',  sort:'subcategory', width:'col-sub', render: c => c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : '' },
  { key:'quantity',    label:'Qty',          sort:'quantity',    width:'num col-qty', render: c => { const q=Number(c.quantity)||0; return `<span class="${q<=1?'qty-badge low':'qty-badge'}">${q}</span>`; } },
  { key:'voltage_max', label:'V Max',        sort:'voltage_max', width:'num col-vmax', render: c => c.voltage_max != null ? `<span class="mono" style="font-size:11px">${c.voltage_max}V</span>` : '' },
  { key:'current_max', label:'I Max',        sort:'current_max', width:'num col-imax', render: c => c.current_max != null ? `<span class="mono" style="font-size:11px">${c.current_max}A</span>` : '' },
  { key:'description', label:'Description',  sort:'description', width:'col-desc', render: c => `<span class="td-truncate" style="font-size:12px;color:var(--text-secondary)" title="${escHtml(c.description)}">${escHtml(c.description)}</span>` },
];

const CATEGORY_COL_OVERRIDES = {
  'Transistors': [
    { key:'part_code',   label:'Part Code',  sort:'part_code',   width:'col-pc',   render: c => `<span class="td-truncate mono" style="font-size:12px;font-weight:500" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span>` },
    { key:'subcategory', label:'Type',       sort:'subcategory', width:'col-sub',   render: c => c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : '' },
    { key:'quantity',    label:'Qty',        sort:'quantity',    width:'num col-qty', render: c => { const q=Number(c.quantity)||0; return `<span class="${q<=1?'qty-badge low':'qty-badge'}">${q}</span>`; } },
    { key:'voltage_max', label:'V\u2090\u209B / V\u2090\u2091', sort:'voltage_max', width:'num col-vmax', render: c => c.voltage_max != null ? `<span class="mono" style="font-size:11px">${c.voltage_max}V</span>` : '' },
    { key:'current_max', label:'I\u2089 / I\u2090', sort:'current_max', width:'num col-imax', render: c => c.current_max != null ? `<span class="mono" style="font-size:11px">${c.current_max}A</span>` : '' },
    { key:'package',     label:'Package',    sort:'package',     width:'col-pkg',   render: c => `<span class="td-truncate mono" style="font-size:11px">${escHtml(c.package)}</span>` },
    { key:'manufacturer',label:'Mfr',        sort:'manufacturer',width:'col-mfr',   render: c => `<span class="td-truncate" style="font-size:12px">${escHtml(c.manufacturer)}</span>` },
    { key:'description', label:'Description',sort:'description', width:'col-desc',  render: c => `<span class="td-truncate" style="font-size:12px;color:var(--text-secondary)" title="${escHtml(c.description)}">${escHtml(c.description)}</span>` },
  ],
  'Diodes': [
    { key:'part_code',   label:'Part Code',  sort:'part_code',   width:'col-pc',   render: c => `<span class="td-truncate mono" style="font-size:12px;font-weight:500" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span>` },
    { key:'subcategory', label:'Type',       sort:'subcategory', width:'col-sub',   render: c => c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : '' },
    { key:'quantity',    label:'Qty',        sort:'quantity',    width:'num col-qty', render: c => { const q=Number(c.quantity)||0; return `<span class="${q<=1?'qty-badge low':'qty-badge'}">${q}</span>`; } },
    { key:'voltage_max', label:'V\u1D3F (V)', sort:'voltage_max', width:'num col-vmax', render: c => c.voltage_max != null ? `<span class="mono" style="font-size:11px">${c.voltage_max}V</span>` : '' },
    { key:'current_max', label:'I\u1DA0 (A)', sort:'current_max', width:'num col-imax', render: c => c.current_max != null ? `<span class="mono" style="font-size:11px">${c.current_max}A</span>` : '' },
    { key:'package',     label:'Package',    sort:'package',     width:'col-pkg',   render: c => `<span class="td-truncate mono" style="font-size:11px">${escHtml(c.package)}</span>` },
    { key:'description', label:'Description',sort:'description', width:'col-desc',  render: c => `<span class="td-truncate" style="font-size:12px;color:var(--text-secondary)" title="${escHtml(c.description)}">${escHtml(c.description)}</span>` },
  ],
  'Resistors': [
    { key:'part_code',   label:'Part Code',  sort:'part_code',   width:'col-pc',   render: c => `<span class="td-truncate mono" style="font-size:12px;font-weight:500" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span>` },
    { key:'subcategory', label:'Type',       sort:'subcategory', width:'col-sub',   render: c => c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : '' },
    { key:'quantity',    label:'Qty',        sort:'quantity',    width:'num col-qty', render: c => { const q=Number(c.quantity)||0; return `<span class="${q<=1?'qty-badge low':'qty-badge'}">${q}</span>`; } },
    { key:'resistance',  label:'Resistance', sort:'resistance',  width:'col-pkg',   render: c => c.resistance ? `<span class="mono" style="font-size:11px">${escHtml(c.resistance)}</span>` : '' },
    { key:'tolerance',   label:'Tolerance',  sort:'tolerance',   width:'col-pkg',   render: c => c.tolerance  ? `<span class="mono" style="font-size:11px">${escHtml(c.tolerance)}</span>` : '' },
    { key:'power_rating',label:'Power (W)',  sort:'power_rating',width:'num col-vmax', render: c => c.power_rating != null ? `<span class="mono" style="font-size:11px">${c.power_rating}W</span>` : '' },
    { key:'package',     label:'Package',    sort:'package',     width:'col-pkg',   render: c => `<span class="td-truncate mono" style="font-size:11px">${escHtml(c.package)}</span>` },
    { key:'description', label:'Description',sort:'description', width:'col-desc',  render: c => `<span class="td-truncate" style="font-size:12px;color:var(--text-secondary)" title="${escHtml(c.description)}">${escHtml(c.description)}</span>` },
  ],
  'Capacitors': [
    { key:'part_code',   label:'Part Code',  sort:'part_code',   width:'col-pc',   render: c => `<span class="td-truncate mono" style="font-size:12px;font-weight:500" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span>` },
    { key:'subcategory', label:'Type',       sort:'subcategory', width:'col-sub',   render: c => c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : '' },
    { key:'quantity',    label:'Qty',        sort:'quantity',    width:'num col-qty', render: c => { const q=Number(c.quantity)||0; return `<span class="${q<=1?'qty-badge low':'qty-badge'}">${q}</span>`; } },
    { key:'resistance',  label:'Capacitance',sort:'resistance',  width:'col-pkg',   render: c => c.resistance ? `<span class="mono" style="font-size:11px">${escHtml(c.resistance)}</span>` : '' },
    { key:'tolerance',   label:'Tolerance',  sort:'tolerance',   width:'col-pkg',   render: c => c.tolerance  ? `<span class="mono" style="font-size:11px">${escHtml(c.tolerance)}</span>` : '' },
    { key:'voltage_max', label:'Rated V',    sort:'voltage_max', width:'num col-vmax', render: c => c.voltage_max != null ? `<span class="mono" style="font-size:11px">${c.voltage_max}V</span>` : '' },
    { key:'package',     label:'Package',    sort:'package',     width:'col-pkg',   render: c => `<span class="td-truncate mono" style="font-size:11px">${escHtml(c.package)}</span>` },
    { key:'description', label:'Description',sort:'description', width:'col-desc',  render: c => `<span class="td-truncate" style="font-size:12px;color:var(--text-secondary)" title="${escHtml(c.description)}">${escHtml(c.description)}</span>` },
  ],
  'Thyristors': [
    { key:'part_code',   label:'Part Code',  sort:'part_code',   width:'col-pc',   render: c => `<span class="td-truncate mono" style="font-size:12px;font-weight:500" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span>` },
    { key:'subcategory', label:'Type',       sort:'subcategory', width:'col-sub',   render: c => c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : '' },
    { key:'quantity',    label:'Qty',        sort:'quantity',    width:'num col-qty', render: c => { const q=Number(c.quantity)||0; return `<span class="${q<=1?'qty-badge low':'qty-badge'}">${q}</span>`; } },
    { key:'voltage_max', label:'V\u1D3F (V)', sort:'voltage_max', width:'num col-vmax', render: c => c.voltage_max != null ? `<span class="mono" style="font-size:11px">${c.voltage_max}V</span>` : '' },
    { key:'current_max', label:'I\u1DA0 (A)', sort:'current_max', width:'num col-imax', render: c => c.current_max != null ? `<span class="mono" style="font-size:11px">${c.current_max}A</span>` : '' },
    { key:'package',     label:'Package',    sort:'package',     width:'col-pkg',   render: c => `<span class="td-truncate mono" style="font-size:11px">${escHtml(c.package)}</span>` },
    { key:'description', label:'Description',sort:'description', width:'col-desc',  render: c => `<span class="td-truncate" style="font-size:12px;color:var(--text-secondary)" title="${escHtml(c.description)}">${escHtml(c.description)}</span>` },
  ],
};

function getActiveCols() {
  const cat   = state.filterCat || '';
  // Match against category name (case-insensitive prefix match against CATEGORY_COL_OVERRIDES)
  for (const [key, cols] of Object.entries(CATEGORY_COL_OVERRIDES)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return cols;
  }
  return DEFAULT_COLS;
}

// ============================================================
// Component type icon + color resolution
// Each icon uses standard IEEE/IEC schematic circuit symbols
// ============================================================
const TYPE_DEFS = [
  {
    // IC Chip — DIP package schematic symbol
    test: /ic|integre|entegre|microcontroller|mikrodenetleyici|op.?amp|logic|bellek|memory|fpga|dsp|mcu|cpu|gate|flip.?flop|shift.?register|counter|decoder|encoder|multiplexer|comparator|driver|buffer/i,
    label: 'Integrated Circuit',
    color: '#d97757',
    bg: 'rgba(217,119,87,0.14)',
    border: 'rgba(217,119,87,0.28)',
    // DIP IC: rectangle body, 4 pins each side, notch on top
    icon: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <rect x="9" y="3" width="14" height="26" rx="1.5"/>
      <path d="M13 3 A4 4 0 0 0 19 3" fill="none" stroke-width="1.4"/>
      <line x1="3" y1="8"  x2="9"  y2="8" /><line x1="3" y1="13" x2="9"  y2="13"/>
      <line x1="3" y1="18" x2="9"  y2="18"/><line x1="3" y1="23" x2="9"  y2="23"/>
      <line x1="23" y1="8"  x2="29" y2="8" /><line x1="23" y1="13" x2="29" y2="13"/>
      <line x1="23" y1="18" x2="29" y2="18"/><line x1="23" y1="23" x2="29" y2="23"/>
      <circle cx="12" cy="8"  r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="13" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="23" r="0.8" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    // Resistor — IEC standard: rectangle between two leads
    test: /resist|direnç|direnc/i,
    label: 'Resistor',
    color: '#c49a2a',
    bg: 'rgba(196,154,42,0.14)',
    border: 'rgba(196,154,42,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 32 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <line x1="1" y1="9" x2="6" y2="9"/>
      <rect x="6" y="3" width="20" height="12" rx="1.5"/>
      <line x1="26" y1="9" x2="31" y2="9"/>
    </svg>`,
  },
  {
    // Capacitor — standard schematic: two parallel plates
    test: /capaci|kondans/i,
    label: 'Capacitor',
    color: '#5a8fc4',
    bg: 'rgba(90,143,196,0.14)',
    border: 'rgba(90,143,196,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="1"  y1="12" x2="12" y2="12"/>
      <line x1="12" y1="3"  x2="12" y2="21"/>
      <line x1="20" y1="3"  x2="20" y2="21"/>
      <line x1="20" y1="12" x2="31" y2="12"/>
    </svg>`,
  },
  {
    // Inductor — series of semicircular arcs (coil symbol)
    test: /inductor|bobin|ferrit|coil|choke|transformer|trafo/i,
    label: 'Inductor / Coil',
    color: '#8b72be',
    bg: 'rgba(139,114,190,0.14)',
    border: 'rgba(139,114,190,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 32 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <line x1="1" y1="8" x2="4" y2="8"/>
      <path d="M4 8 A3 3 0 0 1 10 8"/>
      <path d="M10 8 A3 3 0 0 1 16 8"/>
      <path d="M16 8 A3 3 0 0 1 22 8"/>
      <path d="M22 8 A3 3 0 0 1 28 8"/>
      <line x1="28" y1="8" x2="31" y2="8"/>
    </svg>`,
  },
  {
    // N-Channel MOSFET (enhancement mode) — IEEE standard symbol
    // Gate insulated from body (gap), three-segment channel, arrow inward
    test: /mosfet|jfet|igbt/i,
    label: 'MOSFET',
    color: '#6a9e5e',
    bg: 'rgba(106,158,94,0.14)',
    border: 'rgba(106,158,94,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <!-- Gate lead -->
      <line x1="1" y1="15" x2="10" y2="15"/>
      <!-- Gate electrode (isolated vertical bar) -->
      <line x1="10" y1="7" x2="10" y2="23"/>
      <!-- Channel body: three dashes (enhancement mode N-MOSFET) -->
      <line x1="13" y1="8"  x2="13" y2="12"/>
      <line x1="13" y1="14" x2="13" y2="16"/>
      <line x1="13" y1="18" x2="13" y2="22"/>
      <!-- Drain horizontal + lead up -->
      <line x1="13" y1="10" x2="20" y2="10"/>
      <line x1="20" y1="10" x2="20" y2="1"/>
      <!-- Source horizontal + lead down -->
      <line x1="13" y1="20" x2="20" y2="20"/>
      <line x1="20" y1="20" x2="20" y2="29"/>
      <!-- Body connection (center) -->
      <line x1="13" y1="15" x2="20" y2="15"/>
      <!-- N-channel arrow: pointing right toward channel -->
      <polyline points="13,15 9,13 9,17" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    // BJT NPN — standard circle symbol with base, collector, emitter + arrow
    test: /bjt|npn|pnp|transistor/i,
    label: 'Transistor (BJT)',
    color: '#6a9e5e',
    bg: 'rgba(106,158,94,0.14)',
    border: 'rgba(106,158,94,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <!-- Circle body -->
      <circle cx="18" cy="15" r="10"/>
      <!-- Base lead -->
      <line x1="1" y1="15" x2="10" y2="15"/>
      <line x1="10" y1="9" x2="10" y2="21"/>
      <!-- Collector: from upper body to top -->
      <line x1="10" y1="10.5" x2="20" y2="6"/>
      <line x1="20" y1="6"  x2="20" y2="1"/>
      <!-- Emitter: from lower body to bottom with arrow -->
      <line x1="10" y1="19.5" x2="20" y2="24"/>
      <line x1="20" y1="24" x2="20" y2="29"/>
      <!-- NPN emitter arrow (pointing outward / downward) -->
      <polyline points="14.5,22 10,19.5 13,17" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    // LED — diode symbol with two emission arrows
    test: /\bled\b|light.?emitting/i,
    label: 'LED',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.14)',
    border: 'rgba(245,158,11,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <line x1="1"  y1="10" x2="7"  y2="10"/>
      <polygon points="7,4 7,16 19,10" fill="currentColor" fill-opacity="0.18"/>
      <polygon points="7,4 7,16 19,10"/>
      <line x1="19" y1="4"  x2="19" y2="16"/>
      <line x1="19" y1="10" x2="31" y2="10"/>
      <!-- Emission rays -->
      <line x1="21" y1="3" x2="25" y2="0" stroke-width="1.4"/>
      <line x1="24" y1="5" x2="28" y2="2" stroke-width="1.4"/>
      <!-- Arrows on rays -->
      <polyline points="25,0 24,3 22,1" fill="currentColor" stroke="none"/>
      <polyline points="28,2 27,5 25,3" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    // Diode — standard schematic: filled triangle + bar, with leads
    test: /diod|diyot/i,
    label: 'Diode',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.14)',
    border: 'rgba(248,113,113,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <line x1="1"  y1="10" x2="7"  y2="10"/>
      <polygon points="7,4 7,16 19,10" fill="currentColor" fill-opacity="0.22"/>
      <polygon points="7,4 7,16 19,10"/>
      <line x1="19" y1="4"  x2="19" y2="16"/>
      <line x1="19" y1="10" x2="31" y2="10"/>
    </svg>`,
  },
  {
    // Crystal — IEC symbol: two plates + resonator body
    test: /crystal|kristal|oscillat|resonat/i,
    label: 'Crystal / Oscillator',
    color: '#4a9a8c',
    bg: 'rgba(74,154,140,0.14)',
    border: 'rgba(74,154,140,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <line x1="1"  y1="10" x2="7"  y2="10"/>
      <!-- Left plate -->
      <line x1="7"  y1="3"  x2="7"  y2="17"/>
      <!-- Crystal body (rectangle) -->
      <rect x="9" y="5" width="14" height="10" rx="0.5"/>
      <!-- Right plate -->
      <line x1="23" y1="3"  x2="23" y2="17"/>
      <line x1="23" y1="10" x2="31" y2="10"/>
    </svg>`,
  },
  {
    // Connector — multipin header symbol
    test: /connect|konekt|terminal|header|pin.?strip|socket|plug|jack/i,
    label: 'Connector',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.14)',
    border: 'rgba(148,163,184,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <rect x="9" y="4" width="10" height="20" rx="1.5"/>
      <!-- Male pins left -->
      <line x1="3" y1="9"  x2="9"  y2="9" /><circle cx="3" cy="9"  r="1.4" fill="currentColor" stroke="none"/>
      <line x1="3" y1="14" x2="9"  y2="14"/><circle cx="3" cy="14" r="1.4" fill="currentColor" stroke="none"/>
      <line x1="3" y1="19" x2="9"  y2="19"/><circle cx="3" cy="19" r="1.4" fill="currentColor" stroke="none"/>
      <!-- Female sockets right -->
      <line x1="19" y1="9"  x2="25" y2="9" /><circle cx="25" cy="9"  r="1.4" fill="none" stroke-width="1.6"/>
      <line x1="19" y1="14" x2="25" y2="14"/><circle cx="25" cy="14" r="1.4" fill="none" stroke-width="1.6"/>
      <line x1="19" y1="19" x2="25" y2="19"/><circle cx="25" cy="19" r="1.4" fill="none" stroke-width="1.6"/>
    </svg>`,
  },
  {
    // Sensor — generic measurement/sensing symbol
    test: /sensor|sensör|temperature|basınç|pressure|hall|ultrasonic|proximity|accelero|gyro|humidity|nem/i,
    label: 'Sensor',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.14)',
    border: 'rgba(56,189,248,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <circle cx="14" cy="14" r="4"/>
      <path d="M8.2 8.2 A8 8 0 0 0 8.2 19.8" fill="none"/>
      <path d="M19.8 8.2 A8 8 0 0 1 19.8 19.8" fill="none"/>
      <path d="M4.9 4.9 A13 13 0 0 0 4.9 23.1" fill="none" stroke-width="1.3"/>
      <path d="M23.1 4.9 A13 13 0 0 1 23.1 23.1" fill="none" stroke-width="1.3"/>
    </svg>`,
  },
  {
    // Power / Voltage Regulator — LDO/DC-DC symbol
    test: /power|güç|smps|regulator|regülatör|voltage.?reg|ldo|buck|boost|converter/i,
    label: 'Power',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.14)',
    border: 'rgba(251,146,60,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <!-- Voltage source circle -->
      <circle cx="14" cy="14" r="9"/>
      <!-- + and - symbols -->
      <line x1="11" y1="11" x2="17" y2="11"/><line x1="14" y1="8" x2="14" y2="14"/>
      <line x1="11" y1="17" x2="17" y2="17"/>
      <!-- Leads -->
      <line x1="14" y1="1" x2="14" y2="5"/>
      <line x1="14" y1="23" x2="14" y2="27"/>
    </svg>`,
  },
  {
    // Relay — coil + switch contacts
    test: /relay|röle|rele/i,
    label: 'Relay',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.14)',
    border: 'rgba(167,139,250,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 30 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <!-- Coil (inductor) bottom -->
      <line x1="1" y1="21" x2="5" y2="21"/>
      <path d="M5 21 A2 2 0 0 1 9 21"/>
      <path d="M9 21 A2 2 0 0 1 13 21"/>
      <path d="M13 21 A2 2 0 0 1 17 21"/>
      <line x1="17" y1="21" x2="21" y2="21"/>
      <rect x="1" y="18" width="20" height="6" rx="1" stroke-dasharray="3,2" stroke-width="1"/>
      <!-- Switch contact arm -->
      <circle cx="25" cy="8"  r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="25" cy="18" r="1.5" fill="currentColor" stroke="none"/>
      <line x1="25" y1="8" x2="25" y2="18"/>
      <line x1="22" y1="8" x2="28" y2="8"/>
      <!-- Common contact (movable arm) -->
      <line x1="22" y1="6" x2="29" y2="14" stroke-dasharray="2,1"/>
    </svg>`,
  },
];

const DEFAULT_TYPE = {
  label: 'Component',
  color: '#b0aea5',
  bg: 'rgba(176,174,165,0.14)',
  border: 'rgba(176,174,165,0.28)',
  icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/>
  </svg>`,
};

function resolveType(category, subcategory) {
  const text = ((category || '') + ' ' + (subcategory || '')).toLowerCase();
  return TYPE_DEFS.find(d => d.test.test(text)) || DEFAULT_TYPE;
}

// ============================================================
// Filter & sort
// ============================================================
export function applyFilters() {
  let result = state.components;

  if (state.filterCat) {
    result = result.filter(c => c.category === state.filterCat);
  }
  if (state.filterSub) {
    result = result.filter(c => c.subcategory === state.filterSub);
  }
  if (state.filterLoc) {
    result = result.filter(c => {
      const loc   = (c.location || '').trim();
      const parts = loc.split(/\s*[\/\\|>]\s*/).map(p => p.trim()).filter(Boolean);
      if (state.filterLocSub) {
        // Exact segment match: top must equal filterLoc, sub must equal filterLocSub
        const sub = parts.slice(1).join(' / ');
        return parts[0] === state.filterLoc && sub === state.filterLocSub;
      }
      return parts[0] === state.filterLoc;
    });
  }

  if (state.searchQuery) {
    const q = state.searchQuery;
    result = result.filter(c =>
      (c.part_code    || '').toLowerCase().includes(q) ||
      (c.category     || '').toLowerCase().includes(q) ||
      (c.subcategory  || '').toLowerCase().includes(q) ||
      (c.manufacturer || '').toLowerCase().includes(q) ||
      (c.mpn          || '').toLowerCase().includes(q) ||
      (c.description  || '').toLowerCase().includes(q) ||
      (c.package      || '').toLowerCase().includes(q) ||
      (c.location     || '').toLowerCase().includes(q) ||
      (c.notes        || '').toLowerCase().includes(q)
    );
  }

  result = [...result].sort((a, b) => {
    let va = a[state.sortCol];
    let vb = b[state.sortCol];
    if (va === null || va === undefined) va = '';
    if (vb === null || vb === undefined) vb = '';

    const isNum = ['quantity', 'voltage_max', 'current_max', 'unit_price', 'id'].includes(state.sortCol);
    let cmp;
    if (isNum) {
      cmp = (Number(va) || 0) - (Number(vb) || 0);
    } else {
      cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' });
    }
    return state.sortDir === 'asc' ? cmp : -cmp;
  });

  state.filtered = result;

  const count = document.getElementById('result-count');
  if (count) {
    count.textContent = result.length === state.components.length
      ? `${result.length} component${result.length !== 1 ? 's' : ''}`
      : `${result.length} of ${state.components.length} components`;
  }
}

// ============================================================
// Render table body
// ============================================================
export function renderTable() {
  const tbody       = document.getElementById('table-body');
  const thead       = document.querySelector('#inventory-table thead tr');
  const empty       = document.getElementById('empty-state');
  const tableScroll = document.getElementById('table-scroll');

  updateSortHeaders();
  updateBreadcrumb();

  if (state.filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    empty.style.flexDirection = 'column';
    tableScroll.style.display = 'none';
    clearSelection();
    return;
  }

  // Dynamic thead — rebuild columns based on active category filter
  const cols = getActiveCols();
  if (thead) {
    thead.innerHTML =
      `<th class="col-cb"><input type="checkbox" id="cb-select-all" title="Select all"></th>` +
      cols.map(col =>
        `<th data-col="${col.sort || ''}" class="${col.sort ? 'sortable ' : ''}${col.width}">${col.label} ${col.sort ? '<span class="sort-icon"></span>' : ''}</th>`
      ).join('') +
      `<th class="col-actions">Actions</th>`;

    // Re-attach sort listeners after thead rebuild
    initSortHeaders();

    // Header checkbox
    document.getElementById('cb-select-all')?.addEventListener('change', e => {
      if (e.target.checked) {
        state.filtered.forEach(c => selectedIds.add(c.id));
      } else {
        selectedIds.clear();
      }
      // Re-check all row checkboxes
      tbody.querySelectorAll('.row-cb').forEach(cb => {
        cb.checked = e.target.checked;
      });
      updateSelectionBar();
    });
  }

  empty.style.display = 'none';
  tableScroll.style.display = '';
  tbody.innerHTML = state.filtered.map(c => buildRow(c, cols)).join('');

  // Sync checkboxes with current selection
  tbody.querySelectorAll('.row-cb').forEach(cb => {
    const id = Number(cb.dataset.id);
    cb.checked = selectedIds.has(id);
    cb.addEventListener('change', e => {
      e.stopPropagation();
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateSelectionBar();
    });
  });

  // Delegated click — open detail (skip checkbox, actions)
  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.row-actions') || e.target.closest('.row-cb-cell')) return;
      const id   = Number(row.dataset.id);
      const comp = state.components.find(c => c.id === id);
      if (comp) showDetail(comp);
    });
  });

  tbody.querySelectorAll('.btn-row-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id   = Number(btn.closest('tr').dataset.id);
      const comp = state.components.find(c => c.id === id);
      if (comp) openEditModal(comp);
    });
  });

  tbody.querySelectorAll('.btn-row-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id   = Number(btn.closest('tr').dataset.id);
      const comp = state.components.find(c => c.id === id);
      if (comp) openConfirmDelete(comp);
    });
  });
}

function buildRow(c, cols) {
  const isSelected = selectedIds.has(c.id);
  const cells = cols.map(col =>
    `<td class="${col.width}">${col.render(c)}</td>`
  ).join('');

  return `<tr data-id="${c.id}"${isSelected ? ' class="row-selected"' : ''}>
    <td class="row-cb-cell col-cb"><input type="checkbox" class="row-cb" data-id="${c.id}"${isSelected ? ' checked' : ''}></td>
    ${cells}
    <td class="col-actions">
      <div class="row-actions">
        <button class="row-action-btn btn-row-edit" title="Edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="row-action-btn danger btn-row-delete" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </td>
  </tr>`;
}

// ============================================================
// Breadcrumb display
// ============================================================
function updateBreadcrumb() {
  const bar = document.getElementById('breadcrumb-bar');
  if (!bar) return;

  const cat  = state.filterCat;
  const sub  = state.filterSub;
  const loc  = state.filterLoc;
  const n    = state.filtered.length;

  if (!cat && !loc) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  let crumb = '';
  if (cat) {
    crumb = escHtml(cat);
    if (sub) crumb += ` <span class="bc-sep">›</span> ${escHtml(sub)}`;
  } else if (loc) {
    crumb = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escHtml(loc)}`;
  }

  bar.innerHTML = `
    <span class="bc-icon">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    </span>
    <span class="bc-path">${crumb}</span>
    <span class="bc-count">${n} component${n !== 1 ? 's' : ''}</span>
  `;
}

export function initSelectionBarOnce() {
  initSelectionBar();
}

// ============================================================
// Sort headers
// ============================================================
function updateSortHeaders() {
  document.querySelectorAll('#inventory-table th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === state.sortCol) {
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

export function initSortHeaders() {
  document.querySelectorAll('#inventory-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = 'asc';
      }
      applyFilters();
      renderTable();
    });
  });
}

// ============================================================
// Detail modal — enhanced
// ============================================================
let _detailComp = null;
let _detailObjectUrl = null;

async function showDetail(comp) {
  _detailComp = comp;
  setLabelComponent(comp);
  const dbRecord  = lookupComponent(comp.part_code);
  // Merge comp with DB (DB fills only empty fields)
  const effective = applyDbData(comp, dbRecord);

  const typeDef = resolveType(
    effective.category || comp.category,
    effective.subcategory || comp.subcategory
  );

  document.getElementById('detail-part-code').textContent = comp.part_code;

  const body = document.getElementById('detail-body');
  const val  = (v, cls = '') => (v != null && v !== '')
    ? `<span class="detail-value ${cls}">${escHtml(String(v))}</span>`
    : `<span class="detail-value empty">—</span>`;

  // Spec cards — pulled from effective (component OR hardcoded DB)
  const specCards = [
    comp.resistance ? `<div class="spec-card">
      <span class="spec-label">Resistance</span>
      <span class="spec-value" style="font-size:13px">${escHtml(comp.resistance)}</span>
    </div>` : '',
    comp.tolerance ? `<div class="spec-card">
      <span class="spec-label">Tolerance</span>
      <span class="spec-value" style="font-size:13px">${escHtml(comp.tolerance)}</span>
    </div>` : '',
    comp.power_rating != null ? `<div class="spec-card">
      <span class="spec-label">Power Rating</span>
      <span class="spec-value">${comp.power_rating}<span class="spec-unit"> W</span></span>
    </div>` : '',
    effective.voltage_max != null ? `<div class="spec-card">
      <span class="spec-label">Voltage Max</span>
      <span class="spec-value">${effective.voltage_max}<span class="spec-unit"> V</span></span>
    </div>` : '',
    effective.current_max != null ? `<div class="spec-card">
      <span class="spec-label">Current Max</span>
      <span class="spec-value">${effective.current_max}<span class="spec-unit"> A</span></span>
    </div>` : '',
    effective.package ? `<div class="spec-card">
      <span class="spec-label">Package</span>
      <span class="spec-value" style="font-size:13px">${escHtml(effective.package)}</span>
    </div>` : '',
    comp.quantity != null ? `<div class="spec-card">
      <span class="spec-label">In Stock</span>
      <span class="spec-value" style="color:${Number(comp.quantity) <= 1 ? 'var(--low-stock)' : 'var(--accent-green)'}">${comp.quantity}<span class="spec-unit"> pcs</span></span>
    </div>` : '',
    comp.unit_price != null ? `<div class="spec-card">
      <span class="spec-label">Unit Price</span>
      <span class="spec-value" style="font-size:13px">$${Number(comp.unit_price).toFixed(4)}</span>
    </div>` : '',
    effective.manufacturer ? `<div class="spec-card">
      <span class="spec-label">Manufacturer</span>
      <span class="spec-value" style="font-size:11px;font-family:var(--font-body)">${escHtml(effective.manufacturer)}</span>
    </div>` : '',
  ].filter(Boolean);

  // Datasheet URL from component or DB — sanitize to https?:// only
  const rawUrl       = comp.datasheet_url || (dbRecord && dbRecord.datasheet_url) || '';
  const datasheetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
  const pdfHeaderBtn = document.getElementById('btn-detail-pdf');
  if (pdfHeaderBtn) {
    if (datasheetUrl) {
      pdfHeaderBtn.href = datasheetUrl;
      pdfHeaderBtn.style.display = '';
    } else {
      pdfHeaderBtn.style.display = 'none';
    }
  }
  const pdfBtn = '';

  // Suggestion banner when DB has unapplied data
  const hasGap = dbRecord && (
    (!comp.category      && dbRecord.category)     ||
    (!comp.description   && dbRecord.description)  ||
    (comp.voltage_max == null && dbRecord.voltage_max != null)
  );
  const dbBanner = hasGap ? `
    <div class="db-suggestion-banner">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <strong>${escHtml(comp.part_code)}</strong> found in built-in database.
      Open <em>Edit</em> → <em>Lookup DB</em> to persist full data.
    </div>` : '';

  // Revoke previous object URL to prevent memory leak
  if (_detailObjectUrl) {
    URL.revokeObjectURL(_detailObjectUrl);
    _detailObjectUrl = null;
  }

  // Component image (if stored)
  let imageHtml = '';
  if (comp.image_path) {
    try {
      const bytes   = await readFile(comp.image_path);
      const ext     = comp.image_path.split('.').pop().toLowerCase();
      const mime    = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png';
      const blob    = new Blob([bytes], { type: mime });
      _detailObjectUrl = URL.createObjectURL(blob);
      imageHtml = `<div class="detail-image-wrap"><img src="${_detailObjectUrl}" alt="${escHtml(comp.part_code)}" /></div>`;
    } catch (_) { /* image not accessible */ }
  }

  body.innerHTML = `
    ${dbBanner}
    ${imageHtml}
    ${pdfBtn}

    <!-- Type header -->
    <div class="detail-type-header">
      <div class="detail-type-icon" style="background:${typeDef.bg};border-color:${typeDef.border};color:${typeDef.color}">
        ${typeDef.icon}
      </div>
      <div class="detail-type-info">
        <div class="detail-type-name">${typeDef.label}</div>
        <div class="detail-type-badge">
          ${(effective.category || comp.category)    ? `<span class="badge badge-cat">${escHtml(effective.category || comp.category)}</span>` : ''}
          ${(effective.subcategory || comp.subcategory) ? `<span class="badge badge-sub">${escHtml(effective.subcategory || comp.subcategory)}</span>` : ''}
        </div>
        ${comp.location ? `<div style="margin-top:5px;font-size:11px;color:var(--text-tertiary);font-family:var(--font-mono)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escHtml(comp.location)}
        </div>` : ''}
      </div>
    </div>

    <!-- Key specifications (from component + DB) -->
    ${specCards.length > 0 ? `
    <div class="detail-section-title">Key Specifications</div>
    <div class="spec-grid">${specCards.join('')}</div>
    ` : ''}

    <!-- Description / Notes -->
    <div class="detail-section-title">Component Details</div>
    <div class="detail-grid">
      <div class="detail-field">
        <span class="detail-label">MPN</span>
        ${val(comp.mpn, 'mono')}
      </div>
      <div class="detail-field full">
        <span class="detail-label">Description</span>
        ${val(effective.description || comp.description)}
      </div>
      ${comp.notes ? `<div class="detail-field full">
        <span class="detail-label">Notes</span>
        ${val(comp.notes)}
      </div>` : ''}
      ${datasheetUrl && comp.datasheet_url ? `<div class="detail-field full">
        <span class="detail-label">Datasheet URL</span>
        <a href="${escHtml(datasheetUrl)}" target="_blank" rel="noopener" class="detail-value" style="color:var(--accent-blue);word-break:break-all;font-size:11px">${escHtml(datasheetUrl)}</a>
      </div>` : ''}
      <div class="detail-field">
        <span class="detail-label">Created</span>
        <span class="detail-value mono" style="font-size:11px">${comp.created_at || '—'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Updated</span>
        <span class="detail-value mono" style="font-size:11px">${comp.updated_at || '—'}</span>
      </div>
    </div>`;

  document.getElementById('overlay-detail').style.display = '';
}

function openEditModal(comp) {
  document.dispatchEvent(new CustomEvent('open-edit', { detail: comp }));
}

function openConfirmDelete(comp) {
  document.dispatchEvent(new CustomEvent('open-delete-confirm', { detail: comp }));
}

export { showDetail };
