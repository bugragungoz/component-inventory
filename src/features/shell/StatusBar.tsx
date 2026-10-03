import { signal } from '@preact/signals';
import type { BackupEntry, SyncStatus } from '../../api/types';
import { Icon } from '../../components/Icon';
import { formatNumber, formatTime, parseDbDate, parseLocalDate, t } from '../../i18n';
import { stats } from '../../state/inventory';
import { view } from '../../state/ui';

export const syncStatus = signal<SyncStatus | null>(null);
export const lastBackup = signal<BackupEntry | null>(null);
export const appVersion = signal<string>('');

/** Counts on the left; the last backup and the Drive sync (with its error) on the right. */
export function StatusBar() {
  const s = stats.value;
  const sync = syncStatus.value;
  const syncText = !sync || sync.state === 'off'
    ? t('status.syncOff')
    : sync.state === 'error'
      ? t('status.syncError', { error: sync.last_error ?? '' })
      : sync.state === 'pending'
        ? t('status.syncPending')
        : sync.last_sync_at
          // "Drive synced -" read as if a copy had been written when none was yet.
          ? t('status.synced', { time: formatTime(parseDbDate(sync.last_sync_at)) })
          : t('status.syncOn');
  return (
    <footer class="statusbar">
      <span class="num">{t('status.parts', { count: s.parts })}</span>
      <span class="sep" aria-hidden="true" />
      <span class="num">{t('status.pieces', { count: s.pieces })}</span>
      {s.low > 0 ? (
        <>
          <span class="sep" aria-hidden="true" />
          <span class="tone-warn status-low"><Icon name="alert" size={13} /> {t('status.lowStock', { count: s.low })}</span>
        </>
      ) : null}
      <span class="statusbar-gap" />
      {lastBackup.value ? (
        <button type="button" class="status-item" onClick={() => { view.value = 'backups'; }}>
          <Icon name="backup" size={13} /> {t('status.lastBackup', { time: formatTime(parseLocalDate(lastBackup.value.created_at)) })}
        </button>
      ) : null}
      <button type="button" class={`status-item sync-${sync?.state ?? 'off'}`} onClick={() => { view.value = 'settings'; }} title={sync?.folder ?? undefined}>
        <Icon name={sync?.state === 'error' ? 'alert' : sync?.state === 'ok' ? 'cloudCheck' : sync?.state === 'pending' ? 'cloud' : 'cloudOff'} size={14} />
        {syncText}
      </button>
      {appVersion.value ? <span class="status-version mono">v{appVersion.value}</span> : null}
      <span class="sr-only">{formatNumber(s.parts)}</span>
    </footer>
  );
}
