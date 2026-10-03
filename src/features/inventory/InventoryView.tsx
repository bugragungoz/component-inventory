/**
 * The inventory: toolbar (search, filters, columns, export, import, add), the selection bar, the
 * table and the detail panel beside it.
 */
import { batch } from '@preact/signals';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { Menu } from '../../components/Menu';
import { EmptyState, Kbd } from '../../components/Misc';
import { t } from '../../i18n';
import {
  clearFilters, components, filterCategory, filterLocation, filterSubcategory, filtered, lowStockOnly, search, selection, stats,
} from '../../state/inventory';
import { assignTo, bulkOpen, columnsOpen, detailId, editing, exportOpen, labelsFor, placeTarget, view } from '../../state/ui';
import { askDelete } from './actions';
import { DetailPanel } from './DetailPanel';
import { categoryLabel, subcategoryLabel } from './labels';
import { Table } from './Table';

function SearchBox() {
  return (
    <label class="search-box">
      <Icon name="search" size={16} />
      <span class="sr-only">{t('inventory.search')}</span>
      <input
        id="inventory-search"
        type="search"
        placeholder={t('inventory.searchPlaceholder')}
        value={search.value}
        autoComplete="off"
        spellcheck={false}
        onInput={(e) => { search.value = (e.currentTarget as HTMLInputElement).value; }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && search.value) {
            e.stopPropagation();
            search.value = '';
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            document.querySelector<HTMLElement>('.table [data-row="0"]')?.focus();
          }
        }}
      />
      {search.value ? (
        <IconButton size="sm" class="search-clear" icon="close" label={t('inventory.clearSearch')} onClick={() => { search.value = ''; document.getElementById('inventory-search')?.focus(); }} />
      ) : (
        <span class="search-hint" aria-hidden="true"><Kbd>Ctrl</Kbd><Kbd>F</Kbd></span>
      )}
    </label>
  );
}

function ActiveFilters() {
  const cat = filterCategory.value;
  const sub = filterSubcategory.value;
  const loc = filterLocation.value;
  if (!cat && !loc) return null;
  return (
    <div class="active-filters">
      {cat ? (
        <Chip selected onClick={() => batch(() => { filterCategory.value = null; filterSubcategory.value = null; })} title={t('inventory.removeFilter')}>
          <span>{sub ? `${categoryLabel(cat)} / ${subcategoryLabel(sub)}` : categoryLabel(cat)}</span>
          <Icon name="close" size={13} />
        </Chip>
      ) : null}
      {loc ? (
        <Chip selected onClick={() => { filterLocation.value = null; }} title={t('inventory.removeFilter')}>
          <Icon name="storage" size={14} />
          <span>{loc}</span>
          <Icon name="close" size={13} />
        </Chip>
      ) : null}
    </div>
  );
}

function SelectionBar() {
  const ids = selection.value;
  if (!ids.size) return null;
  const chosen = components.value.filter((c) => ids.has(c.id));
  return (
    <div class="selection-bar" role="region" aria-label={t('selection.label')}>
      <strong class="num">{t('selection.count', { count: chosen.length })}</strong>
      <Button size="sm" variant="quiet" icon="projects" onClick={() => { assignTo.value = chosen; }}>{t('selection.assign')}</Button>
      <Button size="sm" variant="quiet" icon="label" onClick={() => { labelsFor.value = chosen; }}>{t('selection.labels')}</Button>
      <Button size="sm" variant="quiet" icon="storage" onClick={() => { placeTarget.value = { kind: 'move', parts: chosen }; }}>{t('selection.moveToPlace')}</Button>
      <Button size="sm" variant="quiet" onClick={() => { bulkOpen.value = true; }}>{t('selection.autoCategorize')}</Button>
      <Button size="sm" variant="danger" icon="trash" onClick={() => void askDelete(chosen)}>{t('selection.delete')}</Button>
      <span class="grow" />
      <Button size="sm" variant="quiet" onClick={() => { selection.value = new Set(); }}>{t('selection.clear')}</Button>
    </div>
  );
}

export function InventoryView() {
  const total = components.value.length;
  const shown = filtered.value.length;
  const s = stats.value;
  const filteredOut = shown !== total;
  return (
    <div class="view inventory-view">
      <header class="toolbar">
        <h1 class="sr-only">{t('nav.inventory')}</h1>
        <SearchBox />
        <Chip selected={lowStockOnly.value} onClick={() => { lowStockOnly.value = !lowStockOnly.value; }} disabled={!s.low && !lowStockOnly.value}>
          {lowStockOnly.value ? <Icon name="check" size={14} /> : <Icon name="alert" size={14} />}
          <span>{t('inventory.lowStock', { count: s.low })}</span>
        </Chip>
        <ActiveFilters />
        <span class="grow" />
        {filteredOut ? <span class="toolbar-count muted num" aria-live="polite">{t('inventory.showing', { shown, count: total })}</span> : null}
        <IconButton icon="columns" label={t('inventory.columns')} onClick={() => { columnsOpen.value = true; }} />
        <Menu
          label={t('inventory.more')}
          trigger={(p) => <IconButton icon="more" label={t('inventory.more')} {...p} />}
          items={[
            { label: t('inventory.labelsAll'), icon: 'label', onSelect: () => { labelsFor.value = filtered.value; }, disabled: !shown },
            { label: t('inventory.autoCategorize'), onSelect: () => { bulkOpen.value = true; }, disabled: !total },
            'separator',
            { label: t('inventory.export'), icon: 'export', onSelect: () => { exportOpen.value = true; }, disabled: !total },
          ]}
        />
        <Button icon="import" onClick={() => { view.value = 'import'; }}>{t('inventory.import')}</Button>
        <Button variant="primary" icon="plus" onClick={() => { editing.value = 'new'; }}>{t('inventory.add')}</Button>
      </header>
      <SelectionBar />
      <div class={detailId.value !== null ? 'inventory-body has-panel' : 'inventory-body'}>
        {total === 0 ? (
          <EmptyState
            icon="inventory"
            title={t('inventory.emptyTitle')}
            actions={
              <>
                <Button variant="primary" icon="plus" onClick={() => { editing.value = 'new'; }}>{t('inventory.add')}</Button>
                <Button icon="import" onClick={() => { view.value = 'import'; }}>{t('inventory.import')}</Button>
              </>
            }
          >
            {t('inventory.emptyBody')}
          </EmptyState>
        ) : shown === 0 ? (
          <EmptyState icon="search" title={t('inventory.noMatchTitle')} actions={<Button onClick={clearFilters}>{t('inventory.clearFilters')}</Button>}>
            {search.value ? t('inventory.noMatchSearch', { query: search.value }) : t('inventory.noMatchFilter')}
          </EmptyState>
        ) : (
          <Table />
        )}
        {detailId.value !== null ? <DetailPanel id={detailId.value} /> : null}
      </div>
    </div>
  );
}
