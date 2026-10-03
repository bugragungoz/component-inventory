/** App settings (stored in the database) and the theme they select. */
import { computed, effect, signal } from '@preact/signals';
import { api } from '../api/commands';
import type { AppSettings } from '../api/types';
import { setLocale, systemLocale } from '../i18n';

export const settings = signal<AppSettings | null>(null);

const systemDark = signal(typeof matchMedia === 'function' ? !matchMedia('(prefers-color-scheme: light)').matches : true);
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', (e) => {
    systemDark.value = !e.matches;
  });
}

export const theme = computed<'dark' | 'light'>(() => {
  const t = settings.value?.theme ?? 'system';
  if (t === 'system') return systemDark.value ? 'dark' : 'light';
  return t;
});

effect(() => {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme.value;
});

effect(() => {
  const s = settings.value;
  if (s) setLocale(s.language ?? systemLocale());
});

export async function loadSettings(): Promise<AppSettings> {
  const s = await api.getSettings();
  settings.value = s;
  return s;
}

/** Saves a change; the screen updates at once and settles on what the database stored. */
export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const before = settings.value;
  if (before) settings.value = { ...before, ...patch };
  try {
    const s = await api.updateSettings(patch);
    settings.value = s;
    return s;
  } catch (e) {
    settings.value = before;
    throw e;
  }
}

/** The old app kept its settings in WebView storage (same origin as this app). Read them once. */
export const LEGACY_KEYS = ['locale', 'theme', 'defaultQty', 'lowStockThreshold', 'formMode', 'locationsEnabled', 'backupRetention',
  'backupIntervalMinutes', 'exportFolder', 'driveSyncEnabled', 'driveSyncFolder', 'driveSyncBaseName'];

export async function importLegacySettingsOnce(): Promise<void> {
  if (!settings.value || settings.value.legacy_imported) return;
  const values: Record<string, string> = {};
  try {
    for (const k of LEGACY_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) values[k] = v;
    }
  } catch {
    /* storage unavailable: nothing to import */
  }
  settings.value = await api.importLegacySettings(values);
}
