import { lookupComponent, categorizeByDescription, applyDbData } from './hardcoded_datasheet.js';
import { UNCATEGORIZED_CATEGORY } from './constants.js';
import { isPlaceholderPartCode, extractMpnFromText } from './import_fixup.js';

function isCategoryEmpty(cat) {
  return !cat || cat === UNCATEGORIZED_CATEGORY;
}

/**
 * Infer category, subcategory, package, and description for an import row
 * using part-code DB, SMD patterns, and free-text rules (incl. Turkish).
 */
export function inferImportRow(row) {
  const out = { ...row };

  const notesText = String(out.notes || '').trim();
  if (!String(out.description || '').trim() && notesText) {
    out.description = notesText;
  }

  const descText = String(out.description || '').trim();
  let codeText = String(out.part_code || '').trim();

  if (isPlaceholderPartCode(codeText) && String(out.mpn || '').trim()) {
    codeText = String(out.mpn).trim();
    out.part_code = codeText;
  }

  let dbHit = lookupComponent(codeText);
  if (!dbHit && isPlaceholderPartCode(String(out.part_code || ''))) {
    const fromDesc = extractMpnFromText(descText);
    if (fromDesc) {
      codeText = fromDesc;
      out.part_code = fromDesc;
      dbHit = lookupComponent(codeText);
    }
  }
  if (dbHit) {
    const merged = applyDbData(
      {
        category: out.category || '',
        subcategory: out.subcategory || '',
        package: out.package || '',
        manufacturer: out.manufacturer || '',
        description: out.description || '',
        datasheet_url: out.datasheet_url || '',
        voltage_max: out.voltage_max ?? null,
        current_max: out.current_max ?? null,
      },
      dbHit,
    );
    if (isCategoryEmpty(out.category) && merged.category) out.category = merged.category;
    if (!out.subcategory && merged.subcategory) out.subcategory = merged.subcategory;
    if (!out.package && merged.package) out.package = merged.package;
    if (!out.manufacturer && merged.manufacturer) out.manufacturer = merged.manufacturer;
    if (!descText && merged.description) out.description = merged.description;
    if (!out.datasheet_url && merged.datasheet_url) out.datasheet_url = merged.datasheet_url;
    if (out.voltage_max == null && merged.voltage_max != null) out.voltage_max = merged.voltage_max;
    if (out.current_max == null && merged.current_max != null) out.current_max = merged.current_max;
  }

  if (isCategoryEmpty(out.category) && descText) {
    const fromDesc = categorizeByDescription(descText);
    if (fromDesc) {
      out.category = fromDesc.category;
      if (!out.subcategory && fromDesc.subcategory) out.subcategory = fromDesc.subcategory;
    }
  }

  return out;
}
