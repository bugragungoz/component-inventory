export const DIFF_FIELDS = [
  'category', 'subcategory', 'quantity', 'package', 'manufacturer', 'mpn',
  'location', 'voltage_max', 'current_max', 'description', 'datasheet_url',
  'unit_price', 'notes', 'resistance', 'tolerance', 'power_rating',
];

export function computeDiffCore(mapA, mapB, fields = DIFF_FIELDS) {
  const added = [];
  const removed = [];
  const changed = [];

  for (const [pc, b] of mapB.entries()) {
    if (!mapA.has(pc)) {
      added.push(b);
    } else {
      const a = mapA.get(pc);
      const diffFields = [];
      for (const f of fields) {
        const va = a[f] ?? '';
        const vb = b[f] ?? '';
        if (String(va) !== String(vb)) {
          diffFields.push({ field: f, before: va, after: vb });
        }
      }
      if (diffFields.length > 0) changed.push({ part_code: pc, fields: diffFields });
    }
  }

  for (const [pc, a] of mapA.entries()) {
    if (!mapB.has(pc)) removed.push(a);
  }

  return { added, removed, changed };
}
