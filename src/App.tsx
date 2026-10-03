import { useEffect, useState } from 'preact/hooks';
import { api } from './api/commands';
import { onBackupCreated, onDeepLinkPending, onSyncStatus } from './api/events';
import type { StartupStatus } from './api/types';
import { ConfirmHost } from './components/ConfirmHost';
import { Snackbars } from './components/Snackbars';
import { Spinner } from './components/Misc';
import { BackupsView } from './features/backups/BackupsView';
import { ImportView } from './features/import/ImportView';
import { openDeepLinks } from './features/import/sources';
import { InventoryView } from './features/inventory/InventoryView';
import { DialogsHost } from './features/inventory/DialogsHost';
import { ProjectsView } from './features/projects/ProjectsView';
import { SettingsView } from './features/settings/SettingsView';
import { Sidebar } from './features/shell/Sidebar';
import { StartupError } from './features/shell/StartupError';
import { StatusBar, lastBackup, syncStatus } from './features/shell/StatusBar';
import { useShortcuts } from './features/shell/shortcuts';
import { checkForUpdate } from './features/shell/update';
import { setLocale, systemLocale, t } from './i18n';
import { loadInventory, sort } from './state/inventory';
import { importLegacySettingsOnce, loadSettings } from './state/settings';
import { toast } from './state/toasts';
import { view } from './state/ui';

type Phase = { kind: 'loading' } | { kind: 'failed'; status: StartupStatus } | { kind: 'ready' };

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  useShortcuts();

  useEffect(() => {
    setLocale(systemLocale());
    let cancelled = false;
    const unlisten: Array<() => void> = [];
    (async () => {
      const status = await api.startupStatus().catch(() => ({ ok: true, error: null, data_dir: '' }) as StartupStatus);
      if (!status.ok) {
        setPhase({ kind: 'failed', status });
        return;
      }
      const saved = await loadSettings();
      await importLegacySettingsOnce();
      // The table's sort is saved on every click; it was never read back, so each start sorted by
      // part code again.
      if (saved.table_sort?.column) sort.value = saved.table_sort;
      await loadInventory();
      if (cancelled) return;
      setPhase({ kind: 'ready' });
      const info = await api.appInfo();
      if (info.migration && info.migration.from_version < info.migration.to_version) {
        toast(t('startup.migrated'), { tone: 'ok', duration: 12000, actionLabel: t('startup.migratedAction'), onAction: () => { view.value = 'backups'; } });
      }
      syncStatus.value = await api.syncStatus().catch(() => null);
      unlisten.push(await onSyncStatus((s) => { syncStatus.value = s; }));
      unlisten.push(await onBackupCreated((b) => { lastBackup.value = b; }));
      unlisten.push(await onDeepLinkPending(() => { void openDeepLinks(); }));
      void openDeepLinks();
      setTimeout(() => void checkForUpdate(), 4000);
    })().catch((e: unknown) => {
      setPhase({ kind: 'failed', status: { ok: false, error: { code: 'startup', detail: String((e as Error)?.message ?? e) }, data_dir: '' } });
    });
    return () => {
      cancelled = true;
      unlisten.forEach((u) => u());
    };
  }, []);

  if (phase.kind === 'failed') return <StartupError status={phase.status} />;
  if (phase.kind === 'loading') {
    return (
      <div class="boot" aria-busy="true">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }
  return (
    <div class="app">
      <a class="skip-link" href="#main">
        {t('app.skip')}
      </a>
      <Sidebar />
      <main class="main" id="main" tabIndex={-1}>
        {view.value === 'inventory' ? <InventoryView /> : null}
        {view.value === 'projects' ? <ProjectsView /> : null}
        {view.value === 'import' ? <ImportView /> : null}
        {view.value === 'backups' ? <BackupsView /> : null}
        {view.value === 'settings' ? <SettingsView /> : null}
      </main>
      <StatusBar />
      <DialogsHost />
      <ConfirmHost />
      <Snackbars />
    </div>
  );
}
