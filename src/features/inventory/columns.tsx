/**
 * Table columns. The owner chooses which ones show and their order (Columns dialog, stored in
 * settings.table_columns). Filtering one category adds that category's parameters (MOSFET R_DS(on),
 * BJT h_FE ...) as columns, as the old app did.
 */
import type { JSX } from 'preact';
import type { Component, CustomColumn } from '../../api/types';
import { Badge } from '../../components/Misc';
import { Icon } from '../../components/Icon';
import { detectSchemaKey, ATTRIBUTE_SCHEMAS } from '../../domain/attributes';
import { subcategoryIcon } from '../../domain/taxonomy';
import { formatDateTime, formatNumber, parseDbDate, t } from '../../i18n';
import { categoryOf, isLowStock, usage } from '../../state/inventory';
import { attrLabel, categoryLabel, fieldLabel, subcategoryLabel } from './labels';

export interface ColumnDef {
  key: string;
  label: () => string;
  /** CSS grid track. */
  width: string;
  align?: 'end';
  sortable: boolean;
  mono?: boolean;
  render: (c: Component) => JSX.Element | string | null;
  defaultVisible: boolean;
  /** Not in the Columns dialog (always shown). */
  fixed?: boolean;
  /** The text a cell shows, for fitting the column to its longest value (Table.tsx). */
  text?: (c: Component) => string;
  /** Extra width a cell needs besides its text (an icon, a badge's padding). */
  extra?: number;
}

const num = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? null : `${formatNumber(v)} ${unit}`);
const text = (v: string) => v || null;

function quantityCell(c: Component) {
  const u = usage.value.get(c.id);
  const low = isLowStock(c);
  return (
    <span class="qty-cell">
      <span class={low ? 'qty low' : 'qty'} title={low ? t('table.lowStockTitle') : undefined}>
        {low ? <Icon name="alert" size={12} /> : null}
        {formatNumber(c.quantity)}
      </span>
      {u ? <span class="usage" title={t('table.usageTitle', { count: u.project_count, required: u.total_required })}>{t('table.usage', { count: u.project_count })}</span> : null}
    </span>
  );
}

