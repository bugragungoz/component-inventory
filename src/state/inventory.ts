/**
 * The inventory in memory. The table, the sidebar and the status bar all derive from
 * `components`; mutations patch it in place instead of reloading everything, so the table keeps
 * its scroll position. Search, filters and sort are computed signals.
 */
import { batch, computed, signal } from '@preact/signals';
import { api } from '../api/commands';
import type { Component, CustomColumn, UsageSummary } from '../api/types';
import { fold, matchesAll } from '../domain/search';
import { UNCATEGORIZED } from '../domain/taxonomy';
import { compareText } from '../i18n';
import { settings } from './settings';

export const components = signal<Component[]>([]);
export const usage = signal<Map<number, UsageSummary>>(new Map());
export const customColumns = signal<CustomColumn[]>([]);
export const loaded = signal(false);

export const search = signal('');
export const filterCategory = signal<string | null>(null);
export const filterSubcategory = signal<string | null>(null);
export const filterLocation = signal<string | null>(null);
export const lowStockOnly = signal(false);
export const selection = signal<Set<number>>(new Set());

export type SortDir = 'asc' | 'desc';
export const sort = signal<{ column: string; direction: SortDir }>({ column: 'part_code', direction: 'asc' });

const NUMERIC = new Set(['quantity', 'voltage_max', 'current_max', 'power_rating', 'unit_price', 'id']);

export function categoryOf(c: Component): string {
  return c.category || UNCATEGORIZED;
}

/** One folded string per part with every searchable field, built when the list changes. */
const haystacks = computed(() => {
  const m = new Map<number, string>();
  for (const c of components.value) {
    m.set(
      c.id,
      fold([c.part_code, c.description, c.manufacturer, c.mpn, c.package, c.category, c.subcategory, c.location, c.notes, c.preferred_supplier,
        ...Object.values(c.custom_fields).map(String)].join(' \u0001 ')),
    );
  }
  return m;
});

function value(c: Component, column: string): unknown {
  if (column.startsWith('cc_')) return c.custom_fields[column];
  if (column.startsWith('attr:')) return c.attributes[column.slice(5)];
  return (c as unknown as Record<string, unknown>)[column];
}

const sorted = computed(() => {
  const { column, direction } = sort.value;
  const numeric = NUMERIC.has(column);
  const list = components.value.slice();
  const sign = direction === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const va = value(a, column);
    const vb = value(b, column);
    let r: number;
    if (numeric) {
      const na = typeof va === 'number' ? va : Number.NEGATIVE_INFINITY;
      const nb = typeof vb === 'number' ? vb : Number.NEGATIVE_INFINITY;
      r = na === nb ? 0 : na < nb ? -1 : 1;
    } else {
      r = compareText(String(va ?? ''), String(vb ?? ''));
    }
    return r !== 0 ? r * sign : compareText(a.part_code, b.part_code);
  });
  return list;
});

export const lowStockThreshold = computed(() => settings.value?.low_stock_threshold ?? 1);

export function isLowStock(c: Component): boolean {
  return c.quantity <= lowStockThreshold.value;
}

export const filtered = computed(() => {
  const q = search.value.trim();
  const cat = filterCategory.value;
  const sub = filterSubcategory.value;
  const loc = filterLocation.value;
  const low = lowStockOnly.value;
  const hay = haystacks.value;
  if (!q && cat === null && loc === null && !low) return sorted.value;
  return sorted.value.filter((c) => {
    if (cat !== null && categoryOf(c) !== cat) return false;
    if (sub !== null && c.subcategory !== sub) return false;
    if (loc !== null && c.location.trim() !== loc) return false;
    if (low && !isLowStock(c)) return false;
    if (q && !matchesAll(hay.get(c.id) ?? '', q)) return false;
    return true;
  });
});

export interface CategoryNode {
  name: string;
  count: number;
  subs: Array<{ name: string; count: number }>;
}

export const categoryTree = computed<CategoryNode[]>(() => {
  const m = new Map<string, Map<string, number>>();
  for (const c of components.value) {
    const cat = categoryOf(c);
    let subs = m.get(cat);
    if (!subs) m.set(cat, (subs = new Map()));
    subs.set(c.subcategory, (subs.get(c.subcategory) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, subs]) => ({
      name,
      count: [...subs.values()].reduce((a, b) => a + b, 0),
      subs: [...subs.entries()].filter(([s]) => s).map(([s, count]) => ({ name: s, count })).sort((a, b) => compareText(a.name, b.name)),
    }))
    .sort((a, b) => (a.name === UNCATEGORIZED ? 1 : b.name === UNCATEGORIZED ? -1 : compareText(a.name, b.name)));
});

export const storagePlaces = computed(() => {
  const m = new Map<string, number>();
  for (const c of components.value) {
    const l = c.location.trim();
    if (l) m.set(l, (m.get(l) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => compareText(a.name, b.name));
});

/** Storage place is shown once it is used, unless the owner chose otherwise (section 2 of the brief). */
export const showStoragePlace = computed(() => {
  const mode = settings.value?.show_storage_place ?? 'auto';
  return mode === 'show' || (mode === 'auto' && storagePlaces.value.length > 0);
});

export const stats = computed(() => {
  let pieces = 0;
  let low = 0;
  for (const c of components.value) {
    pieces += c.quantity;
    if (isLowStock(c)) low++;
  }
  return { parts: components.value.length, pieces, categories: categoryTree.value.length, low };
});

export async function loadInventory(): Promise<void> {
  const [list, use, cols] = await Promise.all([api.listComponents(), api.projectUsage(), api.listCustomColumns()]);
  batch(() => {
    components.value = list;
    usage.value = new Map(use.map((u) => [u.component_id, u]));
    customColumns.value = cols;
    loaded.value = true;
    const ids = new Set(list.map((c) => c.id));
    if ([...selection.value].some((id) => !ids.has(id))) selection.value = new Set([...selection.value].filter((id) => ids.has(id)));
  });
}

export async function refreshUsage(): Promise<void> {
  const use = await api.projectUsage();
  usage.value = new Map(use.map((u) => [u.component_id, u]));
}

/** Replaces or adds one part without reloading the list. */
export function upsertLocal(c: Component): void {
  const list = components.value;
  const i = list.findIndex((x) => x.id === c.id);
  components.value = i === -1 ? [...list, c] : [...list.slice(0, i), c, ...list.slice(i + 1)];
}

export function removeLocal(ids: number[]): void {
  const drop = new Set(ids);
  components.value = components.value.filter((c) => !drop.has(c.id));
  if (ids.some((id) => selection.value.has(id))) selection.value = new Set([...selection.value].filter((id) => !drop.has(id)));
}

export function clearFilters(): void {
  batch(() => {
    filterCategory.value = null;
    filterSubcategory.value = null;
    filterLocation.value = null;
    lowStockOnly.value = false;
    search.value = '';
  });
}
