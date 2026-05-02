import { invoke } from '@tauri-apps/api/core';
import { showToast, escHtml } from '../app.js';
import { t } from './i18n.js';
import { triggerDriveSync } from './drive_sync.js';
import { STORAGE_KEYS, DEFAULTS } from './constants.js';
import { formatBytes } from './backup_core.js';

async function loadBackupList() {
  const list = document.getElementById('backup-list');
  list.innerHTML = `<div class="loading-row">${t('backup.loading')}</div>`;

  try {
    const backups = await invoke('list_backups_cmd');

    if (!backups || backups.length === 0) {
      list.innerHTML = `<div class="loading-row">${t('backup.empty')}</div>`;
      return;
    }

    list.innerHTML = backups.map(b => `
      <div class="backup-row" data-path="${escHtml(b.path)}">
        <div class="backup-row-info">
          <span class="backup-name">${escHtml(b.filename)}</span>
          <span class="backup-meta">${escHtml(b.created_at)} &mdash; ${formatBytes(b.size_bytes)}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-restore" data-path="${escHtml(b.path)}" title="${t('backup.btn.restore.title')}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.36"/></svg>
          ${t('backup.btn.restore')}
        </button>
      </div>`).join('');

    list.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', () => restoreBackup(btn.dataset.path));
    });

  } catch (err) {
    list.innerHTML = `<div class="loading-row" style="color:var(--danger)">${escHtml(err.message || String(err))}</div>`;
  }
}

async function restoreBackup(path) {
  const confirmed = window.confirm(t('backup.confirmRestore'));
  if (!confirmed) return;

  try {
    await invoke('restore_backup_cmd', { backupPath: path });
    showToast(t('backup.restored'), 'success', 2000);
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    showToast(t('backup.restoreFailed') + (err.message || String(err)), 'error');
  }
}

async function createManualBackup() {
  const btn = document.getElementById('btn-create-backup');
  btn.disabled = true;
  try {
    const retention = parseInt(localStorage.getItem(STORAGE_KEYS.BACKUP_RETENTION) || String(DEFAULTS.BACKUP_RETENTION), 10);
    const result = await invoke('create_backup', { retention: isNaN(retention) ? DEFAULTS.BACKUP_RETENTION : retention });
    showToast(t('backup.created') + result.filename, 'success');
    await loadBackupList();
    // After a manual backup, push the latest snapshot to the cloud folder
    // so Sheets / mobile users always have the freshest copy.
    triggerDriveSync();
  } catch (err) {
    showToast(t('backup.failed') + (err.message || String(err)), 'error');
  } finally {
    btn.disabled = false;
  }
}

export function initBackupUI() {
  document.getElementById('btn-create-backup').addEventListener('click', createManualBackup);

  document.addEventListener('backup-modal-opened', () => {
    loadBackupList();
  });
}
