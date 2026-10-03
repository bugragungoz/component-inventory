/** The update check only shows a snackbar; it never opens Settings by itself (B6, brief section 2). */
import { getVersion } from '@tauri-apps/api/app';
import { api } from '../../api/commands';
import { t } from '../../i18n';
import { settings } from '../../state/settings';
import { toast } from '../../state/toasts';
import { appVersion } from './StatusBar';

export async function readAppVersion(): Promise<string | null> {
  try {
    const v = await getVersion();
    return /^\d+\.\d+\.\d+/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(manual = false): Promise<'skipped' | 'current' | 'available' | 'error'> {
  const version = await readAppVersion();
  if (version) appVersion.value = version;
  if (!version) return 'skipped';
  if (!manual && settings.value && !settings.value.update_check) return 'skipped';
  const res = await api.checkUpdate(manual).catch(() => null);
  if (!res) return 'error';
  if (res.status === 'available' && res.latest && res.url) {
    const url = res.url;
    toast(t('update.available', { version: res.latest }), {
      tone: 'info',
      duration: 15000,
      actionLabel: t('update.download'),
      onAction: () => void api.openUrl(url).catch(() => {}),
    });
  } else if (manual && res.status === 'current') {
    toast(t('update.current', { version }), { tone: 'ok' });
  } else if (manual && res.status === 'error') {
    toast(t('update.failed'), { tone: 'warn' });
  }
  return res.status;
}
