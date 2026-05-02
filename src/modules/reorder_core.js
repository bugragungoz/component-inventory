export function normalizeThreshold(raw, fallback = 1) {
  const n = parseInt(String(raw ?? ''), 10);
  if (isNaN(n) || n < 0) return fallback;
  return n;
}

export function getSuggestedQty(currentQty, threshold) {
  const target = Math.max(threshold * 2, threshold + 1);
  return Math.max(1, target - currentQty);
}

export function buildReorderRows(components, threshold) {
  return (components || [])
    .filter(c => (Number(c.quantity) || 0) <= threshold)
    .sort((a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0));
}
