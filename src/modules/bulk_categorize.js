import { lookupComponent, lookupCanonical, categorizeByDescription } from './hardcoded_datasheet.js';
import { state, updateComponent, deleteComponent, showToast, escHtml } from '../app.js';
import { t }                                                    from './i18n.js';
import { normaliseCategory }                                    from './modals.js';

/**
 * Detect URLs that are NOT direct datasheet links but Google searches /
 * marketing pages. Used to know when we may safely overwrite the datasheet.
 */
function isWeakDatasheetUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.toLowerCase().trim();
  if (!u) return true;
  if (u.includes('google.com/search')) return true;
  if (u.includes('duckduckgo.com'))    return true;
  if (u.includes('?q=') && !u.includes('.pdf')) return true;
  return false;
}

/** Returns true when the lookup hit's category is consistent with the component. */
function categoryConsistent(comp, hit) {
  if (!hit || !hit.category) return false;
  if (!comp.category || comp.category === 'Uncategorized') return true;
  return comp.category === hit.category;
}

/**
 * Scan all components for ones missing a *real* datasheet URL where the
 * built-in DB has a confident match (exact or prefix DB key, never pattern-only)
 * AND the categories agree (or the component is uncategorized).
 */
function findDatasheetBackfills() {
  const out = [];
  for (const comp of (state.components || [])) {
    if (!isWeakDatasheetUrl(comp.datasheet_url)) continue;
    const found = lookupCanonical(comp.part_code);
    if (!found || !found.data || !found.data.datasheet_url) continue;
    if (found.match === 'pattern') continue;
    if (!categoryConsistent(comp, found.data)) continue;
    out.push({
      comp,
      hit: { datasheet_url: found.data.datasheet_url },
      source: 'datasheet-backfill',
      confidence: found.match === 'exact' ? 'high' : 'medium',
      action: 'datasheet',
    });
  }
  return out;
}

/**
 * Detect components whose category string is a non-canonical alias of a
 * known main category (e.g. "Diode" -> "Diodes", "MOSFETs" -> "Transistors").
 * Returns suggestion rows that only rewrite the category field.
 */
function findCategoryNormalizations() {
  const out = [];
  for (const comp of (state.components || [])) {
    if (!comp.category) continue;
    if (comp.category === 'Uncategorized') continue;
    const canonical = normaliseCategory(comp.category);
    if (!canonical || canonical === comp.category) continue;
    out.push({
      comp,
      hit: { category: canonical, subcategory: comp.subcategory || '' },
      source: 'taxonomy',
      confidence: 'high',
      action: 'normalize-cat',
    });
  }
  return out;
}

/**
 * Detect duplicate components that share a canonical DB key.
 * Example: 7805 + L7805 + LM7805 -> canonical "LM7805".
 * Only groups when BOTH:
 *   - canonical lookup is exact or prefix (deterministic), AND
 *   - all members share the same category (or uncategorized).
 * Returns merge proposals: { canonicalCode, members: [comp...], totalQty }
 */
function findDuplicateGroups() {
  const groups = new Map();
  for (const comp of (state.components || [])) {
    const found = lookupCanonical(comp.part_code);
    if (!found || !found.canonical) continue;
    if (found.match === 'pattern') continue;
    if (!categoryConsistent(comp, found.data)) continue;
    const key = found.canonical;
    const list = groups.get(key) || { canonical: key, data: found.data, members: [] };
    list.members.push(comp);
    groups.set(key, list);
  }
  const proposals = [];
  for (const g of groups.values()) {
    if (g.members.length < 2) continue;
    const totalQty = g.members.reduce((s, m) => s + (Number(m.quantity) || 0), 0);
    proposals.push({
      canonical: g.canonical,
      data: g.data,
      members: g.members,
      totalQty,
      action: 'merge',
      confidence: 'high',
      source: 'duplicate-merge',
    });
  }
  return proposals;
}

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

