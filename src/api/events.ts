/** Events the shell sends: a deep link is waiting, the Drive snapshot ran, a backup was made. */
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { BackupEntry, SyncStatus } from './types';

async function safeListen<T>(name: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  try {
    return await listen<T>(name, (e) => cb(e.payload));
  } catch {
    return () => {};
  }
}

export const onDeepLinkPending = (cb: () => void) => safeListen<null>('deep-link-pending', () => cb());
export const onSyncStatus = (cb: (s: SyncStatus) => void) => safeListen<SyncStatus>('sync-status', cb);
export const onBackupCreated = (cb: (b: BackupEntry) => void) => safeListen<BackupEntry>('backup-created', cb);
