import { lookupComponent, lookupCanonical, categorizeByDescription } from './hardcoded_datasheet.js';
import { state, updateComponent, deleteComponent, showToast, escHtml, beginMutationBatch, endMutationBatch } from '../app.js';
import { t, applyTranslations }                                 from './i18n.js';
import { normaliseCategory }                                    from './modals.js';
import { getSelectedIds }                                       from './table.js';
import { UNCATEGORIZED_CATEGORY }                               from './constants.js';
import {
  isWeakDatasheetUrl as isWeakDatasheetUrlCore,
  isControlledDbMatch as isControlledDbMatchCore,
  normaliseSimple as normaliseSimpleCore,
  isLikelyOptocoupler as isLikelyOptocouplerCore,
} from './bulk_core.js';

/**
 * Detect URLs that are NOT direct datasheet links but Google searches /
 * marketing pages. Used to know when we may safely overwrite the datasheet.
 */
function isWeakDatasheetUrl(url) {
  return isWeakDatasheetUrlCore(url);
}

/** Returns true when the lookup hit's category is consistent with the component. */
function categoryConsistent(comp, hit) {
  if (!hit || !hit.category) return false;
  if (!comp.category || comp.category === UNCATEGORIZED_CATEGORY) return true;
  return comp.category === hit.category;
}

/**
 * Conservative matcher for DB enrichment to avoid wrong assignments.
 * Accept:
 *   - exact key matches, OR
 *   - short alias matches with tiny length delta (e.g. LM7805 <-> 7805),
 *     and only when category is already consistent (or uncategorized).
 */
function isControlledDbMatch(comp, found) {
  return isControlledDbMatchCore(comp, found);
}

/**
 * Scan all components for ones missing a *real* datasheet URL where the
 * built-in DB has a confident match (exact or prefix DB key, never pattern-only)
 * AND the categories agree (or the component is uncategorized).
 */
function findDatasheetBackfills(components = state.components || []) {
  const out = [];
  for (const comp of components) {
    const found = lookupCanonical(comp.part_code);
    if (!isControlledDbMatch(comp, found)) continue;

    const db = found.data;
    const patch = {};
    let fillCount = 0;

    // Fill datasheet only if missing/weak and DB has direct URL
    if (db.datasheet_url && isWeakDatasheetUrl(comp.datasheet_url)) {
      patch.datasheet_url = db.datasheet_url;
      fillCount++;
    }
    // Fill description/manufacturer/package/subcategory when missing
    if ((!comp.description || !String(comp.description).trim()) && db.description) {
      patch.description = db.description;
      fillCount++;
    }
    if ((!comp.manufacturer || !String(comp.manufacturer).trim()) && db.manufacturer) {
      patch.manufacturer = db.manufacturer;
      fillCount++;
    }
    if ((!comp.package || !String(comp.package).trim()) && db.package) {
      patch.package = db.package;
      fillCount++;
    }
    if ((!comp.subcategory || !String(comp.subcategory).trim()) && db.subcategory) {
      patch.subcategory = db.subcategory;
      fillCount++;
    }
    if ((!comp.category || comp.category === UNCATEGORIZED_CATEGORY) && db.category) {
      patch.category = db.category;
      fillCount++;
    }

    if (fillCount === 0) continue;
    out.push({
      comp,
      hit: patch,
      source: 'db-enrich',
      confidence: found.match === 'exact' ? 'high' : 'medium',
      action: 'datasheet',
      fillCount,
    });
  }
  return out;
}

/**
 * Detect components whose category string is a non-canonical alias of a
 * known main category (e.g. "Diode" -> "Diodes", "MOSFETs" -> "Transistors").
 * Returns suggestion rows that only rewrite the category field.
 */