function renderActionCell(s) {
  const confLabel = t('bulk.confidence.' + (s.confidence || 'low'));
  const confColor = s.confidence === 'high' ? 'var(--accent-green)'
                  : s.confidence === 'medium' ? 'var(--accent-amber)'
                  : 'var(--text-tertiary)';
  const tail =
    `<span style="font-size:0.68rem;color:${confColor};margin-left:6px">[${escHtml(confLabel)}]</span>` +
    `<span style="font-size:0.62rem;color:var(--text-tertiary);margin-left:4px">(${escHtml(s.source)})</span>`;

  if (s.action === 'datasheet') {
    return (
      `<span class="badge" style="background:var(--accent-blue-dim,var(--accent-dim));color:var(--accent-blue,var(--accent))">` +
      t('bulk.action.datasheet') + `</span>` +
      `<span style="color:var(--text-muted);font-size:0.74rem;margin-left:6px;font-family:var(--font-mono)">` +
      escHtml((s.hit.datasheet_url || '').slice(0, 60)) + `</span>` + tail
    );
  }
  if (s.action === 'normalize-cat') {
    return (
      `<span class="badge" style="background:var(--accent-dim);color:var(--accent)">` +
      t('bulk.action.taxonomy') + `</span>` +
      `<span style="color:var(--text-muted);font-size:0.74rem;margin-left:6px">` +
      `<span style="text-decoration:line-through;color:var(--text-tertiary)">${escHtml(s.comp.category)}</span> ` +
      `&rarr; <strong>${escHtml(s.hit.category)}</strong></span>` + tail
    );
  }
  if (s.action === 'merge') {
    const memberLabels = s.members.map(m => escHtml(m.part_code)).join(', ');
    return (
      `<span class="badge" style="background:var(--accent-amber-dim);color:var(--accent-amber)">` +
      t('bulk.action.merge') + `</span>` +
      `<span style="color:var(--text-muted);font-size:0.74rem;margin-left:6px"> ${escHtml(s.canonical)} ` +
      ` <span style="color:var(--text-tertiary)">&larr;</span> ` + memberLabels + ` (` + s.totalQty + `)</span>` + tail
    );
  }
  // categorize / anomaly default
  const currentBadge = s.anomaly
    ? `<span style="font-size:0.7rem;color:var(--text-tertiary);margin-right:6px;text-decoration:line-through">${escHtml(s.comp.category || '')}</span>`
    : '';
  return (
    currentBadge +
    `<span class="badge" style="background:var(--accent-dim);color:var(--accent)">${escHtml(s.hit.category)}</span>` +
    (s.hit.subcategory ? `<span style="color:var(--text-muted);font-size:0.78rem"> / ${escHtml(s.hit.subcategory)}</span>` : '') +
    tail
  );
}

