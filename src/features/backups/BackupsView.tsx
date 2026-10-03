/**
 * Backups: every copy the app made (automatic, before an import, before a restore ...), what
 * changed since each one, and restore. Restoring asks first and keeps a copy of the current data,
 * so a restore can itself be undone.
 */
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { BackupDiff, BackupEntry } from '../../api/types';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { IconButton } from '../../components/IconButton';
import { Badge, EmptyState, Note, Spinner, Tabs } from '../../components/Misc';
import { formatBytes, formatDateTime, formatNumber, parseLocalDate, t } from '../../i18n';
import { confirm } from '../../state/dialogs';
import { loadInventory } from '../../state/inventory';
import { loadSettings, settings } from '../../state/settings';
import { toast } from '../../state/toasts';
import { errorMessage, fieldLabel } from '../inventory/labels';
import { lastBackup } from '../shell/StatusBar';

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DiffDialog({ entry, onClose }: { entry: BackupEntry; onClose: () => void }) {
  const [diff, setDiff] = useState<BackupDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'changed' | 'added' | 'removed'>('changed');
  useEffect(() => { api.diffBackup(entry.file_name).then(setDiff, (e) => setError(errorMessage(e))); }, [entry.file_name]);
  return (
    <Dialog title={t('backups.diffTitle', { time: formatDateTime(parseLocalDate(entry.created_at)) })} onClose={onClose} size="wide">
      {error ? <Note tone="warn" icon="alert">{error}</Note> : !diff ? <Spinner label={t('common.loading')} /> : (
        <>
          <p class="muted">{t('backups.diffBody')}</p>
          <Tabs value={tab} onChange={setTab} label={t('backups.diffTabs')} tabs={[
            { value: 'changed', label: t('backups.changed'), count: diff.changed.length },
            { value: 'added', label: t('backups.added'), count: diff.added.length },
            { value: 'removed', label: t('backups.removed'), count: diff.removed.length },
          ]} />
          <div class="tab-panel diff-panel" role="tabpanel">
            {tab === 'changed' ? (
              diff.changed.length ? (
                <table class="data-table">
                  <thead><tr><th scope="col">{fieldLabel('part_code')}</th><th scope="col">{t('backups.field')}</th><th scope="col">{t('backups.then')}</th><th scope="col">{t('backups.now')}</th></tr></thead>
                  <tbody>
                    {diff.changed.flatMap((c) => c.fields.map((f, i) => (
                      <tr key={`${c.part_code}-${f.field}`}>
                        <td class="mono">{i === 0 ? c.part_code : ''}</td>
                        <td>{fieldLabel(f.field)}</td>
                        <td class="muted"><del>{show(f.before)}</del></td>
                        <td><ins>{show(f.after)}</ins></td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              ) : <p class="muted">{t('backups.noneChanged')}</p>
            ) : null}
            {tab !== 'changed' ? (
              (tab === 'added' ? diff.added : diff.removed).length ? (
                <table class="data-table">
                  <thead><tr><th scope="col">{fieldLabel('part_code')}</th><th scope="col" class="is-end">{fieldLabel('quantity')}</th><th scope="col">{fieldLabel('description')}</th></tr></thead>
                  <tbody>
                    {(tab === 'added' ? diff.added : diff.removed).map((c) => (
                      <tr key={c.part_code}><td class="mono">{c.part_code}</td><td class="is-end num">{formatNumber(c.quantity)}</td><td class="muted truncate">{c.description}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p class="muted">{tab === 'added' ? t('backups.noneAdded') : t('backups.noneRemoved')}</p>
            ) : null}
          </div>
        </>
      )}
    </Dialog>
  );
}

export async function restoreBackup(entry: BackupEntry, onDone?: () => void): Promise<void> {
  const ok = await confirm({
    title: t('backups.restoreTitle'),
    body: t('backups.restoreBody', { time: formatDateTime(parseLocalDate(entry.created_at)) }),
    confirmLabel: t('backups.restore'),
    cancelLabel: t('common.cancel'),
    danger: true,
  });
  if (!ok) return;
  try {
    const r = await api.restoreBackup(entry.file_name);
    await loadSettings();
    await loadInventory();
    onDone?.();
    toast(t('backups.restored'), {
      tone: 'ok', duration: 12000, actionLabel: t('common.undo'),
      onAction: async () => {
        try {
          await api.restoreBackup(r.safety_backup.file_name);
          await loadSettings();
          await loadInventory();
          onDone?.();
          toast(t('backups.restoreUndone'), { tone: 'ok' });
        } catch (e) {
          toast(errorMessage(e), { tone: 'warn' });
        }
      },
    });
  } catch (e) {
    toast(errorMessage(e), { tone: 'warn' });
  }
}

export function BackupsView() {
  const [list, setList] = useState<BackupEntry[] | null>(null);
  const [diffFor, setDiffFor] = useState<BackupEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = () => api.listBackups().then(setList, (e) => { setList([]); toast(errorMessage(e), { tone: 'warn' }); });
  useEffect(() => { void reload(); }, [lastBackup.value?.file_name]);

  const create = async () => {
    setBusy(true);
    try {
      const b = await api.createBackup('manual');
      lastBackup.value = b;
      toast(t('backups.created'), { tone: 'ok' });
      await reload();
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="view backups-view">
      <header class="toolbar">
        <h1 class="view-title">{t('nav.backups')}</h1>
        <span class="grow" />
        <Button variant="quiet" icon="folder" onClick={() => void api.openFolder('backups').catch((e) => toast(errorMessage(e), { tone: 'warn' }))}>{t('backups.openFolder')}</Button>
        <Button variant="primary" icon="backup" onClick={() => void create()} disabled={busy}>{t('backups.create')}</Button>
      </header>
      <div class="view-body">
        <Note icon="info">{t('backups.policy', { minutes: settings.value?.backup_interval_minutes ?? 0, count: settings.value?.backup_retention ?? 0 })}</Note>
        {!list ? <Spinner label={t('common.loading')} /> : list.length === 0 ? (
          <EmptyState icon="backup" title={t('backups.emptyTitle')} actions={<Button variant="primary" onClick={() => void create()}>{t('backups.create')}</Button>}>{t('backups.emptyBody')}</EmptyState>
        ) : (
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{t('backups.when')}</th>
                <th scope="col">{t('backups.kind')}</th>
                <th scope="col" class="is-end">{t('backups.size')}</th>
                <th scope="col"><span class="sr-only">{t('table.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.file_name}>
                  <td><span title={b.file_name}>{formatDateTime(parseLocalDate(b.created_at))}</span></td>
                  <td><Badge tone={b.kind === 'manual' ? 'accent' : b.kind === 'auto' ? 'muted' : 'info'}>{t(`backups.kinds.${b.kind}`)}</Badge></td>
                  <td class="is-end num muted">{formatBytes(b.size_bytes)}</td>
                  <td class="is-end row-actions">
                    <Button size="sm" variant="quiet" icon="list" onClick={() => setDiffFor(b)}>{t('backups.compare')}</Button>
                    <Button size="sm" icon="undo" onClick={() => void restoreBackup(b, () => void reload())}>{t('backups.restore')}</Button>
                    <IconButton size="sm" icon="copy" label={t('backups.copyName', { name: b.file_name })} onClick={() => void navigator.clipboard?.writeText(b.path).then(() => toast(t('backups.copied'), { tone: 'ok' }), () => {})} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {diffFor ? <DiffDialog entry={diffFor} onClose={() => setDiffFor(null)} /> : null}
    </div>
  );
}