function findCategoryNormalizations(components = state.components || []) {
  const out = [];
  for (const comp of components) {
    if (!comp.category) continue;
    if (comp.category === UNCATEGORIZED_CATEGORY) continue;
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
function findDuplicateGroups(components = state.components || []) {
  const groups = new Map();
  for (const comp of components) {
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
    c => !c.category || c.category === UNCATEGORIZED_CATEGORY
  );
}

/**
 * Detects components likely placed in the WRONG category.
 *
 * Anomaly detection requires STRONG, UNAMBIGUOUS evidence to avoid annoying
 * the user with false positives. We only flag a row when:
 *   - built-in DB has a deterministic match (exact or prefix DB key, NOT a
 *     pattern-only match) AND its category differs from the component, OR
 *   - heuristic returns 'high' confidence AND the suggestion is part-code-based
 *     (i.e. derived from the part number itself, not a fuzzy keyword in
 *     free-text description / package text).
 *
 * Both `comp.category` and `hit.category` are compared after normalisation so
 * "Diode" / "Diodes", "MOSFETs" / "Transistors" etc. don't trip the alarm.
 */
/** Strong diode/rectifier signals in user text — used to suppress false MOSFET anomalies. */
function isStrongDiodeEvidence(comp) {
  const blob = [comp.part_code, comp.description, comp.package, comp.manufacturer]
    .filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
  return /\b(schottky|rectifier|fast\s*recovery|ultra[\s-]*fast|zener|bridge\s*rectifier|efficiency\s*rectifier|\btvs\b|diode\b|\bdiyod\b)/.test(blob);
}

function getMisclassified(components = state.components || []) {
  const out = [];
  for (const comp of components) {
    if (!comp.category || comp.category === UNCATEGORIZED_CATEGORY) continue;
    const currentCanonical = normaliseCategory(comp.category) || comp.category;

    const dbCanon = lookupCanonical(comp.part_code);
    if (dbCanon && dbCanon.match !== 'pattern' && dbCanon.data && dbCanon.data.category) {
      const hitCanonical = normaliseCategory(dbCanon.data.category) || dbCanon.data.category;
      if (hitCanonical !== currentCanonical) {
        const dbIsTransistor = hitCanonical === 'Transistors';
        if (dbIsTransistor && isStrongDiodeEvidence(comp)) {
          // Ignore DB mismatch when free text clearly describes a diode (e.g. STPS… vs wrong DB hit).
        } else {
          out.push({
            comp,
            hit: dbCanon.data,
            source: 'part-code',
            confidence: 'high',
            anomaly: true,
            reason: 'db-mismatch',
          });
          continue;
        }
      }
    }

    const heur = heuristicClassify(comp);
    if (heur && heur.confidence === 'high' && heur.partCodeBased) {
      const hitCanonical = normaliseCategory(heur.category) || heur.category;
      if (hitCanonical === 'Transistors' && isStrongDiodeEvidence(comp)) continue;
      if (hitCanonical !== currentCanonical) {
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
  }
  return out;
}

/**
 * Heuristic classifier used as a tertiary fallback after the part-code DB
 * lookup and description rule engine.
 *
 * Design rules (do not regress):
 *   - The blob NEVER includes `subcategory`, `notes` or `category`. Including
 *     them creates a self-poisoning loop where a previous bad classification
 *     keeps re-confirming itself (e.g. 74LS04 stuck on "Schottky").
 *   - Part-code prefix detection runs FIRST and is marked `partCodeBased: true`
 *     so anomaly detection can require strong evidence.
 *   - Description keywords use word boundaries to avoid matching corrective
 *     notes such as "(also misplaced in MOSFET section)".
 *   - Generic keyword matches return at most `medium` confidence.
 *
 * Returns: { category, subcategory, confidence, partCodeBased } | null
 */
function heuristicClassify(comp) {
  const partCodeKey = String(comp.part_code || '')
    .toUpperCase()
    .replace(/[\s\-_.]/g, '');

  // ── Part-code prefix detection (high confidence, immune to description text)
  // 74-series TTL/CMOS logic: 74LS04, 74HC595, 74HCT245, SN74LS00, MC74HC00 ...
  if (/^(SN|MC|MM|HD|GD|TC|HEF|CD)?74[A-Z]{0,5}\d{2,4}[A-Z]{0,3}$/.test(partCodeKey) &&
      /74[A-Z]{0,5}\d/.test(partCodeKey)) {
    return { category: 'ICs', subcategory: 'Logic', confidence: 'high', partCodeBased: true };
  }
  // CD4000-series CMOS logic: CD4017, CD4060, CD4093 ...
  if (/^CD4\d{3}[A-Z]{0,3}$/.test(partCodeKey)) {
    return { category: 'ICs', subcategory: 'Logic', confidence: 'high', partCodeBased: true };
  }
  // HEF4xxx (Philips/NXP CMOS) and MC14xxx (Motorola CMOS)
  if (/^HEF4\d{3}/.test(partCodeKey) || /^MC14\d{3}/.test(partCodeKey)) {
    return { category: 'ICs', subcategory: 'Logic', confidence: 'high', partCodeBased: true };
  }
  // Common optocoupler families. 4N25..4N48 are opto, 4N60+ are MOSFETs, so
  // we explicitly cap the digits to exclude MOSFET ranges.
  if (/^6N(13[5-9]|14[0-9])$/.test(partCodeKey)) {
    return { category: 'ICs', subcategory: 'Optocoupler', confidence: 'high', partCodeBased: true };
  }
  if (/^4N(2[5-9]|3[0-9]|4[0-9])$/.test(partCodeKey)) {
    return { category: 'ICs', subcategory: 'Optocoupler', confidence: 'high', partCodeBased: true };
  }
  if (/^TLP\d{3,4}$/.test(partCodeKey) || /^PC(8[1-4]7|923)$/.test(partCodeKey) ||
      /^EL(8\d{2}|3H7)$/.test(partCodeKey) || /^MOC30\d{2}/.test(partCodeKey)) {
    return { category: 'ICs', subcategory: 'Optocoupler', confidence: 'high', partCodeBased: true };
  }
  // 1N40xx, 1N41xx (rectifier), 1N47xx (zener), 1N58xx (schottky) — already
  // handled by DB patterns but kept here as a safety net for unknown variants.
  if (/^1N40\d{2}/.test(partCodeKey)) {
    return { category: 'Diodes', subcategory: 'Rectifier', confidence: 'high', partCodeBased: true };
  }
  if (/^1N47\d{2}/.test(partCodeKey)) {
    return { category: 'Diodes', subcategory: 'Zener', confidence: 'high', partCodeBased: true };
  }
  if (/^1N58[12]\d/.test(partCodeKey)) {
    return { category: 'Diodes', subcategory: 'Schottky', confidence: 'high', partCodeBased: true };
  }
  // 1N4148 / 1N914 small-signal
  if (/^1N(4148|914)/.test(partCodeKey)) {
    return { category: 'Diodes', subcategory: 'Small Signal', confidence: 'high', partCodeBased: true };
  }
  // STMicro power Schottky / ultrafast rectifier prefixes (before STP MOSFET heuristic).
  if (/^STPS/i.test(partCodeKey)) {
    return { category: 'Diodes', subcategory: 'Schottky', confidence: 'high', partCodeBased: true };
  }
  if (/^STTH/i.test(partCodeKey)) {
    return { category: 'Diodes', subcategory: 'Fast Recovery', confidence: 'high', partCodeBased: true };
  }
  // Common MOSFET prefixes. STP(?!S) avoids classifying STPS… Schottky parts as MOSFETs.
  if (/^(IRF|IRL|IRFZ|STP(?!S)|STF|FQP|FDP|FDS|BSS|BSP|AOD|AON|AOZ|2SK|2SJ|SI[A-Z]{1,2}\d)/.test(partCodeKey)) {
    return { category: 'Transistors', subcategory: 'Power MOSFET', confidence: 'high', partCodeBased: true };
  }
  if (/^(BC|BD|2N|MJE|TIP|2SA|2SB|2SC|2SD|S8\d{3}|S9\d{3})/.test(partCodeKey)) {
    return { category: 'Transistors', subcategory: 'BJT', confidence: 'medium', partCodeBased: true };
  }
  // ESPxxxx, STM32xxxx, ATmega/ATtiny, PIC, nRFxxxxx — microcontrollers
  if (/^(ESP(32|8266)|STM32|ATMEGA|ATTINY|PIC\d|NRF\d|RP\d{3,4})/.test(partCodeKey)) {
    return { category: 'ICs', subcategory: 'Microcontroller', confidence: 'high', partCodeBased: true };
  }

  // ── Description-based heuristics (medium confidence; safer than part-code)
  // Build blob from observable fields ONLY (never the existing classification).
  const blob = [
    comp.part_code, comp.description, comp.package, comp.manufacturer
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
  // Logic descriptions (gates, flip-flops, counters, registers)
  if (/\b(hex inverter|schmitt trigger|flip[- ]?flop|shift register|binary counter|decade counter|ripple[- ]?carry|nand gate|nor gate|xor gate|xnor gate|and gate|or gate|multiplexer|demultiplexer|\bmux\b|decoder|encoder|bus transceiver|octal buffer|line driver|latch ic)\b/.test(blob)) {
    return { category: 'ICs', subcategory: 'Logic', confidence: 'medium' };
  }
  // Optocoupler descriptions (covers high-speed, photocoupler, opto-isolator)
  if (/\b(optocoupler|opto-?isolator|photocoupler|optoisolator)\b/.test(blob)) {
    return { category: 'ICs', subcategory: 'Optocoupler', confidence: 'medium' };
  }
  // BJT NPN/PNP heuristics — strict word boundaries
  if (/\bnpn\b/.test(blob)) return { category: 'Transistors', subcategory: 'BJT NPN', confidence: 'medium' };
  if (/\bpnp\b/.test(blob)) return { category: 'Transistors', subcategory: 'BJT PNP', confidence: 'medium' };
  // MOSFET — only when paired with concrete channel marker (n-ch / p-ch / power)
  // Naked "mosfet" matches were misclassifying notes like "misplaced in MOSFET section".
  if (/\b(n-?ch(?:annel)?|p-?ch(?:annel)?|power|trench|logic[- ]level)\b.{0,20}\bmosfet\b/.test(blob) ||
      /\bmosfet\b.{0,20}\b(n-?ch|p-?ch|\d+v|\d+a)\b/.test(blob)) {
    return { category: 'Transistors', subcategory: 'Power MOSFET', confidence: 'medium' };
  }
  if (/\bigbt\b/.test(blob)) return { category: 'Transistors', subcategory: 'IGBT', confidence: 'medium' };
  // Diode descriptions
  if (/\bzener\b/.test(blob))    return { category: 'Diodes', subcategory: 'Zener',     confidence: 'medium' };
  if (/\bschottky\b/.test(blob)) return { category: 'Diodes', subcategory: 'Schottky',  confidence: 'medium' };
  if (/\b(rectifier diode|bridge rectifier|fast recovery|ultra fast)\b/.test(blob))
                                  return { category: 'Diodes', subcategory: 'Rectifier', confidence: 'medium' };
  // LEDs
  if (/\bled\b/.test(blob))           return { category: 'Diodes', subcategory: 'LED',        confidence: 'medium' };
  // Connectors
  if (/\b(pin header|jst|molex|terminal block|connector|konektor)\b/.test(blob))
    return { category: 'Connectors', subcategory: 'Pin Header', confidence: 'medium' };
  // Crystals
  if (/\b(crystal|kristal|oscillator|mhz|khz)\b/.test(blob))
    return { category: 'Crystals', subcategory: 'Crystal', confidence: 'medium' };
  // Sensors
  if (/\b(temperature sensor|humidity sensor|pressure sensor|hall sensor|dht\d{1,2}|ds18[bs]\d{0,2}|bmp\d{2,3}|mpu\d{4})\b/.test(blob))
    return { category: 'Sensors', subcategory: 'Temperature', confidence: 'medium' };
  return null;
}

/** Build suggestion list with confidence metadata. */
function buildSuggestions(components) {
  const suggestions = [];
  for (const comp of components) {
    const hitByCode = lookupComponent(comp.part_code);
    let source = null, hit = null, confidence = 'low';
    if (isLikelyOptocoupler(comp)) {
      hit = { category: 'ICs', subcategory: 'Optocoupler' };
      source = 'opto-normalizer';
      confidence = 'high';
    }
    if (hitByCode) { hit = hitByCode; source = 'part-code'; confidence = 'high'; }
    if (!hit) {
      const hitByDesc = categorizeByDescription(comp.description);
      if (hitByDesc) { hit = hitByDesc; source = 'description'; confidence = 'medium'; }
    }
    if (!hit) {
      const heur = heuristicClassify(comp);
      if (heur) { hit = heur; source = 'heuristic'; confidence = heur.confidence || 'low'; }
    }
    if (hit && hit.category && hit.category !== UNCATEGORIZED_CATEGORY) {
      const currentCat = normaliseCategory(comp.category || '') || (comp.category || '');
      const hitCat = normaliseCategory(hit.category || '') || (hit.category || '');
      const currentSub = String(comp.subcategory || '').trim().toLowerCase();
      const hitSub = String(hit.subcategory || '').trim().toLowerCase();
      const shouldApply = !currentCat || currentCat === UNCATEGORIZED_CATEGORY
        || currentCat !== hitCat
        || (hitSub && currentSub !== hitSub);
      if (!shouldApply) continue;
      suggestions.push({ comp, hit, source, confidence });
    }
  }
  return suggestions;
}

function readBulkActionOpts() {
  return {
    reclass: document.getElementById('bulk-opt-reclass')?.checked !== false,
    datasheet: document.getElementById('bulk-opt-datasheet')?.checked !== false,
    describe: document.getElementById('bulk-opt-describe')?.checked !== false,
  };
}

function rowMatchesBulkOpts(s, o) {
  if (s.action === 'merge' || s.action === 'normalize-cat') return o.reclass;
  if (s.action === 'datasheet') {
    const p = s.hit || {};
    if (o.reclass && p.category) return true;
    if (o.datasheet && p.datasheet_url) return true;
    if (o.describe && (p.description || p.manufacturer || p.package || p.subcategory)) return true;
    return false;
  }
  if (s.anomaly) return o.reclass;
  if (!s.action || s.action === 'categorize' || s.action === 'anomaly') return o.reclass;
  return o.reclass;
}

function filterBulkSuggestions(rows, o) {
  return rows.filter(s => rowMatchesBulkOpts(s, o));
}

function buildPartialEnrichPatch(fullPatch, o) {
  const out = {};
  if (o.reclass && fullPatch.category) out.category = fullPatch.category;
  if (o.datasheet && fullPatch.datasheet_url) out.datasheet_url = fullPatch.datasheet_url;
  if (o.describe) {
    if (fullPatch.description) out.description = fullPatch.description;
    if (fullPatch.manufacturer) out.manufacturer = fullPatch.manufacturer;
    if (fullPatch.package) out.package = fullPatch.package;
    if (fullPatch.subcategory) out.subcategory = fullPatch.subcategory;
  }
  return out;
}

function dedupeSuggestions(rows) {
  const seen = new Set();
  const out = [];
  for (const s of rows) {
    if (s.action === 'merge') {
      const key = `merge:${s.canonical || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      continue;
    }
    const id = s.comp?.id;
    if (id == null) { out.push(s); continue; }
    const category = normaliseCategory(s.hit?.category || '') || (s.hit?.category || '');
    const sub = String(s.hit?.subcategory || '').trim().toLowerCase();
    const action = s.action || (s.anomaly ? 'anomaly' : 'categorize');
    const key = `${action}:${id}:${category}:${sub}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function getScopeComponents(scope) {
  const all = state.components || [];
  if (scope === 'selected') {
    const ids = getSelectedIds();
    return all.filter(c => ids.has(c.id));
  }
  if (scope === 'uncategorized') {
    return all.filter(c => !c.category || c.category === UNCATEGORIZED_CATEGORY);
  }
  return all;
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
      `${escHtml(t('bulk.enrich.summary', { n: Number(s.fillCount || 0) }))}</span>` + tail
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
  const opts     = readBulkActionOpts();

  if (selected.length === 0) return;

  const btn = document.getElementById('btn-bulk-apply');
  if (btn) { btn.disabled = true; btn.textContent = t('bulk.applying', { done: 0, total: selected.length }); }

  let success = 0;
  let failed  = 0;
  beginMutationBatch();
  try {
    for (let i = 0; i < selected.length; i++) {
      const s = selected[i];
      if (btn) btn.textContent = t('bulk.applying', { done: i + 1, total: selected.length });
      try {
      if (s.action === 'datasheet') {
        const patch = buildPartialEnrichPatch(s.hit, opts);
        if (Object.keys(patch).length === 0) {
          success++;
          continue;
        }
        await updateComponent(s.comp.id, { ...s.comp, ...patch });
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
  } finally {
    await endMutationBatch();
  }

  closeOverlay();
  if (failed === 0) {
    showToast(t('toast.bulkOk', { n: success }), 'success');
  } else {
    showToast(t('toast.bulkPart', { ok: success, fail: failed }), 'warning');
  }
}

function normaliseSimple(s) {
  return normaliseSimpleCore(s);
}

function isLikelyOptocoupler(comp) {
  return isLikelyOptocouplerCore(comp);
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

  let bulkAllSuggestions = [];
  let currentSuggestions = [];

  const refreshBulkList = () => {
    currentSuggestions = filterBulkSuggestions(bulkAllSuggestions, readBulkActionOpts());
    renderList(currentSuggestions);
  };

  btnOpen.addEventListener('click', () => {
    const selectedScope = (document.querySelector('input[name="bulk-cat-scope"]:checked')?.value || 'selected');
    const scopeComponents = getScopeComponents(selectedScope);
    if (selectedScope === 'selected' && scopeComponents.length === 0) {
      showToast(t('toast.bulkNoSelection'), 'info');
      return;
    }
    const uncategorized    = scopeComponents.filter(c => !c.category || c.category === UNCATEGORIZED_CATEGORY);
    const anomalies        = getMisclassified(scopeComponents);
    const taxonomyFixes    = findCategoryNormalizations(scopeComponents);
    const datasheetFills   = findDatasheetBackfills(scopeComponents);
    const dedupeGroups     = findDuplicateGroups(scopeComponents);

    if (uncategorized.length === 0 && anomalies.length === 0 &&
        datasheetFills.length === 0 && dedupeGroups.length === 0 &&
        taxonomyFixes.length === 0) {
      showToast(t('toast.bulkNone'), 'info');
      return;
    }

    const baseSuggestions = buildSuggestions(scopeComponents);
    // Order by user value: anomalies > taxonomy > duplicates > datasheet > categorize
    bulkAllSuggestions = dedupeSuggestions([
      ...anomalies,
      ...taxonomyFixes,
      ...dedupeGroups,
      ...datasheetFills,
      ...baseSuggestions,
    ]);

    const subtitle = document.getElementById('bulk-cat-subtitle');
    if (subtitle) {
      const parts = [
        t('bulk.subtitle.scope', { total: scopeComponents.length, match: bulkAllSuggestions.length }),
      ];
      if (anomalies.length      > 0) parts.push(t('anomaly.btn.open',     { n: anomalies.length }));
      if (taxonomyFixes.length  > 0) parts.push(t('bulk.taxonomy.found',  { n: taxonomyFixes.length }));
      if (dedupeGroups.length   > 0) parts.push(t('bulk.merge.found',     { n: dedupeGroups.length }));
      if (datasheetFills.length > 0) parts.push(t('bulk.datasheet.found', { n: datasheetFills.length }));
      subtitle.textContent = parts.join('  -  ');
    }

    applyTranslations(overlay);
    refreshBulkList();
    overlay.style.display = 'flex';
  });

  ['bulk-opt-reclass', 'bulk-opt-datasheet', 'bulk-opt-describe'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (overlay.style.display === 'flex') refreshBulkList();
    });
  });

  const updateScopeLabel = () => {
    const selectedCount = getSelectedIds().size;
    const label = document.querySelector('input[name="bulk-cat-scope"][value="selected"]')?.closest('label')?.querySelector('span');
    if (label) label.textContent = t('bulk.scope.selected', { n: selectedCount });
  };
  updateScopeLabel();
  btnOpen.addEventListener('click', updateScopeLabel);

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
