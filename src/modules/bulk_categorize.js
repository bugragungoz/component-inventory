import { lookupComponent, categorizeByDescription }            from './hardcoded_datasheet.js';
import { state, updateComponent, showToast, escHtml }           from '../app.js';
import { t }                                                    from './i18n.js';

/** Returns components that are in the Uncategorized bucket. */
function getUncategorized() {
  return (state.components || []).filter(
    c => !c.category || c.category === 'Uncategorized'
  );
}

/**
 * Detects components likely placed in the WRONG category.
 * Flags only when there is strong external evidence:
 *   - built-in DB part-code lookup returns a different category, OR
 *   - heuristic returns 'high' confidence and disagrees with current category.
 * The user can deselect any row before applying so false positives are cheap.
 */
function getMisclassified() {
  const out = [];
  for (const comp of (state.components || [])) {
    if (!comp.category || comp.category === 'Uncategorized') continue;
    const dbHit = lookupComponent(comp.part_code);
    if (dbHit && dbHit.category && dbHit.category !== comp.category) {
      out.push({
        comp,
        hit: dbHit,
        source: 'part-code',
        confidence: 'high',
        anomaly: true,
        reason: 'db-mismatch',
      });
      continue;
    }
    const heur = heuristicClassify(comp);
    if (heur && heur.confidence === 'high' && heur.category !== comp.category) {
      out.push({
        comp,
        hit: heur,
        source: 'heuristic',
        confidence: 'high',
        anomaly: true,
        reason: 'heuristic-mismatch',
      });
    }
  }
  return out;
}

/**
 * Heuristic classifier used as a tertiary fallback after the part-code DB
 * lookup and description rule engine. Examines the part code, description,
 * package, manufacturer and notes for shape patterns.
 */
function heuristicClassify(comp) {
  const blob = [
    comp.part_code, comp.description, comp.subcategory,
    comp.package, comp.manufacturer, comp.notes
  ].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');

  // Resistor: standard codes with kOhm/M/R suffix or starts with R-/RES
  if (/(\b\d+(\.\d+)?[krm]\b)|res-|resistor|direnc|\b\d+r\d*\b/.test(blob)) {
    return { category: 'Resistors', subcategory: 'Through-Hole', confidence: 'medium' };
  }
  // Capacitor: uF / nF / pF
  if (/(\d+(\.\d+)?\s?(uf|nf|pf|mf)\b)|cap-|capacitor|kondans/.test(blob)) {
    return { category: 'Capacitors', subcategory: 'Ceramic', confidence: 'medium' };
  }
  // Inductor: uH / mH
  if (/(\d+(\.\d+)?\s?(uh|mh|nh)\b)|inductor|bobin|choke/.test(blob)) {
    return { category: 'Inductors', subcategory: 'Inductor', confidence: 'medium' };
  }
  // BJT NPN/PNP heuristics
  if (/\bnpn\b/.test(blob)) return { category: 'Transistors', subcategory: 'BJT NPN', confidence: 'high' };
  if (/\bpnp\b/.test(blob)) return { category: 'Transistors', subcategory: 'BJT PNP', confidence: 'high' };
  if (/mosfet|n-?ch|p-?ch/.test(blob)) return { category: 'Transistors', subcategory: 'Power MOSFET', confidence: 'high' };
  if (/igbt/.test(blob))    return { category: 'Transistors', subcategory: 'IGBT', confidence: 'high' };
  // Diode patterns
  if (/(^|\b)1n\d{3,4}/.test(blob))  return { category: 'Diodes', subcategory: 'Rectifier',  confidence: 'high' };
  if (/zener/.test(blob))             return { category: 'Diodes', subcategory: 'Zener',      confidence: 'high' };
  if (/schottky/.test(blob))          return { category: 'Diodes', subcategory: 'Schottky',   confidence: 'high' };
  if (/diode|diyot/.test(blob))       return { category: 'Diodes', subcategory: 'Rectifier',  confidence: 'medium' };
  // LEDs
  if (/\bled\b/.test(blob))           return { category: 'Diodes', subcategory: 'LED',        confidence: 'high' };
  // Common ICs
  if (/\b(stm32|atmega|attiny|esp32|esp8266|pic\d+|nrf\d+)\b/.test(blob))
    return { category: 'ICs', subcategory: 'Microcontroller', confidence: 'high' };
  if (/\b(lm78|lm79|lm317|ams1117|ld1117|mcp1700)\b/.test(blob))
    return { category: 'ICs', subcategory: 'Linear Regulator', confidence: 'high' };
  if (/\b(ne555|sa555)\b/.test(blob))
    return { category: 'ICs', subcategory: 'Timer', confidence: 'high' };
  if (/\b(lm358|lm324|tl08\d|tl07\d|op-?amp)\b/.test(blob))
    return { category: 'ICs', subcategory: 'Op-Amp', confidence: 'high' };
  // Connectors
  if (/header|jst|molex|terminal|connector|konektor/.test(blob))
    return { category: 'Connectors', subcategory: 'Pin Header', confidence: 'medium' };
  // Crystals
  if (/crystal|kristal|oscillat|mhz|khz/.test(blob))
    return { category: 'Crystals', subcategory: 'Crystal', confidence: 'medium' };
  // Sensors
  if (/sensor|sensor|dht\d|ds18|bmp\d|mpu\d/.test(blob))
    return { category: 'Sensors', subcategory: 'Temperature', confidence: 'medium' };
  return null;
}