function renderList(suggestions) {
  const tbody = document.getElementById('bulk-cat-tbody');
  if (!tbody) return;

  if (suggestions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">
      ${t('bulk.empty')}</td></tr>`;
    return;
  }

  tbody.innerHTML = suggestions.map((s, i) => {
    const checkedAttr = (s.confidence === 'high' || s.confidence === 'medium') ? 'checked' : '';
    const rowClass = s.anomaly ? 'bulk-row-anomaly'
                  : s.action === 'merge' ? 'bulk-row-merge'
                  : s.action === 'datasheet' ? 'bulk-row-datasheet' : '';
    const partLabel = s.action === 'merge'
      ? s.members.map(m => m.part_code).join(' + ')
      : s.comp?.part_code || '';
    const descLabel = s.action === 'merge'
      ? t('bulk.merge.summary', { n: s.members.length, q: s.totalQty })
      : (s.comp?.description || s.comp?.part_code || '');
    return `
    <tr class="${rowClass}">
      <td style="text-align:center">
        <input type="checkbox" class="bulk-cb" data-idx="${i}" ${checkedAttr}>
      </td>
      <td style="font-family:var(--font-mono);font-size:0.82rem">${escHtml(partLabel)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${escHtml(descLabel)}</td>
      <td>${renderActionCell(s)}</td>
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
  if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }

  let success = 0;
  let failed  = 0;

  for (const s of selected) {
    try {
      if (s.action === 'datasheet') {
        await updateComponent(s.comp.id, { ...s.comp, datasheet_url: s.hit.datasheet_url });
        success++;
        continue;
      }

      if (s.action === 'normalize-cat') {
        await updateComponent(s.comp.id, { ...s.comp, category: s.hit.category });
        success++;
        continue;
      }

      if (s.action === 'merge') {
        // Merge strategy:
        //   - Pick the member that already matches the canonical part_code
        //     if any; otherwise use the first member as keeper.
        //   - Sum quantities.
        //   - Prefer non-empty fields from the keeper, then from members,
        //     finally from the DB hit.
        //   - Rename the keeper to the canonical part_code.
        //   - Delete the other members.
        const members = s.members.slice();
        const canonical = s.canonical;
        let keeper = members.find(m => normaliseSimple(m.part_code) === canonical);
        if (!keeper) keeper = members[0];
        const others = members.filter(m => m.id !== keeper.id);

        const merged = { ...keeper };
        merged.part_code   = canonical;
        merged.quantity    = s.totalQty;
        // Prefer keeper's non-empty values, then any member's value, else DB.
        const fields = ['category','subcategory','package','manufacturer','mpn',
                        'description','datasheet_url','voltage_max','current_max',
                        'resistance','tolerance','power_rating','notes','location','unit_price'];
        for (const f of fields) {
          if (merged[f] != null && merged[f] !== '') continue;
          for (const m of others) {
            if (m[f] != null && m[f] !== '') { merged[f] = m[f]; break; }
          }
          if ((merged[f] == null || merged[f] === '') && s.data && s.data[f] != null) {
            merged[f] = s.data[f];
          }
        }
        // Strengthen weak datasheet URL with the canonical one if available
        if (s.data?.datasheet_url && (!merged.datasheet_url || isWeakDatasheetUrl(merged.datasheet_url))) {
          merged.datasheet_url = s.data.datasheet_url;
        }

        await updateComponent(keeper.id, merged);
        for (const m of others) {
          try { await deleteComponent(m.id); } catch (err) { console.warn('merge delete failed:', err); }
        }
        success++;
        continue;
      }

      // Default: categorize / anomaly fix - fill empty fields from hit
      const comp = s.comp;
      const hit  = s.hit;
      const updated = {
        ...comp,
        category:     hit.category,
        subcategory:  hit.subcategory  || comp.subcategory  || '',
        package:      hit.package      || comp.package      || '',
        manufacturer: hit.manufacturer || comp.manufacturer || '',
        description:  comp.description || hit.description   || '',
        datasheet_url: (isWeakDatasheetUrl(comp.datasheet_url) && hit.datasheet_url) ? hit.datasheet_url : (comp.datasheet_url || hit.datasheet_url || ''),
        voltage_max:  comp.voltage_max  ?? hit.voltage_max  ?? null,
        current_max:  comp.current_max  ?? hit.current_max  ?? null,
      };
      await updateComponent(comp.id, updated);
      success++;
    } catch (err) {
      console.error('bulk apply error:', s, err);
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

function normaliseSimple(s) {
  return String(s || '').toUpperCase().replace(/[\s\-_.]/g, '');
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
    const uncategorized    = getUncategorized();
    const anomalies        = getMisclassified();
    const taxonomyFixes    = findCategoryNormalizations();
    const datasheetFills   = findDatasheetBackfills();
    const dedupeGroups     = findDuplicateGroups();

    if (uncategorized.length === 0 && anomalies.length === 0 &&
        datasheetFills.length === 0 && dedupeGroups.length === 0 &&
        taxonomyFixes.length === 0) {
      showToast(t('toast.bulkNone'), 'info');
      return;
    }

    const baseSuggestions = buildSuggestions(uncategorized);
    // Order by user value: anomalies > taxonomy > duplicates > datasheet > categorize
    currentSuggestions = [
      ...anomalies,
      ...taxonomyFixes,
      ...dedupeGroups,
      ...datasheetFills,
      ...baseSuggestions,
    ];

    const subtitle = document.getElementById('bulk-cat-subtitle');
    if (subtitle) {
      const parts = [
        t('bulk.subtitle', { total: uncategorized.length, match: baseSuggestions.length }),
      ];
      if (anomalies.length      > 0) parts.push(t('anomaly.btn.open',     { n: anomalies.length }));
      if (taxonomyFixes.length  > 0) parts.push(t('bulk.taxonomy.found',  { n: taxonomyFixes.length }));
      if (dedupeGroups.length   > 0) parts.push(t('bulk.merge.found',     { n: dedupeGroups.length }));
      if (datasheetFills.length > 0) parts.push(t('bulk.datasheet.found', { n: datasheetFills.length }));
      subtitle.textContent = parts.join('  -  ');
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
