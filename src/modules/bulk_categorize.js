import { lookupComponent, categorizeByDescription }            from './hardcoded_datasheet.js';
import { state, updateComponent, showToast, escHtml }           from '../app.js';
import { getSelectedIds }                                       from './table.js';
import { invoke }                                               from '@tauri-apps/api/core';

/** Returns components based on the selected scope. */
function getTargetComponents(scope) {
  if (scope === 'selected') {
    const ids = getSelectedIds();
    if (ids.size === 0) return [];
    return (state.components || []).filter(c => ids.has(c.id));
  }
  if (scope === 'all') return (state.components || []).slice();
  return (state.components || []).filter(
    c => !c.category || c.category === 'Uncategorized'
  );
}

/**
 * Build suggestion list using BOTH the hardcoded DB and patched.db (via Tauri).
 * Returns [{comp, hit, source}] where `hit` contains all enrichment data.
 */
async function buildSuggestions(components, scope) {
  const suggestions = [];

  // 1. Batch-lookup in patched.db via Tauri backend
  const partCodes = components.map(c => c.part_code).filter(Boolean);
  let builtinMap = {};
  try {
    const builtinHits = await invoke('batch_lookup_builtin', { partCodes });
    for (const hit of builtinHits) {
      // Normalize key for matching
      const key = (hit.part_code || '').toUpperCase().replace(/[-\s.]/g, '');
      builtinMap[key] = hit;
    }
  } catch (err) {
    console.warn('batch_lookup_builtin failed, falling back to hardcoded DB:', err);
  }

  for (const comp of components) {
    const normKey = (comp.part_code || '').toUpperCase().replace(/[-\s.]/g, '');

    // Try patched.db first (richer data)
    const builtinHit = builtinMap[normKey] || findBestBuiltinMatch(normKey, builtinMap);
    // Fallback to hardcoded DB
    const hardcodedHit = lookupComponent(comp.part_code);
    const descHit = !hardcodedHit ? categorizeByDescription(comp.description) : null;

    const hit = mergeHits(builtinHit, hardcodedHit || descHit);
    if (!hit) continue;

    const source = builtinHit ? 'patched.db' : (hardcodedHit ? 'part-code' : 'description');

    // Check if this component actually needs any changes
    const needsCat = !comp.category || comp.category === 'Uncategorized';
    const needsSpecs = needsElectricalFill(comp, hit);
    const needsDatasheet = !comp.datasheet_url && hit.datasheet_url;

    // In "all" or "selected" mode, skip if nothing would change
    if (scope !== 'uncategorized') {
      const catMatch = (comp.category || '') === (hit.category || '') &&
                       (comp.subcategory || '') === (hit.subcategory || '');
      if (catMatch && !needsSpecs && !needsDatasheet) continue;
    } else {
      // "uncategorized" mode: only include if category is empty/uncategorized OR needs specs
      if (!needsCat && !needsSpecs && !needsDatasheet) continue;
    }

    suggestions.push({ comp, hit, source, needsCat, needsSpecs, needsDatasheet });
  }
  return suggestions;
}

/** Check if a component is missing electrical specs that the hit can fill */
function needsElectricalFill(comp, hit) {
  if (!hit) return false;
  if (comp.voltage_max == null && hit.voltage_max != null) return true;
  if (comp.current_max == null && hit.current_max != null) return true;
  if ((!comp.resistance || comp.resistance === '') && hit.resistance) return true;
  if ((!comp.tolerance || comp.tolerance === '') && hit.tolerance) return true;
  if (comp.power_rating == null && hit.power_rating != null) return true;
  // Check attributes (JSON)
  if (hit.attributes && hit.attributes !== '{}') {
    const compAttrs = parseAttrs(comp.attributes);
    const hitAttrs = parseAttrs(hit.attributes);
    for (const key of Object.keys(hitAttrs)) {
      if (!compAttrs[key] && hitAttrs[key]) return true;
    }
  }
  return false;
}

function parseAttrs(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (_) { return {}; }
}

/** Find best match from builtin map using prefix matching */
function findBestBuiltinMatch(normKey, builtinMap) {
  if (!normKey) return null;
  for (const [key, val] of Object.entries(builtinMap)) {
    if (normKey.startsWith(key) || key.startsWith(normKey)) return val;
  }
  return null;
}