/** Build suggestion list with confidence metadata. */
function buildSuggestions(components) {
  const suggestions = [];
  for (const comp of components) {
    const hitByCode = lookupComponent(comp.part_code);
    let source = null, hit = null, confidence = 'low';
    if (hitByCode) { hit = hitByCode; source = 'part-code'; confidence = 'high'; }
    if (!hit) {
      const hitByDesc = categorizeByDescription(comp.description);
      if (hitByDesc) { hit = hitByDesc; source = 'description'; confidence = 'medium'; }
    }
    if (!hit) {
      const heur = heuristicClassify(comp);
      if (heur) { hit = heur; source = 'heuristic'; confidence = heur.confidence || 'low'; }
    }
    if (hit && hit.category && hit.category !== 'Uncategorized') {
      suggestions.push({ comp, hit, source, confidence });
    }
  }
  return suggestions;
}

function renderList(suggestions) {
  const tbody = document.getElementById('bulk-cat-tbody');
  if (!tbody) return;

  if (suggestions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">
      ${t('bulk.empty')}</td></tr>`;
    return;
  }

  // Higher-confidence rows are pre-checked; low-confidence rows are unchecked
  // so the user must opt in.
  tbody.innerHTML = suggestions.map((s, i) => {
    const checkedAttr = (s.confidence === 'high' || s.confidence === 'medium') ? 'checked' : '';
    const confLabel = t('bulk.confidence.' + (s.confidence || 'low'));
    const confColor = s.confidence === 'high' ? 'var(--accent-green)'
                    : s.confidence === 'medium' ? 'var(--accent-amber)'
                    : 'var(--text-tertiary)';
    const rowClass = s.anomaly ? 'bulk-row-anomaly' : '';
    const currentBadge = s.anomaly
      ? `<span style="font-size:0.7rem;color:var(--text-tertiary);margin-right:6px;text-decoration:line-through">${escHtml(s.comp.category || '')}</span>`
      : '';
    return `
    <tr class="${rowClass}">
      <td style="text-align:center">
        <input type="checkbox" class="bulk-cb" data-idx="${i}" ${checkedAttr}>
      </td>
      <td style="font-family:var(--font-mono);font-size:0.82rem">${escHtml(s.comp.part_code)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${escHtml(s.comp.description || s.comp.part_code)}</td>
      <td>
        ${currentBadge}
        <span class="badge" style="background:var(--accent-dim);color:var(--accent)">${escHtml(s.hit.category)}</span>
        ${s.hit.subcategory ? `<span style="color:var(--text-muted);font-size:0.78rem"> / ${escHtml(s.hit.subcategory)}</span>` : ''}
        <span style="font-size:0.68rem;color:${confColor};margin-left:6px">[${escHtml(confLabel)}]</span>
        <span style="font-size:0.62rem;color:var(--text-tertiary);margin-left:4px">(${escHtml(s.source)})</span>
      </td>
    </tr>`;
  }).join('');

  updateApplyButton(suggestions);
}

function updateApplyButton(suggestions) {
  const btn   = document.getElementById('btn-bulk-apply');
  const cbs   = document.querySelectorAll('.bulk-cb');
  const count = Array.from(cbs).filter(cb => cb.checked).length;
  if (btn) btn.textContent = t('bulk.btn.apply', { n: count });
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
    showToast(t('toast.bulkOk', { n: success }), 'success');
  } else {
    showToast(t('toast.bulkPart', { ok: success, fail: failed }), 'warning');
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
    const anomalies     = getMisclassified();

    if (uncategorized.length === 0 && anomalies.length === 0) {
      showToast(t('toast.bulkNone'), 'info');
      return;
    }

    const baseSuggestions = buildSuggestions(uncategorized);
    // Anomalies first (highest user value), then standard suggestions
    currentSuggestions = [...anomalies, ...baseSuggestions];

    const subtitle = document.getElementById('bulk-cat-subtitle');
    if (subtitle) {
      const base = t('bulk.subtitle', {
        total: uncategorized.length,
        match: baseSuggestions.length,
      });
      subtitle.textContent = anomalies.length > 0
        ? base + '  -  ' + t('anomaly.btn.open', { n: anomalies.length })
        : base;
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
