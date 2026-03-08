import { lookupComponent, categorizeByDescription }            from './hardcoded_datasheet.js';
import { state, updateComponent, showToast, escHtml }           from '../app.js';

/** Returns components that are in the Uncategorized bucket. */
function getUncategorized() {
  return (state.components || []).filter(
    c => !c.category || c.category === 'Uncategorized'
  );
}

/** Build suggestion list: [{comp, suggestion}] only where DB has a hit. */
function buildSuggestions(components) {
  const suggestions = [];
  for (const comp of components) {
    const hitByCode = lookupComponent(comp.part_code);
    const hitByDesc = !hitByCode ? categorizeByDescription(comp.description) : null;
    const hit       = hitByCode || hitByDesc;
    if (hit && hit.category && hit.category !== 'Uncategorized') {
      suggestions.push({
        comp, hit,
        source: hitByCode ? 'part-code' : 'description',
      });
    }
  }
  return suggestions;
}

function renderList(suggestions) {
  const tbody = document.getElementById('bulk-cat-tbody');
  if (!tbody) return;

  if (suggestions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">
      No Uncategorized components matched the built-in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = suggestions.map((s, i) => `
    <tr>
      <td style="text-align:center">
        <input type="checkbox" class="bulk-cb" data-idx="${i}" checked>
      </td>
      <td style="font-family:var(--font-mono);font-size:0.82rem">${escHtml(s.comp.part_code)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${escHtml(s.comp.description || s.comp.part_code)}</td>
      <td>
        <span class="badge" style="background:var(--accent-dim);color:var(--accent)">${escHtml(s.hit.category)}</span>
        ${s.hit.subcategory ? `<span style="color:var(--text-muted);font-size:0.78rem"> / ${escHtml(s.hit.subcategory)}</span>` : ''}
        <span style="font-size:0.68rem;color:var(--text-muted);margin-left:4px">(${s.source})</span>
      </td>
    </tr>
  `).join('');

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
      const updated = {
        ...comp,
        category:     hit.category,
        subcategory:  hit.subcategory  || comp.subcategory  || '',
        package:      hit.package      || comp.package      || '',
        manufacturer: hit.manufacturer || comp.manufacturer || '',
        description:  comp.description || hit.description   || '',
        datasheet_url:comp.datasheet_url|| hit.datasheet_url|| '',
        voltage_max:  comp.voltage_max  ?? hit.voltage_max  ?? null,
        current_max:  comp.current_max  ?? hit.current_max  ?? null,
      };

      await updateComponent(comp.id, updated);
      success++;
    } catch (err) {
      console.error('bulk categorize error:', comp.part_code, err);
      failed++;
    }
  }

  closeOverlay();
  if (failed === 0) {
    showToast(`Categorized ${success} component${success !== 1 ? 's' : ''} successfully`, 'success');
  } else {
    showToast(`Categorized ${success}, failed ${failed}`, 'warning');
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

  btnOpen.addEventListener('click', () => {
    const uncategorized = getUncategorized();
    if (uncategorized.length === 0) {
      showToast('No Uncategorized components found', 'info');
      return;
    }

    currentSuggestions = buildSuggestions(uncategorized);
    const totalUncategorized = uncategorized.length;
    const matchCount         = currentSuggestions.length;

    const subtitle = document.getElementById('bulk-cat-subtitle');
    if (subtitle) {
      subtitle.textContent =
        `${totalUncategorized} Uncategorized component${totalUncategorized !== 1 ? 's' : ''} found — ` +
        `${matchCount} matched in built-in database.`;
    }

    renderList(currentSuggestions);
    overlay.style.display = 'flex';
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

  overlay.addEventListener('change', e => {
    if (e.target.classList.contains('bulk-cb')) {
      updateApplyButton(currentSuggestions);
    }
  });
}