/** Merge a patched.db hit with a hardcoded hit, preferring patched.db data */
function mergeHits(builtinHit, fallbackHit) {
  if (!builtinHit && !fallbackHit) return null;
  if (!builtinHit) return fallbackHit;
  if (!fallbackHit) return builtinHit;
  // Merge: prefer builtinHit for all fields, fill gaps from fallbackHit
  return {
    category:      builtinHit.category      || fallbackHit.category      || '',
    subcategory:   builtinHit.subcategory   || fallbackHit.subcategory   || '',
    package:       builtinHit.package       || fallbackHit.package       || '',
    manufacturer:  builtinHit.manufacturer  || fallbackHit.manufacturer  || '',
    description:   builtinHit.description   || fallbackHit.description   || '',
    datasheet_url: builtinHit.datasheet_url || fallbackHit.datasheet_url || '',
    voltage_max:   builtinHit.voltage_max   ?? fallbackHit.voltage_max   ?? null,
    current_max:   builtinHit.current_max   ?? fallbackHit.current_max   ?? null,
    resistance:    builtinHit.resistance    || fallbackHit.resistance    || '',
    tolerance:     builtinHit.tolerance     || fallbackHit.tolerance     || '',
    power_rating:  builtinHit.power_rating  ?? fallbackHit.power_rating  ?? null,
    attributes:    builtinHit.attributes    || fallbackHit.attributes    || '{}',
  };
}

