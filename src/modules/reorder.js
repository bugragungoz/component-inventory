import { state, showToast, escHtml } from '../app.js';
import { t, applyTranslations } from './i18n.js';
import { STORAGE_KEYS } from './constants.js';
import { normalizeThreshold, getSuggestedQty, buildReorderRows } from './reorder_core.js';

function getLowStockThreshold() {
  return normalizeThreshold(localStorage.getItem('lowStockThreshold') || '1', 1);
}

function wishId() {
  return globalThis.crypto?.randomUUID?.() || `w-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadWishlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REORDER_WISHLIST);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveWishlist(rows) {
  localStorage.setItem(STORAGE_KEYS.REORDER_WISHLIST, JSON.stringify(rows));
}

function getRows() {
  const threshold = getLowStockThreshold();
  const rows = buildReorderRows(state.components || [], threshold);
  return { threshold, rows };
}

function renderTable() {
  const tbody = document.getElementById('reorder-tbody');
  const subtitle = document.getElementById('reorder-subtitle');
  if (!tbody || !subtitle) return;

  const { threshold, rows } = getRows();
  subtitle.textContent = t('reorder.subtitle', { threshold, n: rows.length });

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:22px">${t('reorder.empty')}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const currentQty = Number(row.quantity) || 0;
    const suggested = getSuggestedQty(currentQty, threshold);
    return `<tr data-id="${row.id}">
      <td>${row.part_code || ''}</td>
      <td>${currentQty}</td>
      <td>${threshold}</td>
      <td>${suggested}</td>
      <td>
        <input type="text" class="settings-input-path reorder-supplier-input" value="${row.preferred_supplier || ''}" placeholder="${t('reorder.supplier.placeholder')}" style="min-width:180px" />
      </td>
      <td>
        <button type="button" class="btn btn-ghost btn-sm btn-reorder-save">${t('reorder.btn.saveSupplier')}</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-reorder-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      if (!tr) return;
      const id = Number(tr.dataset.id);
      const input = tr.querySelector('.reorder-supplier-input');
      const value = input ? input.value.trim() : '';
      try {
        await state.db.execute(
          'UPDATE components SET preferred_supplier = ?, updated_at=datetime(\'now\') WHERE id = ?',
          [value, id]
        );
        const row = state.components.find(c => Number(c.id) === id);
        if (row) row.preferred_supplier = value;
        showToast(t('reorder.saved'), 'success');
      } catch (err) {
        showToast(t('toast.saveFailed') + (err.message || err), 'error');
      }
    });
  });
}

function renderWishlist() {
  const tbody = document.getElementById('reorder-wish-tbody');
  if (!tbody) return;
  const list = loadWishlist();
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px">${t('reorder.wish.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(entry => {
    const code = escHtml(String(entry.partCode || ''));
    const note = escHtml(String(entry.note || ''));
    const qty = Math.max(1, Number(entry.qty) || 1);
    const wid = escHtml(String(entry.id || ''));
    return `<tr data-wid="${wid}">
      <td>${code}</td>
      <td>${qty}</td>
      <td style="max-width:240px;word-break:break-word">${note}</td>
      <td>
        <button type="button" class="btn btn-ghost btn-sm btn-reorder-wish-del">${t('action.delete')}</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-reorder-wish-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      const wid = tr?.dataset.wid;
      if (!wid) return;
      const next = loadWishlist().filter(e => e.id !== wid);
      saveWishlist(next);
      renderWishlist();
      showToast(t('reorder.wish.removed'), 'info');
    });
  });
}

function wireWishlistForm() {
  const addBtn = document.getElementById('btn-reorder-wish-add');
  const partEl = document.getElementById('reorder-wish-part');
  const qtyEl = document.getElementById('reorder-wish-qty');
  const noteEl = document.getElementById('reorder-wish-note');
  if (!addBtn || !partEl) return;

  addBtn.addEventListener('click', () => {
    const partCode = String(partEl.value || '').trim();
    if (!partCode) {
      showToast(t('reorder.manual.needPart'), 'warning');
      return;
    }
    const qty = Math.max(1, Number(qtyEl?.value) || 1);
    const note = String(noteEl?.value || '').trim();
    const list = loadWishlist();
    list.push({ id: wishId(), partCode, qty, note });
    saveWishlist(list);
    partEl.value = '';
    if (noteEl) noteEl.value = '';
    if (qtyEl) qtyEl.value = '1';
    renderWishlist();
  });
}

export function initReorder() {
  const openBtn = document.getElementById('btn-reorder');
  const overlay = document.getElementById('overlay-reorder');
  if (!openBtn || !overlay) return;

  wireWishlistForm();

  openBtn.addEventListener('click', () => {
    applyTranslations(overlay);
    renderTable();
    renderWishlist();
    overlay.style.display = 'flex';
  });
}
