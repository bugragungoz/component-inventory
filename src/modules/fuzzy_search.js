// ============================================================
// Fuzzy search & autocorrect helpers.
// Used by sidebar category search and Edit modal subcategory input.
// ============================================================
import { state } from '../app.js';
import { editDistance, fuzzyScore, highlightMatch, rankCandidates } from './fuzzy_core.js';
export { editDistance, fuzzyScore, highlightMatch, rankCandidates };

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
