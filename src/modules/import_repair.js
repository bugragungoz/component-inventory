import { inferImportRow } from './component_inference.js';
import {
  isPlaceholderPartCode,
  extractBestMpnFromComponent,
  isDiscardableImportRow,
} from './import_fixup.js';
import { lookupComponent } from './hardcoded_datasheet.js';
import { lookupOzdisanCategory } from './ozdisan_lookup.js';

/**
 * Find invalid IMP-* placeholder rows for bulk cleanup UI.
 * @param {object[]} components
 */
export function findInvalidImpImports(components = []) {
  const out = [];
  for (const comp of components) {
    if (!isPlaceholderPartCode(comp.part_code)) continue;

    const qty = Number(comp.quantity) || 0;
    const mpn = extractBestMpnFromComponent(comp);

    if (!mpn && qty <= 0) {
      out.push({
        comp,
        action: 'delete-invalid-import',
        hit: { category: '—', subcategory: '', description: 'Empty import placeholder' },
        source: 'import-fix',
        confidence: 'high',
      });
      continue;
    }

    if (mpn) {
      const hit = lookupComponent(mpn) || { category: '', subcategory: '', description: '' };
      out.push({
        comp,
        action: 'fix-import-code',
        hit: { ...hit, part_code: mpn },
        source: 'import-fix',
        confidence: 'high',
      });
    }
  }
  return out;
}

/**
 * Repair or remove IMP placeholders in the live database (on startup).
 * @returns {Promise<{ deleted: number, fixed: number }>}
 */
export async function repairPlaceholderComponents({
  components,
  updateComponent,
  deleteComponent,
  useOzdisan = false,
}) {
  let deleted = 0;
  let fixed = 0;

  for (const comp of components) {
    if (!isPlaceholderPartCode(comp.part_code)) continue;

    const row = {
      part_code: comp.part_code,
      category: comp.category,
      subcategory: comp.subcategory,
      quantity: comp.quantity,
      description: comp.description,
      notes: comp.notes,
      mpn: comp.mpn,
      package: comp.package,
      manufacturer: comp.manufacturer,
    };

    if (isDiscardableImportRow(row)) {
      await deleteComponent(comp.id);
      deleted++;
      continue;
    }

    const mpn = extractBestMpnFromComponent(comp);
    if (!mpn) continue;

    let enriched = inferImportRow({ ...row, part_code: mpn, mpn });

    if (useOzdisan && (!enriched.category || enriched.category === 'Uncategorized')) {
      const oz = await lookupOzdisanCategory(mpn);
      if (oz?.category) {
        enriched = {
          ...enriched,
          category: oz.category,
          subcategory: oz.subcategory || enriched.subcategory,
        };
      }
    }

    await updateComponent(comp.id, {
      ...comp,
      part_code: mpn,
      category: enriched.category || comp.category,
      subcategory: enriched.subcategory || comp.subcategory,
      package: enriched.package || comp.package,
      manufacturer: enriched.manufacturer || comp.manufacturer,
      description: enriched.description || comp.description,
    });
    fixed++;
  }

  return { deleted, fixed };
}
