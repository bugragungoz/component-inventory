import { invoke } from '@tauri-apps/api/core';
import { showToast } from '../app.js';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function loadBackupList() {
  const list = document.getElementById('backup-list');
  list.innerHTML = '<div class="loading-row">Loading backups...</div>';

  try {
    const backups = await invoke('list_backups_cmd');

    if (!backups || backups.length === 0) {
      list.innerHTML = '<div class="loading-row">No backups found.</div>';
      return;
    }

    list.innerHTML = backups.map(b => `
      <div class="backup-row" data-path="${b.path}">
        <div class="backup-row-info">
          <span class="backup-name">${b.filename}</span>
          <span class="backup-meta">${b.created_at} &mdash; ${formatBytes(b.size_bytes)}</span>
        </div>
        <button class="btn btn-ghost btn-sm btn-restore" data-path="${b.path}" title="Restore this backup">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.36"/></svg>
          Restore
        </button>
      </div>`).join('');

    list.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', () => restoreBackup(btn.dataset.path));
    });

  } catch (err) {
    list.innerHTML = `<div class="loading-row" style="color:var(--danger)">Failed to load: ${err}</div>`;
  }
}

async function restoreBackup(path) {
  const confirmed = window.confirm(
    'Restore this backup? The current inventory data will be replaced.\n\nThe app will restart to apply changes.'
  );
  if (!confirmed) return;

  try {
    await invoke('restore_backup_cmd', { backupPath: path });
    showToast('Backup restored. Restarting application...', 'success', 2000);
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    showToast('Restore failed: ' + err, 'error');
  }
}

async function createManualBackup() {
  const btn = document.getElementById('btn-create-backup');
  btn.disabled = true;
  try {
    const result = await invoke('create_backup');
    showToast(`Backup created: ${result.filename}`, 'success');
    await loadBackupList();
  } catch (err) {
    showToast('Backup failed: ' + err, 'error');
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
