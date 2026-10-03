/**
 * The inventory table: no pages, every row scrolls, only the rows in view are in the DOM
 * (`computeWindow`). Fixed row height, one scroller with a sticky header, CSS grid columns shared
 * by every row. role="grid" with aria-rowcount/rowindex; arrows move, Enter opens, Space selects,
 * Delete asks to delete.
 */
import { useComputed } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Component } from '../../api/types';
import { Checkbox } from '../../components/Switch';
import { IconButton } from '../../components/IconButton';
import { Icon } from '../../components/Icon';
import { computeWindow } from '../../domain/virtualWindow';
import { locale, t } from '../../i18n';
import { components, customColumns, filterCategory, filterSubcategory, filtered, selection, showStoragePlace, sort } from '../../state/inventory';
import { saveSettings, settings } from '../../state/settings';
import { detailId, editing } from '../../state/ui';
import { attributeColumnDefs, BASE_COLUMNS, customColumnDefs, type ColumnDef } from './columns';
import { askDelete } from './actions';
import { fitColumns, type Font, type Measure } from './fit';

export const ROW_HEIGHT = 36;

let measureCtx: CanvasRenderingContext2D | null = null;
/** Text width in the table's own fonts (the CSS variables, so a font change is followed). */
const measureText: Measure = (text, font) => {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 8;
  const css = getComputedStyle(document.documentElement);
  const ui = css.getPropertyValue('--font-ui').trim() || 'sans-serif';
  const mono = css.getPropertyValue('--font-mono').trim() || 'monospace';
  const fonts: Record<Font, string> = { head: `600 12px ${ui}`, cell: `500 13px ${ui}`, mono: `500 12.5px ${mono}` };
  measureCtx.font = fonts[font];
  return measureCtx.measureText(text).width;
};

/** Bumped when the bundled fonts finish loading, so widths are measured again in the real font. */
function useFontsReady(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => { if (live) setN((v) => v + 1); }, () => {});
    return () => { live = false; };
  }, []);
  return n;
}

/** The visible columns in the owner's order. */
export function useVisibleColumns(): ColumnDef[] {
  return useComputed(() => {
    const all = [...BASE_COLUMNS, ...customColumnDefs(customColumns.value)];
    const prefs = settings.value?.table_columns ?? [];
    const byKey = new Map(all.map((c) => [c.key, c]));
    const ordered: ColumnDef[] = [];
    for (const p of prefs) {
      const c = byKey.get(p.key);
      if (c && (p.visible || c.fixed)) ordered.push(c);
      byKey.delete(p.key);
    }
    for (const c of byKey.values()) {
      if (!(c.defaultVisible || c.fixed)) continue;
      // The Columns dialog does not list the fixed columns (part code, quantity), so a saved order
      // lacks them: they keep their default place instead of landing at the far end, off screen.
      const at = c.fixed ? all.indexOf(c) : -1;
      if (at >= 0 && at < ordered.length) ordered.splice(at, 0, c);
      else ordered.push(c);
    }
    const withPlace = ordered.filter((c) => c.key !== 'location' || showStoragePlace.value || prefs.some((p) => p.key === 'location' && p.visible));
    const attrs = attributeColumnDefs(filterCategory.value, filterSubcategory.value);
    const qtyAt = withPlace.findIndex((c) => c.key === 'quantity');
    return qtyAt === -1 ? [...withPlace, ...attrs] : [...withPlace.slice(0, qtyAt + 1), ...attrs, ...withPlace.slice(qtyAt + 1)];
  }).value;
}

function SortButton({ col }: { col: ColumnDef }) {
  const active = sort.value.column === col.key;
  const dir = active ? sort.value.direction : null;
  if (!col.sortable) return <span>{col.label()}</span>;
  return (
    <button
      type="button"
      class="th-sort"
      onClick={() => {
        const next = active && dir === 'asc' ? 'desc' : 'asc';
        sort.value = { column: col.key, direction: next };
        if (!col.key.startsWith('attr:')) void saveSettings({ table_sort: { column: col.key, direction: next } }).catch(() => {});
      }}
    >
      <span class="truncate">{col.label()}</span>
      <Icon name={dir === 'desc' ? 'arrowDown' : 'arrowUp'} size={13} class={active ? 'sort-icon is-active' : 'sort-icon'} />
    </button>
  );
}

