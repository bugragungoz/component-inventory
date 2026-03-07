import {
  state, addComponent, updateComponent, deleteComponent,
  showToast, refreshDatalistsGlobal
} from '../app.js';
import { initSortHeaders } from './table.js';
import { lookupComponent } from './hardcoded_datasheet.js';
import { readFile, copyFile, mkdir } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

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
    setImagePreview(comp.image_path || '');
  } else {
    title.textContent = 'Add Component';
    idEl.value = '';
    document.getElementById('form-edit').reset();
    setImagePreview('');
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

  // Hardcoded DB lookup button
  document.getElementById('btn-db-lookup').addEventListener('click', () => {
    const partCode = document.getElementById('edit-part-code').value.trim();
    if (!partCode) {
      showToast('Enter a Part Code first', 'warning');
      return;
    }
    const data = lookupComponent(partCode);
    if (!data) {
      showToast(`"${partCode}" not found in built-in database`, 'info');
      return;
    }
    if (data.category    && !document.getElementById('edit-category').value)    setField('edit-category',     data.category);
    if (data.subcategory && !document.getElementById('edit-subcategory').value) setField('edit-subcategory',  data.subcategory);
    if (data.package     && !document.getElementById('edit-package').value)     setField('edit-package',      data.package);
    if (data.manufacturer&& !document.getElementById('edit-manufacturer').value)setField('edit-manufacturer', data.manufacturer);
    if (data.description && !document.getElementById('edit-description').value) setField('edit-description',  data.description);
    if (data.datasheet_url&&!document.getElementById('edit-datasheet-url').value)setField('edit-datasheet-url',data.datasheet_url);
    if (data.voltage_max != null && !document.getElementById('edit-voltage-max').value)
      setField('edit-voltage-max', data.voltage_max);
    if (data.current_max != null && !document.getElementById('edit-current-max').value)
      setField('edit-current-max', data.current_max);
    showToast(`Data applied from built-in database for "${partCode}"`, 'success');
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
    image_path:   document.getElementById('edit-image-path').value.trim(),
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
// Image attachment helpers
// ============================================================
async function setImagePreview(imagePath) {
  const pathInput  = document.getElementById('edit-image-path');
  const preview    = document.getElementById('image-preview');
  const clearBtn   = document.getElementById('btn-clear-image');
  const placeholder = document.getElementById('image-preview-wrap').querySelector('svg');

  pathInput.value = imagePath;

  if (imagePath) {
    try {
      const bytes = await readFile(imagePath);
      const ext   = imagePath.split('.').pop().toLowerCase();
      const mime  = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png';
      const blob  = new Blob([bytes], { type: mime });
      const url   = URL.createObjectURL(blob);
      preview.src           = url;
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

      const ext      = selected.split('.').pop().toLowerCase();
      const partCode = document.getElementById('edit-part-code').value.trim() || 'image';
      const destPath = imagesDir + '/' + partCode + '_' + Date.now() + '.' + ext;

      await copyFile(selected, destPath);
      await setImagePreview(destPath);
    } catch (err) {
      showToast('Image pick failed: ' + (err.message || err), 'error');
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

  document.getElementById('btn-backup-mgr').addEventListener('click', () => {
    document.getElementById('overlay-backup').style.display = '';
    document.dispatchEvent(new CustomEvent('backup-modal-opened'));
  });
}
