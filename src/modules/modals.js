import {
  state, addComponent, updateComponent, deleteComponent,
  showToast, refreshDatalistsGlobal
} from '../app.js';
import { initSortHeaders } from './table.js';
import { lookupComponent, categorizeByDescription } from './hardcoded_datasheet.js';
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
    setField('edit-resistance',  comp.resistance  || '');
    setField('edit-tolerance',   comp.tolerance   || '');
    setField('edit-power-rating',comp.power_rating ?? '');
    setImagePreview(comp.image_path || '');
  } else {
    title.textContent = 'Add Component';
    idEl.value = '';
    document.getElementById('form-edit').reset();
    setImagePreview('');
  }

  updateTypeFields(document.getElementById('edit-category').value);

  // Clear the built-in library search field
  const builtinInput = document.getElementById('builtin-search-input');
  if (builtinInput) {
    builtinInput.value = '';
    const builtinResults = document.getElementById('builtin-search-results');
    if (builtinResults) { builtinResults.style.display = 'none'; builtinResults.innerHTML = ''; }
  }

  document.getElementById('overlay-edit').style.display = '';
  setTimeout(() => document.getElementById('edit-part-code').focus(), 60);
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
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
  if (lblV) lblV.textContent = type === 'capacitor' ? 'Voltage Rating (V)' : 'Voltage Max (V)';
  if (lblI) lblI.textContent = type === 'transistor' ? 'Current Max / I_D (A)' : 'Current Max (A)';
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

  // Auto-clear 'Uncategorized' on focus; restore on blur if empty
  const catInput = document.getElementById('edit-category');
  catInput?.addEventListener('focus', function() {
    if (this.value === 'Uncategorized') this.value = '';
  });
  catInput?.addEventListener('blur', function() {
    if (!this.value.trim()) this.value = 'Uncategorized';
  });

  // Dynamic type fields when category changes
  catInput?.addEventListener('input', function() {
    updateTypeFields(this.value);
  });

  // Auto-fill: use Description text to suggest Category + Subcategory
  document.getElementById('btn-auto-desc')?.addEventListener('click', () => {
    const desc = document.getElementById('edit-description').value.trim();
    if (!desc) {
      showToast('Enter a description first', 'warning');
      return;
    }
    const result = categorizeByDescription(desc);
    if (!result) {
      showToast('No category match found for this description', 'info');
      return;
    }
    const catEl = document.getElementById('edit-category');
    const subEl = document.getElementById('edit-subcategory');
    if (result.category)    { catEl.value = result.category;    updateTypeFields(result.category); }
    if (result.subcategory) { subEl.value = result.subcategory; }
    showToast(`Category set from description: ${result.category}`, 'success');
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
    const curCat = document.getElementById('edit-category').value;
    if (data.category    && (!curCat || curCat === 'Uncategorized'))            setField('edit-category',     data.category);
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
        showToast('Unsupported image format. Use JPG, PNG, GIF, or WebP.', 'error');
        return;
      }
      // Sanitize part code: keep only alphanumeric, dash, underscore (no path separators)
      const rawCode  = document.getElementById('edit-part-code').value.trim() || 'image';
      const partCode = rawCode.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
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
    results.innerHTML = '<div class="builtin-dropdown-loading">Searching...</div>';

    _builtinDebounceTimer = setTimeout(async () => {
      try {
        const items = await invoke('search_builtin_library', { searchTerm: term });
        renderBuiltinResults(items, results);
      } catch (err) {
        results.innerHTML = '<div class="builtin-dropdown-empty">Search error: ' + escHtmlLocal(String(err)) + '</div>';
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
    container.innerHTML = '<div class="builtin-dropdown-empty">No matching components found</div>';
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
  updateTypeFields(comp.category || '');

  // Parse attributes JSON and fill dynamic fields
  let attrs = {};
  try {
    attrs = typeof comp.attributes === 'string' ? JSON.parse(comp.attributes || '{}') : (comp.attributes || {});
  } catch (_) { /* ignore parse errors */ }

  // Map well-known attribute keys to form fields
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

  showToast(`Applied data from built-in library: "${comp.part_code}"`, 'success');
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
