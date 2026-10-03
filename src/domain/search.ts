/**
 * Search folding. Case folds the Turkish way (İ -> i, I -> ı) and then treats ı as i and drops
 * accents, so "direnc", "DİRENÇ" and "Direnç" match each other, and "IRF540" matches "irf540" in
 * every UI language.
 */
export function fold(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Every word of the query must appear in the haystack (already folded). */
export function matchesAll(haystack: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return words.every((w) => haystack.includes(w));
}

/** Edit distance with transpositions, bounded: Infinity past `max`. */
export function editDistance(a: string, b: string, max = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return Infinity;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prevPrev[j - 2]! + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return Infinity;
    prevPrev = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Lower is better; Infinity is no match. Exact, prefix, word prefix, substring, then typos. */
export function fuzzyScore(query: string, candidate: string): number {
  const q = fold(query);
  const c = fold(candidate);
  if (!q) return Infinity;
  if (c === q) return 0;
  if (c.startsWith(q)) return 0.1;
  if (c.split(/[\s\-_/]+/).some((t) => t.startsWith(q))) return 0.3;
  if (c.includes(q)) return 0.5;
  const d = editDistance(q, c, Math.max(2, Math.floor(q.length / 3) + 1));
  return d === Infinity ? Infinity : 2 + d / Math.max(q.length, c.length);
}

export function rankCandidates(query: string, candidates: Iterable<string>, limit = 8): string[] {
  if (!query.trim()) return [];
  const seen = new Set<string>();
  const scored: Array<[string, number]> = [];
  for (const c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    const s = fuzzyScore(query, c);
    if (s < Infinity) scored.push([c, s]);
  }
  return scored.sort((a, b) => a[1] - b[1]).slice(0, limit).map(([c]) => c);
}
