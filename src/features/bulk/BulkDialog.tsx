/**
 * Bulk auto-categorize: lists suggestions with where each one comes from and how sure it is; the
 * owner ticks what to apply. A backup is taken before anything changes and Undo restores it.
 */
import { useMemo, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { ComponentPatch } from '../../api/types';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Badge, EmptyState, Tabs } from '../../components/Misc';
import { Select } from '../../components/Field';
import { allSuggestions, type Suggestion } from '../../domain/bulk';
import { UNCATEGORIZED } from '../../domain/taxonomy';
import { t } from '../../i18n';
import { categoryOf, components, loadInventory, selection } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { bulkOpen, view } from '../../state/ui';
import { categoryLabel, errorMessage, fieldLabel, subcategoryLabel } from '../inventory/labels';

type Scope = 'all' | 'uncategorized' | 'selected';
type Kind = Suggestion['kind'];

function keyOf(s: Suggestion): string {
  return s.kind === 'merge' ? `merge:${s.canonical}` : `${s.kind}:${s.part.id}`;
}

function Describe({ s }: { s: Suggestion }) {
  if (s.kind === 'merge') {
    return (
      <span>
        <strong class="mono">{s.members.map((m) => m.part_code).join(' + ')}</strong> → <strong class="mono">{s.canonical}</strong>{' '}
        <span class="muted num">{t('bulk.mergeTotal', { count: s.total })}</span>
      </span>
    );
  }
  const from = categoryLabel(s.part.category || UNCATEGORIZED);
  if (s.kind === 'normalize') return <span><strong class="mono">{s.part.part_code}</strong> {from} → {categoryLabel(s.category)}</span>;
  if (s.kind === 'categorize') {
    return (
      <span>
        <strong class="mono">{s.part.part_code}</strong> {from} → {categoryLabel(s.category)}{s.subcategory ? ` / ${subcategoryLabel(s.subcategory)}` : ''}
        {s.misfiled ? <> <Badge tone="warn">{t('bulk.misfiled')}</Badge></> : null}
      </span>
    );
  }
  return (
    <span>
      <strong class="mono">{s.part.part_code}</strong>{' '}
      <span class="muted">{Object.keys(s.patch).map((k) => fieldLabel(k)).join(', ')}</span>
    </span>
  );
}

export function BulkDialog() {
  const [scope, setScope] = useState<Scope>(selection.value.size ? 'selected' : 'all');
  const [tab, setTab] = useState<Kind>('categorize');
  const [busy, setBusy] = useState(false);
  const parts = useMemo(() => {
    const all = components.value;
    if (scope === 'selected') return all.filter((c) => selection.value.has(c.id));
    if (scope === 'uncategorized') return all.filter((c) => categoryOf(c) === UNCATEGORIZED);
    return all;
  }, [scope, components.value]);
  const suggestions = useMemo(() => allSuggestions(parts), [parts]);
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const picked = chosen ?? new Set(suggestions.filter((s) => s.confidence === 'high' && !(s.kind === 'categorize' && s.misfiled)).map(keyOf));
  const byKind = (k: Kind) => suggestions.filter((s) => s.kind === k);
  const shown = byKind(tab);
  const close = () => { bulkOpen.value = false; };
  const toggle = (k: string, on: boolean) => {
    const s = new Set(picked);
    if (on) s.add(k);
    else s.delete(k);
    setChosen(s);
  };

  const apply = async () => {
    const list = suggestions.filter((s) => picked.has(keyOf(s)));
    if (!list.length) return;
    setBusy(true);
    let backup = '';
    let changed = 0;
    try {
      // Merges first (they remove parts), then one batch of field patches.
      for (const s of list) {
        if (s.kind !== 'merge') continue;
        const keep = s.members.find((m) => m.part_code.toUpperCase() === s.canonical) ?? s.members[0]!;
        await api.mergeComponents(keep.id, s.members.filter((m) => m.id !== keep.id).map((m) => m.id), s.canonical);
        changed += s.members.length;
      }
      const merged = new Set(list.flatMap((s) => (s.kind === 'merge' ? s.members.map((m) => m.id) : [])));
      const patches = new Map<number, ComponentPatch>();
      for (const s of list) {
        if (s.kind === 'merge' || merged.has(s.part.id)) continue;
        const p = patches.get(s.part.id) ?? { id: s.part.id };
        if (s.kind === 'normalize') p.category = s.category;
        if (s.kind === 'categorize') {
          p.category = s.category;
          if (s.subcategory) p.subcategory = s.subcategory;
        }
        if (s.kind === 'enrich') Object.assign(p, s.patch);
        patches.set(s.part.id, p);
      }
      if (patches.size) {
        const r = await api.applyPatches([...patches.values()], 'auto-categorize');
        backup = r.backup_file;
        changed += r.count;
      }
      await loadInventory();
      close();
      toast(t('bulk.applied', { count: changed }), {
        tone: 'ok', duration: 10000, actionLabel: backup ? t('bulk.seeBackups') : undefined,
        onAction: backup ? () => { view.value = 'backups'; } : undefined,
      });
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
      await loadInventory().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const kinds: Kind[] = ['categorize', 'normalize', 'enrich', 'merge'];
  return (
    <Dialog
      title={t('bulk.title')}
      onClose={close}
      busy={busy}
      size="wide"
      actions={
        <>
          <span class="muted num">{t('bulk.selected', { count: picked.size })}</span>
          <span class="grow" />
          <Button onClick={close} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void apply()} disabled={busy || !picked.size}>{t('bulk.apply', { count: picked.size })}</Button>
        </>
      }
    >
      <div class="bulk-head">
        <Select label={t('bulk.scope')} value={scope} onValue={(v) => { setScope(v as Scope); setChosen(null); }}
          options={[
            { value: 'all', label: t('bulk.scopeAll', { count: components.value.length }) },
            { value: 'uncategorized', label: t('bulk.scopeUncategorized') },
            ...(selection.value.size ? [{ value: 'selected', label: t('bulk.scopeSelected', { count: selection.value.size }) }] : []),
          ]} />
        <p class="muted">{t('bulk.body')}</p>
      </div>
      <Tabs value={tab} onChange={setTab} label={t('bulk.kinds')} tabs={kinds.map((k) => ({ value: k, label: t(`bulk.kind.${k}`), count: byKind(k).length }))} />
      {shown.length ? (
        <>
          <div class="inline-actions">
            <Button size="sm" variant="quiet" onClick={() => setChosen(new Set([...picked, ...shown.map(keyOf)]))}>{t('bulk.selectAll')}</Button>
            <Button size="sm" variant="quiet" onClick={() => setChosen(new Set([...picked].filter((k) => !shown.some((s) => keyOf(s) === k))))}>{t('bulk.selectNone')}</Button>
          </div>
          <ul class="bulk-list">
            {shown.map((s) => {
              const k = keyOf(s);
              return (
                <li key={k}>
                  <label class="bulk-row">
                    <input type="checkbox" checked={picked.has(k)} onChange={(e) => toggle(k, (e.currentTarget as HTMLInputElement).checked)} />
                    <Describe s={s} />
                    <span class="grow" />
                    {s.kind === 'categorize' ? <span class="muted">{t(`bulk.source.${s.source}`)}</span> : null}
                    <Badge tone={s.confidence === 'high' ? 'ok' : 'muted'}>{t(`bulk.confidence.${s.confidence}`)}</Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyState icon="checkCircle" title={t('bulk.noneTitle')}>{t('bulk.noneBody', { count: parts.length })}</EmptyState>
      )}
    </Dialog>
  );
}
