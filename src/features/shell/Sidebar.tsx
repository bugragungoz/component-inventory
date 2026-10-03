import { batch, useSignal } from '@preact/signals';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { categoryIcon, subcategoryIcon } from '../../domain/taxonomy';
import { fold } from '../../domain/search';
import { formatNumber, t } from '../../i18n';
import {
  categoryTree, components, filterCategory, filterLocation, filterSubcategory, showStoragePlace, stats, storagePlaces,
} from '../../state/inventory';
import { saveSettings, settings, theme } from '../../state/settings';
import { placeTarget, renameTarget, view, type View } from '../../state/ui';
import { categoryLabel, subcategoryLabel } from '../inventory/labels';
import { api } from '../../api/commands';

const NAV: Array<{ view: View; icon: string; key: string }> = [
  { view: 'inventory', icon: 'inventory', key: 'nav.inventory' },
  { view: 'projects', icon: 'projects', key: 'nav.projects' },
  { view: 'import', icon: 'import', key: 'nav.import' },
  { view: 'backups', icon: 'backup', key: 'nav.backups' },
  { view: 'settings', icon: 'settings', key: 'nav.settings' },
];

export const MARK = (
  <svg class="wordmark-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
    <path d="M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5" />
    <circle cx="9.3" cy="9.3" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

function selectCategory(cat: string | null, sub: string | null = null) {
  batch(() => {
    filterCategory.value = cat;
    filterSubcategory.value = sub;
    filterLocation.value = null;
    view.value = 'inventory';
  });
}

export function Sidebar() {
  const query = useSignal('');
  const open = useSignal<Set<string>>(new Set());
  const q = fold(query.value.trim());
  const tree = categoryTree.value.filter((n) => !q || fold(n.name).includes(q) || fold(categoryLabel(n.name)).includes(q) || n.subs.some((s) => fold(s.name).includes(q) || fold(subcategoryLabel(s.name)).includes(q)));
  const toggle = (name: string) => {
    const s = new Set(open.value);
    if (s.has(name)) s.delete(name);
    else s.add(name);
    open.value = s;
  };
  return (
    <aside class="sidebar" aria-label={t('sidebar.label')}>
      <div class="wordmark">
        {MARK}
        <span class="wordmark-text">{t('app.name')}</span>
      </div>
      <nav class="nav" aria-label={t('sidebar.navLabel')}>
        {NAV.map((n) => (
          <button type="button" key={n.view} class="nav-item" aria-current={view.value === n.view ? 'page' : undefined} onClick={() => { view.value = n.view; }}>
            <Icon name={n.icon} size={18} />
            <span>{t(n.key)}</span>
            {n.view === 'inventory' ? <span class="nav-count num">{formatNumber(components.value.length)}</span> : null}
          </button>
        ))}
      </nav>

      {view.value === 'inventory' ? (
        <div class="sidebar-section sidebar-scroll">
          <div class="sidebar-head">
            <h2 class="sidebar-title">{t('sidebar.categories')}</h2>
          </div>
          <label class="sidebar-search">
            <Icon name="search" size={15} />
            <span class="sr-only">{t('sidebar.filterCategories')}</span>
            <input type="search" placeholder={t('sidebar.filterCategories')} value={query.value} onInput={(e) => { query.value = (e.currentTarget as HTMLInputElement).value; }} />
          </label>
          <ul class="tree" aria-label={t('sidebar.categories')}>
            <li>
              <button type="button" class="tree-row" aria-current={filterCategory.value === null && filterLocation.value === null ? 'true' : undefined} onClick={() => selectCategory(null)}>
                <Icon name="inventory" size={20} class="cat-icon" />
                <span class="tree-label">{t('sidebar.allParts')}</span>
                <span class="tree-count num">{formatNumber(stats.value.parts)}</span>
              </button>
            </li>
            {tree.map((node) => {
              const expanded = open.value.has(node.name) || (!!q && node.subs.length > 0) || filterCategory.value === node.name;
              return (
                <li key={node.name}>
                  <div class="tree-line">
                    <button
                      type="button"
                      
                      aria-expanded={node.subs.length ? expanded : undefined}
                      class="tree-row"
                      aria-current={filterCategory.value === node.name && filterSubcategory.value === null ? 'true' : undefined}
                      onClick={() => selectCategory(node.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' && !expanded) toggle(node.name);
                        if (e.key === 'ArrowLeft' && expanded) toggle(node.name);
                      }}
                    >
                      <Icon name={categoryIcon(node.name)} size={20} class="cat-icon" />
                      <span class="tree-label">{categoryLabel(node.name)}</span>
                      <span class="tree-count num">{formatNumber(node.count)}</span>
                    </button>
                    {node.subs.length ? (
                      <IconButton size="sm" class="tree-toggle" label={t(expanded ? 'sidebar.collapse' : 'sidebar.expand', { name: categoryLabel(node.name) })} icon={expanded ? 'chevronDown' : 'chevronRight'} onClick={() => toggle(node.name)} />
                    ) : null}
                    <IconButton size="sm" class="tree-rename" label={t('sidebar.rename', { name: categoryLabel(node.name) })} icon="edit" onClick={() => { renameTarget.value = { category: node.name, subcategory: null }; }} />
                  </div>
                  {expanded && node.subs.length ? (
                    <ul class="tree-group">
                      {node.subs.map((s) => (
                        <li key={s.name}>
                          <div class="tree-line">
                            <button type="button" class="tree-row tree-sub" aria-current={filterCategory.value === node.name && filterSubcategory.value === s.name ? 'true' : undefined} onClick={() => selectCategory(node.name, s.name)}>
                              <Icon name={subcategoryIcon(node.name, s.name)} size={18} class="cat-icon" />
                              <span class="tree-label">{subcategoryLabel(s.name)}</span>
                              <span class="tree-count num">{formatNumber(s.count)}</span>
                            </button>
                            <IconButton size="sm" class="tree-rename" label={t('sidebar.rename', { name: subcategoryLabel(s.name) })} icon="edit" onClick={() => { renameTarget.value = { category: node.name, subcategory: s.name }; }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {showStoragePlace.value && storagePlaces.value.length ? (
            <>
              <div class="sidebar-head">
                <h2 class="sidebar-title">{t('sidebar.storagePlaces')}</h2>
              </div>
              <ul class="tree" aria-label={t('sidebar.storagePlaces')}>
                {storagePlaces.value.map((p) => (
                  <li key={p.name}>
                    <div class="tree-line">
                      <button
                        type="button"
                        class="tree-row"
                        aria-current={filterLocation.value === p.name ? 'true' : undefined}
                        onClick={() => batch(() => { filterLocation.value = filterLocation.value === p.name ? null : p.name; filterCategory.value = null; filterSubcategory.value = null; })}
                      >
                        <Icon name="storage" size={18} class="cat-icon" />
                        <span class="tree-label">{p.name}</span>
                        <span class="tree-count num">{formatNumber(p.count)}</span>
                      </button>
                      <IconButton size="sm" class="tree-rename" label={t('place.renameTitle', { name: p.name })} icon="edit" onClick={() => { placeTarget.value = { kind: 'rename', from: p.name }; }} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <div class="sidebar-section sidebar-scroll" />
      )}

      {/* The counts are in the status bar, right below. */}
      <div class="sidebar-foot">
        <div class="sidebar-foot-actions">
          <IconButton
            label={theme.value === 'dark' ? t('settings.theme.switchLight') : t('settings.theme.switchDark')}
            icon={theme.value === 'dark' ? 'sun' : 'moon'}
            onClick={() => void saveSettings({ theme: theme.value === 'dark' ? 'light' : 'dark' })}
            disabled={!settings.value}
          />
          <IconButton label={t('about.github')} icon="github" onClick={() => void api.openUrl('https://github.com/bugragungoz/component-inventory').catch(() => {})} />
        </div>
      </div>
    </aside>
  );
}
