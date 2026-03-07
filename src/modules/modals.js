import {
  state, addComponent, updateComponent, deleteComponent,
  showToast, refreshDatalistsGlobal
} from '../app.js';
import { initSortHeaders } from './table.js';

// ============================================================
// Initialize all modal interactions
// ============================================================
export function initModals() {
  initSortHeaders();
  initAddButton();
  initEditForm();
  initDeleteConfirm();
  initDetailActions();
}

// ============================================================
// Open the edit modal in "add" mode
// ============================================================
function initAddButton() {
  document.getElementById('btn-add').addEventListener('click', () => openEditModal(null));
  document.getElementById('btn-add-empty').addEventListener('click', () => openEditModal(null));
}

// ============================================================
// Edit modal (Add / Edit)
// ============================================================
function openEditModal(comp) {
  const title  = document.getElementById('modal-edit-title');
  const idEl   = document.getElementById('edit-id');

  refreshDatalistsGlobal();

  if (comp) {
    title.textContent = 'Edit Component';
    idEl.value = comp.id;
    setField('edit-part-code',   comp.part_code);
    setField('edit-category',    comp.category);
    setField('edit-subcategory', comp.subcategory);
    setField('edit-quantity',    comp.quantity);
    setField('edit-package',     comp.package);
    setField('edit-manufacturer',comp.manufacturer);
    setField('edit-mpn',         comp.mpn);
    setField('edit-location',    comp.location);
    setField('edit-voltage-max', comp.voltage_max ?? '');
    setField('edit-current-max', comp.current_max ?? '');
    setField('edit-unit-price',  comp.unit_price ?? '');
    setField('edit-description', comp.description);
    setField('edit-datasheet-url', comp.datasheet_url);
    setField('edit-notes',       comp.notes);
  } else {
    title.textContent = 'Add Component';
    idEl.value = '';
    document.getElementById('form-edit').reset();
  }

  document.getElementById('overlay-edit').style.display = '';
  setTimeout(() => document.getElementById('edit-part-code').focus(), 60);
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
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

  // AI Enrich button
  document.getElementById('btn-ai-enrich').addEventListener('click', async () => {
    const partCode = document.getElementById('edit-part-code').value.trim();
    if (!partCode) {
      showToast('Enter a Part Code first to use AI Enrich', 'warning');
      return;
    }
    document.dispatchEvent(new CustomEvent('ai-enrich-request', { detail: { partCode } }));
  });
}

async function handleSave() {
  const idVal     = document.getElementById('edit-id').value;
  const partCode  = document.getElementById('edit-part-code').value.trim();

  if (!partCode) {
    showToast('Part Code is required', 'error');
    return;
  }

  const data = {
    part_code:    partCode,
    category:     document.getElementById('edit-category').value.trim(),
    subcategory:  document.getElementById('edit-subcategory').value.trim(),
    quantity:     parseInt(document.getElementById('edit-quantity').value) || 0,
    package:      document.getElementById('edit-package').value.trim(),
    manufacturer: document.getElementById('edit-manufacturer').value.trim(),
    mpn:          document.getElementById('edit-mpn').value.trim(),
    location:     document.getElementById('edit-location').value.trim(),
    voltage_max:  parseFloat(document.getElementById('edit-voltage-max').value) || null,
    current_max:  parseFloat(document.getElementById('edit-current-max').value) || null,
    description:  document.getElementById('edit-description').value.trim(),
    datasheet_url:document.getElementById('edit-datasheet-url').value.trim(),
    unit_price:   parseFloat(document.getElementById('edit-unit-price').value) || null,
    notes:        document.getElementById('edit-notes').value.trim(),
  };

  const saveBtn = document.getElementById('btn-save-component');
  saveBtn.disabled = true;

  try {
    if (idVal) {
      await updateComponent(Number(idVal), data);
      showToast('Component updated', 'success');
    } else {
      await addComponent(data);
      showToast('Component added', 'success');
    }
    document.getElementById('overlay-edit').style.display = 'none';
  } catch (err) {
    showToast('Save failed: ' + (err.message || err), 'error');
  } finally {
    saveBtn.disabled = false;
  }
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
      showToast('Component deleted', 'success');
      document.getElementById('overlay-confirm').style.display = 'none';
      document.getElementById('overlay-detail').style.display = 'none';
    } catch (err) {
      showToast('Delete failed: ' + (err.message || err), 'error');
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

  document.getElementById('btn-ai').addEventListener('click', () => {
    document.getElementById('overlay-ai').style.display = '';
    document.dispatchEvent(new CustomEvent('ai-modal-opened'));
  });

  document.getElementById('btn-backup-mgr').addEventListener('click', () => {
    document.getElementById('overlay-backup').style.display = '';
    document.dispatchEvent(new CustomEvent('backup-modal-opened'));
  });
}
