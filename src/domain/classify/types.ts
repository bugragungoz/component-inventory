/** What the built-in rules know about a part number (all fields optional). */
export interface PartHint {
  category?: string;
  subcategory?: string;
  package?: string;
  manufacturer?: string;
  mpn?: string;
  voltage_max?: number | null;
  current_max?: number | null;
  description?: string;
  datasheet_url?: string;
  preferred_supplier?: string;
  resistance?: string;
  tolerance?: string;
  power_rating?: number | null;
  notes?: string;
}

export interface PartPattern {
  pattern: RegExp;
  result: PartHint;
}

export interface CategoryHit {
  category: string;
  subcategory: string;
}

export interface CanonicalHit {
  canonical: string | null;
  data: PartHint;
  match: 'exact' | 'prefix' | 'extends' | 'pattern';
}

/** Fields `applyDbData` fills when they are empty. */
export interface DbFillable {
  category?: string;
  subcategory?: string;
  package?: string;
  manufacturer?: string;
  description?: string;
  datasheet_url?: string;
  voltage_max?: number | null;
  current_max?: number | null;
}
