/** Locale-aware lowercase + strip diacritics for fuzzy matching. */
function fold(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function editDistance(a, b, maxDist = 4) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return Infinity;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  let prevPrev = new Array(n + 1);
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
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

export function fuzzyScore(query, candidate) {
  const q = fold(query);
  const c = fold(candidate);
  if (!q) return Infinity;
  if (c === q) return 0;
  if (c.startsWith(q)) return 0.1;
  if (c.includes(q)) return 0.5;
  const tokens = c.split(/[\s\-_/]+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok.startsWith(q)) return 0.3;
  }
  const dist = editDistance(q, c, Math.max(2, Math.floor(q.length / 3) + 1));
  if (dist === Infinity) return Infinity;
  return 2 + dist / Math.max(q.length, c.length);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