export const BASE_COLUMNS: ColumnDef[] = [
  {
    key: 'part_code', label: () => fieldLabel('part_code'), width: 'minmax(170px, 1.1fr)', sortable: true, mono: true, defaultVisible: true, fixed: true, text: (c) => c.part_code, extra: 26,
    render: (c) => (
      <span class="code-cell">
        <Icon name={subcategoryIcon(categoryOf(c), c.subcategory)} size={18} class="cat-icon" />
        <span class="truncate" title={c.part_code}>{c.part_code}</span>
      </span>
    ),
  },
  { key: 'category', label: () => fieldLabel('category'), width: 'minmax(140px, 0.8fr)', sortable: true, defaultVisible: true, text: (c) => categoryLabel(categoryOf(c)), extra: 26, render: (c) => <Badge title={categoryLabel(categoryOf(c))}>{categoryLabel(categoryOf(c))}</Badge> },
  { key: 'subcategory', label: () => fieldLabel('subcategory'), width: 'minmax(150px, 1fr)', sortable: true, defaultVisible: true, text: (c) => (c.subcategory ? subcategoryLabel(c.subcategory) : ''), render: (c) => (c.subcategory ? <span class="truncate muted" title={c.subcategory}>{subcategoryLabel(c.subcategory)}</span> : null) },
  { key: 'quantity', label: () => fieldLabel('quantity'), width: '112px', align: 'end', sortable: true, defaultVisible: true, fixed: true, render: quantityCell },
  { key: 'description', label: () => fieldLabel('description'), width: 'minmax(220px, 2.4fr)', sortable: true, defaultVisible: true, text: (c) => c.description, render: (c) => <span class="truncate muted" title={c.description}>{c.description}</span> },
  { key: 'package', label: () => fieldLabel('package'), width: '110px', sortable: true, mono: true, defaultVisible: true, text: (c) => c.package, render: (c) => text(c.package) },
  { key: 'location', label: () => fieldLabel('location'), width: 'minmax(130px, 0.7fr)', sortable: true, defaultVisible: true, text: (c) => c.location, render: (c) => (c.location ? <span class="truncate" title={c.location}>{c.location}</span> : null) },
  { key: 'manufacturer', label: () => fieldLabel('manufacturer'), width: 'minmax(110px, 0.7fr)', sortable: true, defaultVisible: false, text: (c) => c.manufacturer, render: (c) => (c.manufacturer ? <span class="truncate">{c.manufacturer}</span> : null) },
  { key: 'mpn', label: () => fieldLabel('mpn'), width: 'minmax(120px, 0.8fr)', sortable: true, mono: true, defaultVisible: false, text: (c) => c.mpn, render: (c) => (c.mpn ? <span class="truncate">{c.mpn}</span> : null) },
  { key: 'preferred_supplier', label: () => fieldLabel('preferred_supplier'), width: '120px', sortable: true, defaultVisible: false, text: (c) => c.preferred_supplier, render: (c) => text(c.preferred_supplier) },
  { key: 'resistance', label: () => fieldLabel('resistance'), width: '96px', sortable: true, mono: true, defaultVisible: false, text: (c) => c.resistance, render: (c) => text(c.resistance) },
  { key: 'tolerance', label: () => fieldLabel('tolerance'), width: '88px', sortable: true, mono: true, defaultVisible: false, text: (c) => c.tolerance, render: (c) => text(c.tolerance) },
  { key: 'voltage_max', label: () => fieldLabel('voltage_max'), width: '96px', align: 'end', sortable: true, mono: true, defaultVisible: false, render: (c) => num(c.voltage_max, 'V') },
  { key: 'current_max', label: () => fieldLabel('current_max'), width: '96px', align: 'end', sortable: true, mono: true, defaultVisible: false, render: (c) => num(c.current_max, 'A') },
  { key: 'power_rating', label: () => fieldLabel('power_rating'), width: '96px', align: 'end', sortable: true, mono: true, defaultVisible: false, render: (c) => num(c.power_rating, 'W') },
  { key: 'unit_price', label: () => fieldLabel('unit_price'), width: '96px', align: 'end', sortable: true, mono: true, defaultVisible: false, render: (c) => (c.unit_price === null ? null : formatNumber(c.unit_price, undefined, { maximumFractionDigits: 4 })) },
  { key: 'updated_at', label: () => fieldLabel('updated_at'), width: '150px', sortable: true, defaultVisible: false, render: (c) => <span class="muted">{formatDateTime(parseDbDate(c.updated_at))}</span> },
];

export function customColumnDefs(custom: CustomColumn[]): ColumnDef[] {
  return custom.map((cc) => ({
    key: cc.col_key,
    label: () => cc.col_label,
    width: cc.col_type === 'number' ? '100px' : 'minmax(110px, 0.8fr)',
    align: cc.col_type === 'number' ? 'end' : undefined,
    sortable: true,
    defaultVisible: cc.is_visible,
    text: (c: Component) => String(c.custom_fields[cc.col_key] ?? ''),
    render: (c: Component) => {
      const v = c.custom_fields[cc.col_key];
      return v === undefined || v === null || v === '' ? null : <span class="truncate">{String(v)}</span>;
    },
  }));
}

/** Parameter columns for the category (and subcategory) being filtered. */
export function attributeColumnDefs(category: string | null, subcategory: string | null): ColumnDef[] {
  if (!category) return [];
  const key = detectSchemaKey(category, subcategory ?? '');
  const schema = key ? ATTRIBUTE_SCHEMAS[key] : null;
  if (!schema) return [];
  return schema.fields.slice(0, 4).map((f) => ({
    key: `attr:${f.key}`,
    label: () => (f.unit ? `${attrLabel(f.key)} (${f.unit})` : attrLabel(f.key)),
    width: '104px',
    align: f.type === 'number' ? 'end' : undefined,
    sortable: true,
    mono: f.type === 'number',
    defaultVisible: true,
    render: (c: Component) => {
      const v = c.attributes[f.key];
      return v === undefined || v === null || v === '' ? null : String(v);
    },
  }));
}
