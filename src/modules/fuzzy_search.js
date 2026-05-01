// ============================================================
// Fuzzy search & autocorrect helpers.
// Used by sidebar category search and Edit modal subcategory input.
// ============================================================
import { state } from '../app.js';

/** Locale-aware lowercase + strip diacritics for fuzzy matching. */
function fold(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Damerau-Levenshtein-lite distance (insert / delete / replace / adjacent
 * transposition) capped at maxDist for fast bail-out. Returns Infinity above cap.
 */
export function editDistance(a, b, maxDist = 4) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return Infinity;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  let prevPrev = new Array(n + 1);
  let prev = new Array(n + 1);
  let cur  = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prevPrev[j - 2] + 1);
      }
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > maxDist) return Infinity;
    prevPrev = prev;
    prev = cur;
    cur = new Array(n + 1);
  }
  return prev[n];
}

/**
 * Score a candidate against a query.
 * Lower score = better match. Infinity = no match at all.
 *  - Exact (case-insensitive) start: 0
 *  - Exact substring: 1
 *  - Distance-based with length normalization for fuzzy
 */
export function fuzzyScore(query, candidate) {
  const q = fold(query);
  const c = fold(candidate);
  if (!q) return Infinity;
  if (c === q) return 0;
  if (c.startsWith(q)) return 0.1;
  if (c.includes(q)) return 0.5;
  // Token-prefix match (e.g. "rec" matches "Power Rectifier")
  const tokens = c.split(/[\s\-_/]+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok.startsWith(q)) return 0.3;
  }
  // Fuzzy fallback for typos
  const dist = editDistance(q, c, Math.max(2, Math.floor(q.length / 3) + 1));
  if (dist === Infinity) return Infinity;
  return 2 + dist / Math.max(q.length, c.length);
}

/**
 * Highlight matching characters of `query` inside `candidate` returning HTML.
 * Safe for innerHTML when caller has already escaped non-match parts.
 */
export function highlightMatch(query, candidate) {
  const q = fold(query);
  const c = candidate;
  if (!q) return escapeHtml(c);
  const cFolded = fold(c);
  const idx = cFolded.indexOf(q);
  if (idx < 0) return escapeHtml(c);
  return (
    escapeHtml(c.slice(0, idx)) +
    '<mark>' + escapeHtml(c.slice(idx, idx + q.length)) + '</mark>' +
    escapeHtml(c.slice(idx + q.length))
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Rank candidates by fuzzy score against query.
 * Returns top-N items annotated with {value, score}.
 */
export function rankCandidates(query, candidates, limit = 8) {
  if (!query || !query.trim()) return [];
  const seen = new Set();
  const scored = [];
  for (const cand of candidates) {
    if (!cand || seen.has(cand)) continue;
    seen.add(cand);
    const score = fuzzyScore(query, cand);
    if (score < Infinity) scored.push({ value: cand, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit);
}

// ================================================================
// Sidebar fuzzy autocomplete dropdown
// ================================================================
let _activeIdx = -1;

function getCategoryCandidates() {
  const set = new Set();
  for (const c of state.components) {
    if (c.category) set.add(c.category);
    if (c.subcategory) set.add(c.subcategory);
  }
  return Array.from(set);
}

function buildSuggestionDropdown() {
  const input = document.getElementById('sidebar-search');
  const drop  = document.getElementById('sidebar-suggest');
  if (!input || !drop) return;

  const q = input.value.trim();
  if (!q) {
    drop.style.display = 'none';
    drop.innerHTML = '';
    _activeIdx = -1;
    return;
  }

  const candidates = getCategoryCandidates();
  // If exact substring matches exist, only show those (no need for fuzzy fallback)
  const ranked = rankCandidates(q, candidates, 8);
  if (ranked.length === 0) {
    drop.style.display = 'none';
    drop.innerHTML = '';
    return;
  }

  drop.innerHTML = ranked.map((r, i) =>
    `<div class="sidebar-suggest-item${i === 0 ? ' active' : ''}" data-value="${escapeHtml(r.value)}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>${highlightMatch(q, r.value)}</span>
      ${r.score > 1 ? '<span class="ssg-hint">~</span>' : ''}
    </div>`
  ).join('');
  drop.style.display = '';
  _activeIdx = 0;

  drop.querySelectorAll('.sidebar-suggest-item').forEach((el) => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      input.value = el.dataset.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      drop.style.display = 'none';
    });
  });
}

export function initSidebarFuzzySearch() {
  const input = document.getElementById('sidebar-search');
  const drop  = document.getElementById('sidebar-suggest');
  if (!input || !drop) return;

  input.addEventListener('input', buildSuggestionDropdown);
  input.addEventListener('focus', buildSuggestionDropdown);
  input.addEventListener('blur', () => {
    setTimeout(() => { drop.style.display = 'none'; }, 120);
  });
  input.addEventListener('keydown', e => {
    const items = drop.querySelectorAll('.sidebar-suggest-item');
    if (drop.style.display === 'none' || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _activeIdx = (_activeIdx + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === _activeIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _activeIdx = (_activeIdx - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === _activeIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = items[_activeIdx];
      if (sel) {
        input.value = sel.dataset.value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        drop.style.display = 'none';
      }
    } else if (e.key === 'Escape') {
      drop.style.display = 'none';
    }
  });
}