function renderList(suggestions) {
  const tbody = document.getElementById('bulk-cat-tbody');
  if (!tbody) return;

  if (suggestions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">
      No components matched the built-in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = suggestions.map((s, i) => {
    const currentCat = s.comp.category || 'Uncategorized';
    const currentSub = s.comp.subcategory || '';
    const currentLabel = currentSub ? `${currentCat} / ${currentSub}` : currentCat;

    const changes = [];
    if (s.needsCat) changes.push('category');
    if (s.needsSpecs) changes.push('specs');
    if (s.needsDatasheet) changes.push('datasheet');
    const changeStr = changes.join(', ');

    return `
    <tr>
      <td style="text-align:center">
        <input type="checkbox" class="bulk-cb" data-idx="${i}" checked>
      </td>
      <td style="font-family:var(--font-mono);font-size:0.82rem">${escHtml(s.comp.part_code)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${escHtml(currentLabel)}</td>
      <td>
        <span class="badge" style="background:var(--accent-dim);color:var(--accent)">${escHtml(s.hit.category)}</span>
        ${s.hit.subcategory ? `<span style="color:var(--text-muted);font-size:0.78rem"> / ${escHtml(s.hit.subcategory)}</span>` : ''}
        <span style="font-size:0.68rem;color:var(--text-muted);margin-left:4px">(${s.source})</span>
      </td>
      <td style="font-size:0.76rem;color:var(--text-muted)">${escHtml(changeStr)}</td>
    </tr>`;
  }).join('');

  updateApplyButton(suggestions);
}

function updateApplyButton(suggestions) {
  const btn   = document.getElementById('btn-bulk-apply');
  const cbs   = document.querySelectorAll('.bulk-cb');
  const count = Array.from(cbs).filter(cb => cb.checked).length;
  if (btn) btn.textContent = `Apply Selected (${count})`;
  if (btn) btn.disabled = count === 0;
}

async function applySelected(suggestions) {
  const cbs      = document.querySelectorAll('.bulk-cb');
  const selected = suggestions.filter((_, i) => cbs[i]?.checked);

  if (selected.length === 0) return;

  const btn = document.getElementById('btn-bulk-apply');
  if (btn) { btn.disabled = true; btn.textContent = 'Applying…'; }

  let success = 0;
  let failed  = 0;

  for (const { comp, hit } of selected) {
    try {
      // Merge existing attributes with hit attributes
      const existingAttrs = parseAttrs(comp.attributes);
      const hitAttrs = parseAttrs(hit.attributes);
      const mergedAttrs = { ...existingAttrs };
      for (const [key, val] of Object.entries(hitAttrs)) {
        if (!(key in mergedAttrs) && val != null && val !== '') mergedAttrs[key] = val;
      }

      const updated = {
        ...comp,
        category:      hit.category     || comp.category     || '',
        subcategory:   hit.subcategory  || comp.subcategory  || '',
        package:       hit.package      || comp.package      || '',
        manufacturer:  hit.manufacturer || comp.manufacturer || '',
        description:   comp.description || hit.description   || '',
        datasheet_url: comp.datasheet_url || hit.datasheet_url || '',
        voltage_max:   comp.voltage_max  ?? hit.voltage_max  ?? null,
        current_max:   comp.current_max  ?? hit.current_max  ?? null,
        resistance:    comp.resistance   || hit.resistance   || '',
        tolerance:     comp.tolerance    || hit.tolerance     || '',
        power_rating:  comp.power_rating ?? hit.power_rating ?? null,
        attributes:    mergedAttrs,
      };

      await updateComponent(comp.id, updated);
      success++;
    } catch (err) {
      console.error('auto apply error:', comp.part_code, err);
      failed++;
    }
  }

  closeOverlay();
  if (failed === 0) {
    showToast(`Auto-filled ${success} component${success !== 1 ? 's' : ''} successfully`, 'success');
  } else {
    showToast(`Applied ${success}, failed ${failed}`, 'warning');
  }
}

function closeOverlay() {
  const overlay = document.getElementById('overlay-bulk-cat');
  if (overlay) overlay.style.display = 'none';
}

// ================================================================
// Public init — call once from app.js
// ================================================================
export function initBulkCategorize() {
  const btnOpen   = document.getElementById('btn-bulk-cat');
  const overlay   = document.getElementById('overlay-bulk-cat');
  const btnApply  = document.getElementById('btn-bulk-apply');
  const btnSelAll = document.getElementById('btn-bulk-sel-all');
  const btnDesel  = document.getElementById('btn-bulk-desel');
  const btnClose       = document.getElementById('btn-bulk-cat-close');
  const btnCloseFooter = document.getElementById('btn-bulk-cat-close-footer');

  if (!btnOpen || !overlay) return;

  let currentSuggestions = [];

  async function refreshList() {
    const scopeEl = document.querySelector('input[name="bulk-cat-scope"]:checked');
    const scope   = scopeEl ? scopeEl.value : 'selected';

    // Check if "selected" scope is chosen but no components are selected
    if (scope === 'selected') {
      const ids = getSelectedIds();
      if (ids.size === 0) {
        showToast('Please select components first using the Select mode, then click Auto.', 'warning', 5000);
        return;
      }
    }

    const targets = getTargetComponents(scope);
    if (targets.length === 0) {
      showToast(scope === 'all'
        ? 'No components in inventory'
        : scope === 'selected'
          ? 'No components selected'
          : 'No Uncategorized components found', 'info');
      return;
    }

    // Show loading state
    const tbody = document.getElementById('bulk-cat-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Searching built-in database…</td></tr>';
    overlay.style.display = 'flex';

    currentSuggestions = await buildSuggestions(targets, scope);
    const totalCount   = targets.length;
    const matchCount   = currentSuggestions.length;

    const subtitle = document.getElementById('bulk-cat-subtitle');
    if (subtitle) {
      const label = scope === 'all' ? 'component' : scope === 'selected' ? 'selected component' : 'Uncategorized component';
      subtitle.textContent =
        `${totalCount} ${label}${totalCount !== 1 ? 's' : ''} found — ` +
        `${matchCount} matched in built-in database.`;
    }

    renderList(currentSuggestions);
  }

  btnOpen.addEventListener('click', refreshList);

  // Re-scan when scope radio changes
  overlay.addEventListener('change', e => {
    if (e.target.name === 'bulk-cat-scope') {
      refreshList();
    } else if (e.target.classList.contains('bulk-cb')) {
      updateApplyButton(currentSuggestions);
    }
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOverlay();
  });

  btnClose?.addEventListener('click', closeOverlay);
  btnCloseFooter?.addEventListener('click', closeOverlay);

  btnApply?.addEventListener('click', () => applySelected(currentSuggestions));

  btnSelAll?.addEventListener('click', () => {
    document.querySelectorAll('.bulk-cb').forEach(cb => { cb.checked = true; });
    updateApplyButton(currentSuggestions);
  });

  btnDesel?.addEventListener('click', () => {
    document.querySelectorAll('.bulk-cb').forEach(cb => { cb.checked = false; });
    updateApplyButton(currentSuggestions);
  });

  // Header checkbox toggles all rows
  document.getElementById('bulk-cb-header')?.addEventListener('change', e => {
    document.querySelectorAll('.bulk-cb').forEach(cb => { cb.checked = e.target.checked; });
    updateApplyButton(currentSuggestions);
  });

  // Update "Selected (N)" label reactively
  function updateSelectedLabel() {
    const radio = document.querySelector('input[name="bulk-cat-scope"][value="selected"]');
    if (!radio) return;
    const ids = getSelectedIds();
    const label = radio.parentElement;
    if (label) {
      // Update only the text node after the radio input, preserving the input element
      const textNode = Array.from(label.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = ` Selected (${ids.size})`;
    }
  }
  updateSelectedLabel();
  // Re-check when overlay becomes visible
  const observer = new MutationObserver(() => {
    if (overlay.style.display !== 'none') updateSelectedLabel();
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ['style'] });
}
