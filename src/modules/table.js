import { state, escHtml } from '../app.js';

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

  // Sort
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
  const tbody = document.getElementById('table-body');
  const empty = document.getElementById('empty-state');
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

  // Row click -> detail
  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.row-actions')) return;
      const id = Number(row.dataset.id);
      const comp = state.components.find(c => c.id === id);
      if (comp) showDetail(comp);
    });
  });

  // Edit buttons
  tbody.querySelectorAll('.btn-row-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = Number(btn.closest('tr').dataset.id);
      const comp = state.components.find(c => c.id === id);
      if (comp) openEditModal(comp);
    });
  });

  // Delete buttons
  tbody.querySelectorAll('.btn-row-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = Number(btn.closest('tr').dataset.id);
      const comp = state.components.find(c => c.id === id);
      if (comp) openConfirmDelete(comp);
    });
  });
}

function buildRow(c) {
  const qty = Number(c.quantity) || 0;
  const qtyClass = qty <= 1 ? 'qty-badge low' : 'qty-badge';

  const vMax = c.voltage_max != null ? `${c.voltage_max}V` : '';
  const iMax = c.current_max != null ? `${c.current_max}A` : '';
  const price = c.unit_price != null ? `$${Number(c.unit_price).toFixed(3)}` : '';

  return `<tr data-id="${c.id}">
    <td class="mono"><span class="td-truncate" title="${escHtml(c.part_code)}">${escHtml(c.part_code)}</span></td>
    <td>${c.category ? `<span class="badge badge-cat">${escHtml(c.category)}</span>` : ''}</td>
    <td>${c.subcategory ? `<span class="badge badge-sub">${escHtml(c.subcategory)}</span>` : ''}</td>
    <td class="num"><span class="${qtyClass}">${qty}</span></td>
    <td>${c.package ? `<span class="mono" style="font-size:12px">${escHtml(c.package)}</span>` : ''}</td>
    <td><span class="td-truncate" title="${escHtml(c.manufacturer)}">${escHtml(c.manufacturer)}</span></td>
    <td class="mono"><span class="td-truncate" title="${escHtml(c.mpn)}" style="font-size:11px">${escHtml(c.mpn)}</span></td>
    <td>${escHtml(c.location)}</td>
    <td class="num">${vMax ? `<span class="mono" style="font-size:12px">${escHtml(vMax)}</span>` : ''}</td>
    <td class="num">${iMax ? `<span class="mono" style="font-size:12px">${escHtml(iMax)}</span>` : ''}</td>
    <td><span class="td-truncate" title="${escHtml(c.description)}">${escHtml(c.description)}</span></td>
    <td class="num">${price ? `<span class="mono" style="font-size:12px">${escHtml(price)}</span>` : ''}</td>
    <td class="col-actions">
      <div class="row-actions">
        <button class="row-action-btn btn-row-edit" title="Edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="row-action-btn danger btn-row-delete" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
// Detail modal
// ============================================================
let _detailComp = null;

function showDetail(comp) {
  _detailComp = comp;

  document.getElementById('detail-part-code').textContent = comp.part_code;

  const body = document.getElementById('detail-body');
  const val = (v, cls = '') => v
    ? `<span class="detail-value ${cls}">${escHtml(String(v))}</span>`
    : `<span class="detail-value empty">—</span>`;

  body.innerHTML = `<div class="detail-grid">
    <div class="detail-field">
      <span class="detail-label">Category</span>
      ${val(comp.category)}
    </div>
    <div class="detail-field">
      <span class="detail-label">Subcategory</span>
      ${val(comp.subcategory)}
    </div>
    <div class="detail-field">
      <span class="detail-label">Quantity</span>
      ${val(comp.quantity)}
    </div>
    <div class="detail-field">
      <span class="detail-label">Package</span>
      ${val(comp.package, 'mono')}
    </div>
    <div class="detail-field">
      <span class="detail-label">Manufacturer</span>
      ${val(comp.manufacturer)}
    </div>
    <div class="detail-field">
      <span class="detail-label">MPN</span>
      ${val(comp.mpn, 'mono')}
    </div>
    <div class="detail-field">
      <span class="detail-label">Location / Bin</span>
      ${val(comp.location, 'mono')}
    </div>
    <div class="detail-field">
      <span class="detail-label">Unit Price</span>
      ${comp.unit_price != null ? `<span class="detail-value mono">$${Number(comp.unit_price).toFixed(4)}</span>` : `<span class="detail-value empty">—</span>`}
    </div>
    <div class="detail-field">
      <span class="detail-label">Voltage Max</span>
      ${comp.voltage_max != null ? `<span class="detail-value mono">${comp.voltage_max} V</span>` : `<span class="detail-value empty">—</span>`}
    </div>
    <div class="detail-field">
      <span class="detail-label">Current Max</span>
      ${comp.current_max != null ? `<span class="detail-value mono">${comp.current_max} A</span>` : `<span class="detail-value empty">—</span>`}
    </div>
    <div class="detail-field full">
      <span class="detail-label">Description</span>
      ${val(comp.description)}
    </div>
    <div class="detail-field full">
      <span class="detail-label">Datasheet URL</span>
      ${comp.datasheet_url
        ? `<a href="${escHtml(comp.datasheet_url)}" target="_blank" rel="noopener" class="detail-value">${escHtml(comp.datasheet_url)}</a>`
        : `<span class="detail-value empty">—</span>`}
    </div>
    <div class="detail-field full">
      <span class="detail-label">Notes</span>
      ${val(comp.notes)}
    </div>
    <div class="detail-field">
      <span class="detail-label">Created</span>
      <span class="detail-value mono" style="font-size:12px">${comp.created_at || '—'}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">Updated</span>
      <span class="detail-value mono" style="font-size:12px">${comp.updated_at || '—'}</span>
    </div>
  </div>`;

  document.getElementById('overlay-detail').style.display = '';
}

function openEditModal(comp) {
  // Imported lazily to avoid circular dep — dispatch a custom event
  document.dispatchEvent(new CustomEvent('open-edit', { detail: comp }));
}

function openConfirmDelete(comp) {
  document.dispatchEvent(new CustomEvent('open-delete-confirm', { detail: comp }));
}

export { showDetail };
