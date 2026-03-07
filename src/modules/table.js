import { state, escHtml } from '../app.js';

// ============================================================
// Component type icon + color resolution
// ============================================================
const TYPE_DEFS = [
  {
    test: /ic|integre|entegre|microcontroller|mikrodenetleyici|op.?amp|logic|bellek|memory|fpga|dsp|mcu|cpu|gate|flip.?flop|shift.?register|counter|decoder|encoder|multiplexer|comparator|driver|buffer|regülatör.*ic/i,
    label: 'Integrated Circuit',
    color: '#d97757',
    bg: 'rgba(217,119,87,0.14)',
    border: 'rgba(217,119,87,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <rect x="5" y="3" width="14" height="18" rx="1"/>
      <line x1="2" y1="6" x2="5" y2="6"/><line x1="2" y1="10" x2="5" y2="10"/>
      <line x1="2" y1="14" x2="5" y2="14"/><line x1="2" y1="18" x2="5" y2="18"/>
      <line x1="19" y1="6" x2="22" y2="6"/><line x1="19" y1="10" x2="22" y2="10"/>
      <line x1="19" y1="14" x2="22" y2="14"/><line x1="19" y1="18" x2="22" y2="18"/>
      <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/>
    </svg>`,
  },
  {
    test: /resist|direnç|direnc/i,
    label: 'Resistor',
    color: '#c49a2a',
    bg: 'rgba(196,154,42,0.14)',
    border: 'rgba(196,154,42,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="1" y1="12" x2="4" y2="12"/>
      <rect x="4" y="9" width="16" height="6" rx="1"/>
      <line x1="20" y1="12" x2="23" y2="12"/>
    </svg>`,
  },
  {
    test: /capaci|kondans/i,
    label: 'Capacitor',
    color: '#5a8fc4',
    bg: 'rgba(90,143,196,0.14)',
    border: 'rgba(90,143,196,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="1" y1="12" x2="9" y2="12"/>
      <line x1="9" y1="6" x2="9" y2="18"/>
      <line x1="15" y1="6" x2="15" y2="18"/>
      <line x1="15" y1="12" x2="23" y2="12"/>
    </svg>`,
  },
  {
    test: /inductor|bobin|ferrit|coil|choke|transformer|trafo/i,
    label: 'Inductor / Coil',
    color: '#8b72be',
    bg: 'rgba(139,114,190,0.14)',
    border: 'rgba(139,114,190,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="1" y1="12" x2="3" y2="12"/>
      <path d="M3 12 Q5 8 7 12 Q9 16 11 12 Q13 8 15 12 Q17 16 19 12 Q21 8 23 12"/>
    </svg>`,
  },
  {
    test: /transistor|mosfet|bjt|jfet|igbt/i,
    label: 'Transistor',
    color: '#6a9e5e',
    bg: 'rgba(106,158,94,0.14)',
    border: 'rgba(106,158,94,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="1" y1="12" x2="8" y2="12"/>
      <line x1="8" y1="7" x2="8" y2="17"/>
      <line x1="10" y1="8.5" x2="10" y2="11.5"/>
      <line x1="10" y1="12.5" x2="10" y2="15.5"/>
      <line x1="10" y1="9" x2="22" y2="4"/>
      <line x1="10" y1="15" x2="22" y2="20"/>
      <line x1="16" y1="12" x2="22" y2="12"/>
    </svg>`,
  },
  {
    test: /^led|led$| led |light.?emitting/i,
    label: 'LED',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.14)',
    border: 'rgba(245,158,11,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="1" y1="12" x2="7" y2="12"/>
      <polygon points="7,7 7,17 17,12"/>
      <line x1="17" y1="7" x2="17" y2="17"/>
      <line x1="17" y1="12" x2="23" y2="12"/>
      <line x1="19" y1="5" x2="22" y2="2"/>
      <line x1="22" y1="6" x2="23" y2="3"/>
    </svg>`,
  },
  {
    test: /diod|diyot/i,
    label: 'Diode',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.14)',
    border: 'rgba(248,113,113,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="1" y1="12" x2="7" y2="12"/>
      <polygon points="7,7 7,17 17,12" fill="currentColor" opacity="0.2"/>
      <polygon points="7,7 7,17 17,12"/>
      <line x1="17" y1="7" x2="17" y2="17"/>
      <line x1="17" y1="12" x2="23" y2="12"/>
    </svg>`,
  },
  {
    test: /crystal|kristal|oscillat|resonat/i,
    label: 'Crystal / Oscillator',
    color: '#4a9a8c',
    bg: 'rgba(74,154,140,0.14)',
    border: 'rgba(74,154,140,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="1" y1="12" x2="4" y2="12"/>
      <rect x="4" y="8" width="16" height="8" rx="1"/>
      <line x1="8" y1="8" x2="8" y2="16"/>
      <line x1="16" y1="8" x2="16" y2="16"/>
      <line x1="20" y1="12" x2="23" y2="12"/>
    </svg>`,
  },
  {
    test: /connect|konekt|terminal|header|pin.?strip|socket|plug|jack/i,
    label: 'Connector',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.14)',
    border: 'rgba(148,163,184,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <rect x="7" y="4" width="10" height="16" rx="1"/>
      <line x1="2" y1="8" x2="7" y2="8"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="2" y1="16" x2="7" y2="16"/>
      <line x1="10" y1="8" x2="14" y2="8"/><line x1="10" y1="12" x2="14" y2="12"/><line x1="10" y1="16" x2="14" y2="16"/>
    </svg>`,
  },
  {
    test: /sensor|sensör|temperature|basınç|pressure|hall|ultrasonic|proximity|hız|accelero|gyro|humidity|nem|ışık/i,
    label: 'Sensor',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.14)',
    border: 'rgba(56,189,248,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4"/><path d="M17.7 6.3a8 8 0 0 1 0 11.4"/>
      <path d="M3.5 3.5a13 13 0 0 0 0 17"/><path d="M20.5 3.5a13 13 0 0 1 0 17"/>
    </svg>`,
  },
  {
    test: /power|güç|smps|regulator|regülatör|voltage.?reg|ldo|buck|boost|converter/i,
    label: 'Power',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.14)',
    border: 'rgba(251,146,60,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>`,
  },
  {
    test: /relay|röle|rele/i,
    label: 'Relay',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.14)',
    border: 'rgba(167,139,250,0.28)',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <rect x="4" y="8" width="16" height="8" rx="1"/>
      <circle cx="8" cy="12" r="2"/>
      <line x1="16" y1="10" x2="20" y2="8"/>
      <line x1="16" y1="14" x2="20" y2="16"/>
      <line x1="1" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="8" x2="23" y2="8"/>
      <line x1="20" y1="16" x2="23" y2="16"/>
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
  const tbody      = document.getElementById('table-body');
  const empty      = document.getElementById('empty-state');
  const tableScroll = document.getElementById('table-scroll');

  updateSortHeaders();

  if (state.filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    empty.style.flexDirection = 'column';
    tableScroll.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  tableScroll.style.display = '';
  tbody.innerHTML = state.filtered.map(c => buildRow(c)).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.row-actions')) return;
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

function buildRow(c) {
  const qty      = Number(c.quantity) || 0;
  const qtyClass = qty <= 1 ? 'qty-badge low' : 'qty-badge';
  const vMax     = c.voltage_max != null ? `${c.voltage_max}V` : '';
  const iMax     = c.current_max != null ? `${c.current_max}A` : '';
  const price    = c.unit_price  != null ? `$${Number(c.unit_price).toFixed(2)}` : '';

  return `<tr data-id="${c.id}">
    <td class="col-pc"><span class="td-truncate mono" style="font-size:12px;font-weight:500" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span></td>
    <td class="col-cat">${c.category    ? `<span class="badge badge-cat">${escHtml(c.category)}</span>` : ''}</td>
    <td class="col-sub">${c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : ''}</td>
    <td class="num col-qty"><span class="${qtyClass}">${qty}</span></td>
    <td class="col-pkg"><span class="td-truncate mono" style="font-size:11px" title="${escHtml(c.package)}">${escHtml(c.package)}</span></td>
    <td class="col-mfr"><span class="td-truncate" style="font-size:12px" title="${escHtml(c.manufacturer)}">${escHtml(c.manufacturer)}</span></td>
    <td class="col-mpn"><span class="td-truncate mono" style="font-size:11px" title="${escHtml(c.mpn)}">${escHtml(c.mpn)}</span></td>
    <td class="col-loc"><span class="td-truncate" style="font-size:12px" title="${escHtml(c.location)}">${escHtml(c.location)}</span></td>
    <td class="num col-vmax">${vMax ? `<span class="mono" style="font-size:11px">${escHtml(vMax)}</span>` : ''}</td>
    <td class="num col-imax">${iMax ? `<span class="mono" style="font-size:11px">${escHtml(iMax)}</span>` : ''}</td>
    <td class="col-desc"><span class="td-truncate" style="font-size:12px;color:var(--text-secondary)" title="${escHtml(c.description)}">${escHtml(c.description)}</span></td>
    <td class="num col-price">${price ? `<span class="mono" style="font-size:11px">${escHtml(price)}</span>` : ''}</td>
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

function showDetail(comp) {
  _detailComp = comp;

  const typeDef = resolveType(comp.category, comp.subcategory);

  document.getElementById('detail-part-code').textContent = comp.part_code;

  const body = document.getElementById('detail-body');
  const val  = (v, cls = '') => v
    ? `<span class="detail-value ${cls}">${escHtml(String(v))}</span>`
    : `<span class="detail-value empty">—</span>`;

  // Electrical specs section
  const hasElec = comp.voltage_max != null || comp.current_max != null || comp.package;
  const specCards = [
    comp.voltage_max != null ? `<div class="spec-card">
      <span class="spec-label">Voltage Max</span>
      <span class="spec-value">${comp.voltage_max}<span class="spec-unit"> V</span></span>
    </div>` : '',
    comp.current_max != null ? `<div class="spec-card">
      <span class="spec-label">Current Max</span>
      <span class="spec-value">${comp.current_max}<span class="spec-unit"> A</span></span>
    </div>` : '',
    comp.package ? `<div class="spec-card">
      <span class="spec-label">Package</span>
      <span class="spec-value" style="font-size:13px">${escHtml(comp.package)}</span>
    </div>` : '',
    comp.quantity != null ? `<div class="spec-card">
      <span class="spec-label">In Stock</span>
      <span class="spec-value" style="color:${Number(comp.quantity) <= 1 ? 'var(--low-stock)' : 'var(--accent-green)'}">${comp.quantity}<span class="spec-unit"> pcs</span></span>
    </div>` : '',
    comp.unit_price != null ? `<div class="spec-card">
      <span class="spec-label">Unit Price</span>
      <span class="spec-value" style="font-size:13px">$${Number(comp.unit_price).toFixed(4)}</span>
    </div>` : '',
  ].filter(Boolean);

  const datasheetBtn = comp.datasheet_url
    ? `<a href="${escHtml(comp.datasheet_url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="text-decoration:none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Datasheet PDF
      </a>`
    : '';

  body.innerHTML = `
    <!-- Type header -->
    <div class="detail-type-header">
      <div class="detail-type-icon" style="background:${typeDef.bg};border-color:${typeDef.border};color:${typeDef.color}">
        ${typeDef.icon}
      </div>
      <div class="detail-type-info">
        <div class="detail-type-name">${typeDef.label}</div>
        <div class="detail-type-badge">
          ${comp.category    ? `<span class="badge badge-cat">${escHtml(comp.category)}</span>` : ''}
          ${comp.subcategory ? `<span class="badge badge-sub">${escHtml(comp.subcategory)}</span>` : ''}
        </div>
        <div class="detail-actions-row">
          ${datasheetBtn}
          ${comp.location ? `<span style="font-size:11px;color:var(--text-tertiary);font-family:var(--font-mono);align-self:center">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${escHtml(comp.location)}
          </span>` : ''}
        </div>
      </div>
    </div>

    <!-- Electrical / key specs -->
    ${specCards.length > 0 ? `
    <div class="detail-section-title">Key Specifications</div>
    <div class="spec-grid">${specCards.join('')}</div>
    ` : ''}

    <!-- Details grid -->
    <div class="detail-section-title">Component Details</div>
    <div class="detail-grid">
      <div class="detail-field">
        <span class="detail-label">Manufacturer</span>
        ${val(comp.manufacturer)}
      </div>
      <div class="detail-field">
        <span class="detail-label">MPN</span>
        ${val(comp.mpn, 'mono')}
      </div>
      <div class="detail-field full">
        <span class="detail-label">Description</span>
        ${val(comp.description)}
      </div>
      <div class="detail-field full">
        <span class="detail-label">Datasheet URL</span>
        ${comp.datasheet_url
          ? `<a href="${escHtml(comp.datasheet_url)}" target="_blank" rel="noopener" class="detail-value" style="color:var(--accent-blue);word-break:break-all">${escHtml(comp.datasheet_url)}</a>`
          : `<span class="detail-value empty">—</span>`}
      </div>
      ${comp.notes ? `<div class="detail-field full">
        <span class="detail-label">Notes</span>
        ${val(comp.notes)}
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
