/** Rename a category or subcategory, choose table columns, list the keyboard shortcuts. */
import { batch } from '@preact/signals';
import { useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { Component, ColumnPref } from '../../api/types';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { TextField } from '../../components/Field';
import { IconButton } from '../../components/IconButton';
import { Kbd, Note } from '../../components/Misc';
import { Checkbox } from '../../components/Switch';
import { normalizeCategory } from '../../domain/taxonomy';
import { t } from '../../i18n';
import { categoryTree, components as allComponents, customColumns, filterCategory, filterLocation, filterSubcategory, loadInventory, storagePlaces } from '../../state/inventory';
import { saveSettings, settings } from '../../state/settings';
import { toast } from '../../state/toasts';
import { columnsOpen, placeTarget, renameTarget, shortcutsOpen } from '../../state/ui';
import { BASE_COLUMNS, customColumnDefs } from './columns';
import { categoryLabel, errorMessage, subcategoryLabel } from './labels';

export function RenameDialog({ target }: { target: { category: string; subcategory: string | null } }) {
  const isSub = target.subcategory !== null;
  const from = target.subcategory ?? target.category;
  const [name, setName] = useState(from);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = isSub
    ? categoryTree.value.find((n) => n.name === target.category)?.subs.find((s) => s.name === from)?.count ?? 0
    : categoryTree.value.find((n) => n.name === from)?.count ?? 0;
  const close = () => { renameTarget.value = null; };
  const submit = async (e: Event) => {
    e.preventDefault();
    const to = isSub ? name.trim() : normalizeCategory(name);
    if (!name.trim()) {
      setError(t('rename.errEmpty'));
      return;
    }
    if (to === from) {
      close();
      return;
    }
    setBusy(true);
    try {
      const r = await api.renameCategory(from, to, isSub ? target.category : null);
      await loadInventory();
      batch(() => {
        if (!isSub && filterCategory.value === from) filterCategory.value = to;
        if (isSub && filterSubcategory.value === from) filterSubcategory.value = to;
      });
      close();
      toast(t('rename.done', { count: r.count, name: isSub ? subcategoryLabel(to) : categoryLabel(to) }), { tone: 'ok' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const existing = !isSub && name.trim() && normalizeCategory(name) !== from && categoryTree.value.some((n) => n.name === normalizeCategory(name));
  return (
    <Dialog
      title={isSub ? t('rename.subTitle', { name: subcategoryLabel(from) }) : t('rename.title', { name: categoryLabel(from) })}
      onClose={close}
      busy={busy}
      size="question"
      actions={
        <>
          <Button onClick={close} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="rename-form" disabled={busy}>{t('rename.confirm')}</Button>
        </>
      }
    >
      <form id="rename-form" onSubmit={(e) => void submit(e)} class="stack">
        <TextField label={t('rename.newName')} value={name} onValue={(v) => { setName(v); setError(null); }} error={error} data-autofocus
          hint={t('rename.hint', { count })} />
        {existing ? <Note icon="merge" tone="info">{t('rename.mergeNote', { name: categoryLabel(normalizeCategory(name)) })}</Note> : null}
      </form>
    </Dialog>
  );
}

/**
 * Storage places mirror the owner's real boxes and drawers: put chosen parts in a place (a new name
 * creates it, an empty one takes them out), or rename a place for every part in it. One bulk patch
 * with a backup first, like the other bulk tools.
 */
export function PlaceDialog({ target }: { target: { kind: 'move'; parts: Component[] } | { kind: 'rename'; from: string } }) {
  const isRename = target.kind === 'rename';
  const from = isRename ? target.from : '';
  const parts = isRename ? partsIn(from) : target.parts;
  const [name, setName] = useState(from);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { placeTarget.value = null; };
  const to = name.trim();
  const joins = isRename && to !== from && storagePlaces.value.some((p) => p.name === to);
  const submit = async (e: Event) => {
    e.preventDefault();
    if (isRename && !to) {
      setError(t('rename.errEmpty'));
      return;
    }
    if (isRename && to === from) {
      close();
      return;
    }
    setBusy(true);
    try {
      const r = await api.applyPatches(parts.map((c) => ({ id: c.id, location: to })), 'storage place');
      await loadInventory();
      if (isRename && filterLocation.value === from) filterLocation.value = to;
      close();
      toast(to ? t('place.done', { count: r.count, name: to }) : t('place.cleared', { count: r.count }), { tone: 'ok' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={isRename ? t('place.renameTitle', { name: from }) : t('place.moveTitle', { count: parts.length })}
      onClose={close}
      busy={busy}
      size="question"
      actions={
        <>
          <Button onClick={close} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="place-form" disabled={busy}>{isRename ? t('rename.confirm') : t('place.move')}</Button>
        </>
      }
    >
      <form id="place-form" onSubmit={(e) => void submit(e)} class="stack">
        <TextField label={isRename ? t('rename.newName') : t('field.location')} value={name} onValue={(v) => { setName(v); setError(null); }} error={error} data-autofocus
          list="place-options" autoComplete="off" hint={isRename ? t('rename.hint', { count: parts.length }) : t('place.moveHint')} />
        <datalist id="place-options">{storagePlaces.value.map((p) => <option value={p.name} key={p.name} />)}</datalist>
        {joins ? <Note icon="merge" tone="info">{t('place.joinNote', { name: to })}</Note> : null}
      </form>
    </Dialog>
  );
}

function partsIn(place: string): Component[] {
  return allComponents.value.filter((c) => c.location === place);
}

export function ColumnsDialog() {
  const all = [...BASE_COLUMNS, ...customColumnDefs(customColumns.value)].filter((c) => !c.fixed);
  const saved = settings.value?.table_columns ?? [];
  const initial: ColumnPref[] = [
    ...saved.filter((p) => all.some((c) => c.key === p.key)),
    ...all.filter((c) => !saved.some((p) => p.key === c.key)).map((c) => ({ key: c.key, visible: c.defaultVisible })),
  ];
  const [prefs, setPrefs] = useState<ColumnPref[]>(initial);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const label = (key: string) => all.find((c) => c.key === key)?.label() ?? key;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= prefs.length) return;
    const next = prefs.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    setPrefs(next);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-col-row="${j}"] [data-move="${d}"]`)?.focus());
  };
  const close = () => { columnsOpen.value = false; };
  const save = async () => {
    setBusy(true);
    try {
      await saveSettings({ table_columns: prefs });
      close();
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };
  const addCustom = async (e: Event) => {
    e.preventDefault();
    const name = newLabel.trim();
    if (!name) return;
    try {
      const col = await api.saveCustomColumn({ id: null, col_label: name, col_type: 'text', is_visible: true, order_index: customColumns.value.length });
      customColumns.value = [...customColumns.value, col];
      setPrefs((p) => [...p, { key: col.col_key, visible: true }]);
      setNewLabel('');
    } catch (err) {
      toast(errorMessage(err), { tone: 'warn' });
    }
  };
  return (
    <Dialog
      title={t('columns.title')}
      onClose={close}
      busy={busy}
      actions={
        <>
          <Button variant="quiet" onClick={() => setPrefs(all.map((c) => ({ key: c.key, visible: c.defaultVisible })))}>{t('columns.reset')}</Button>
          <span class="grow" />
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>{t('common.save')}</Button>
        </>
      }
    >
      <p class="muted">{t('columns.body')}</p>
      <ul class="column-list">
        {prefs.map((p, i) => (
          <li key={p.key} data-col-row={i}>
            <Checkbox label={label(p.key)} checked={p.visible} onChange={(on) => setPrefs(prefs.map((x) => (x.key === p.key ? { ...x, visible: on } : x)))} />
            <span class="grow" />
            <IconButton size="sm" icon="chevronUp" label={t('columns.moveUp', { name: label(p.key) })} onClick={() => move(i, -1)} disabled={i === 0} data-move="-1" />
            <IconButton size="sm" icon="chevronDown" label={t('columns.moveDown', { name: label(p.key) })} onClick={() => move(i, 1)} disabled={i === prefs.length - 1} data-move="1" />
          </li>
        ))}
      </ul>
      <form class="inline-form" onSubmit={(e) => void addCustom(e)}>
        <TextField label={t('columns.newCustom')} value={newLabel} onValue={setNewLabel} hint={t('columns.newCustomHint')} />
        <Button type="submit" icon="plus" disabled={!newLabel.trim()}>{t('columns.add')}</Button>
      </form>
    </Dialog>
  );
}

const SHORTCUTS: Array<[string[], string]> = [
  [['Ctrl', 'F'], 'shortcuts.search'],
  [['/'], 'shortcuts.search'],
  [['Ctrl', 'N'], 'shortcuts.add'],
  [['Ctrl', 'I'], 'shortcuts.import'],
  [['↑', '↓'], 'shortcuts.move'],
  [['Enter'], 'shortcuts.open'],
  [['Space'], 'shortcuts.select'],
  [['Delete'], 'shortcuts.delete'],
  [['Esc'], 'shortcuts.close'],
  [['?'], 'shortcuts.help'],
];

export function ShortcutsDialog() {
  return (
    <Dialog title={t('shortcuts.title')} onClose={() => { shortcutsOpen.value = false; }} size="question">
      <dl class="shortcut-list">
        {SHORTCUTS.map(([keys, label]) => (
          <div class="kv" key={keys.join('+')}>
            <dt>{keys.map((k, i) => <span key={k}>{i ? ' ' : ''}<Kbd>{k}</Kbd></span>)}</dt>
            <dd>{t(label)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