export function Table() {
  const rows = filtered.value;
  const cols = useVisibleColumns();
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 600 });
  const [active, setActive] = useState(0);
  const fontsReady = useFontsReady();
  const all = components.value;
  const lang = locale.value;
  // Every row is its own grid, so the widths must not depend on a row's content: they come from
  // the whole inventory (not the filtered rows, so they do not jump while typing a search).
  const fitted = useMemo(() => fitColumns(cols, all, measureText), [cols.map((c) => c.key).join('|'), all, lang, fontsReady]);
  const template = `40px ${fitted.tracks.join(' ')} 76px`;
  const minWidth = 40 + 76 + fitted.min;

  useLayoutEffect(() => {
    const el = scroller.current!;
    const ro = new ResizeObserver(() => setView((v) => ({ ...v, height: el.clientHeight })));
    ro.observe(el);
    setView({ top: el.scrollTop, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // A new filter or search starts at the top.
  useEffect(() => {
    setActive(0);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [rows.length, filterCategory.value]);

  const w = computeWindow({ scrollTop: view.top, viewportHeight: view.height - ROW_HEIGHT, rowHeight: ROW_HEIGHT, total: rows.length, overscan: 10 });
  const sel = selection.value;
  // O(rows) only when something is selected; a scroll must not walk 100,000 rows.
  const { allSelected, someSelected } = useMemo(() => {
    if (!sel.size || !rows.length) return { allSelected: false, someSelected: false };
    const all = rows.every((r) => sel.has(r.id));
    return { allSelected: all, someSelected: !all && rows.some((r) => sel.has(r.id)) };
  }, [rows, sel]);

  const toggle = (id: number, on: boolean) => {
    const s = new Set(sel);
    if (on) s.add(id);
    else s.delete(id);
    selection.value = s;
  };

  const focusRow = (i: number) => {
    const el = scroller.current;
    if (!el || !rows.length) return;
    const idx = Math.max(0, Math.min(rows.length - 1, i));
    setActive(idx);
    const top = idx * ROW_HEIGHT;
    const bodyH = el.clientHeight - ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + bodyH) el.scrollTop = top + ROW_HEIGHT - bodyH;
    requestAnimationFrame(() => el.querySelector<HTMLElement>(`[data-row="${idx}"]`)?.focus());
  };

  const onRowKey = (e: KeyboardEvent, i: number, c: Component) => {
    if (e.target !== e.currentTarget) return;
    const page = Math.max(1, Math.floor((view.height - ROW_HEIGHT) / ROW_HEIGHT) - 1);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusRow(i + 1); break;
      case 'ArrowUp': e.preventDefault(); focusRow(i - 1); break;
      case 'PageDown': e.preventDefault(); focusRow(i + page); break;
      case 'PageUp': e.preventDefault(); focusRow(i - page); break;
      case 'Home': e.preventDefault(); focusRow(0); break;
      case 'End': e.preventDefault(); focusRow(rows.length - 1); break;
      case 'Enter': e.preventDefault(); detailId.value = c.id; break;
      case ' ': e.preventDefault(); toggle(c.id, !sel.has(c.id)); break;
      case 'Delete': e.preventDefault(); void askDelete([c]); break;
      default:
    }
  };

  return (
    <div
      class="table"
      role="grid"
      aria-label={t('table.label')}
      aria-rowcount={rows.length + 1}
      aria-colcount={cols.length + 2}
      ref={scroller}
      onScroll={(e) => {
        const top = (e.currentTarget as HTMLDivElement).scrollTop;
        setView((v) => (v.top === top ? v : { ...v, top }));
      }}
      style={{ '--cols': template, '--min-w': `${minWidth}px` }}
    >
      <div class="thead" role="row" aria-rowindex={1}>
        <div class="th th-check" role="columnheader">
          <Checkbox
            label={t('table.selectAll')}
            hideLabel
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(on) => { selection.value = on ? new Set([...sel, ...rows.map((r) => r.id)]) : new Set([...sel].filter((id) => !rows.some((r) => r.id === id))); }}
          />
        </div>
        {cols.map((c) => (
          <div class={['th', c.align === 'end' && 'is-end'].filter(Boolean).join(' ')} role="columnheader" key={c.key}
            aria-sort={sort.value.column === c.key ? (sort.value.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
            <SortButton col={c} />
          </div>
        ))}
        <div class="th" role="columnheader">
          <span class="sr-only">{t('table.actions')}</span>
        </div>
      </div>
      <div class="tbody" role="rowgroup" style={{ height: `${rows.length * ROW_HEIGHT}px` }}>
        {rows.slice(w.start, w.end).map((c, k) => {
          const i = w.start + k;
          const selected = sel.has(c.id);
          return (
            <div
              key={c.id}
              class={['tr', selected && 'is-selected', detailId.value === c.id && 'is-open'].filter(Boolean).join(' ')}
              role="row"
              aria-rowindex={i + 2}
              aria-selected={selected}
              data-row={i}
              data-id={c.id}
              tabIndex={i === active ? 0 : -1}
              style={{ transform: `translateY(${i * ROW_HEIGHT}px)` }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button, input, label')) return;
                setActive(i);
                detailId.value = c.id;
              }}
              onKeyDown={(e) => onRowKey(e, i, c)}
              onFocus={() => setActive(i)}
            >
              <div class="td td-check" role="gridcell">
                <Checkbox label={t('table.selectRow', { code: c.part_code })} hideLabel checked={selected} onChange={(on) => toggle(c.id, on)} />
              </div>
              {cols.map((col) => (
                <div class={['td', col.align === 'end' && 'is-end', col.mono && 'mono'].filter(Boolean).join(' ')} role="gridcell" key={col.key}>
                  {col.render(c)}
                </div>
              ))}
              <div class="td td-actions" role="gridcell">
                <IconButton size="sm" icon="edit" label={t('table.editPart', { code: c.part_code })} onClick={() => { editing.value = c; }} tabIndex={-1} />
                <IconButton size="sm" icon="trash" label={t('table.deletePart', { code: c.part_code })} onClick={() => void askDelete([c])} tabIndex={-1} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
