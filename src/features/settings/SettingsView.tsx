/**
 * Settings, saved in the database as they change. Folders are chosen with the system dialog only.
 * Languages show whether a native speaker has reviewed them.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { AppInfo, AppSettings } from '../../api/types';
import { Button } from '../../components/Button';
import { Select, TextField } from '../../components/Field';
import { IconButton } from '../../components/IconButton';
import { Badge, Note } from '../../components/Misc';
import { Switch } from '../../components/Switch';
import { formatDateTime, formatNumber, LOCALES, locale, parseDbDate, PSEUDO_LOCALE, t } from '../../i18n';
import { confirm } from '../../state/dialogs';
import { customColumns, loadInventory } from '../../state/inventory';
import { saveSettings, settings } from '../../state/settings';
import { toast } from '../../state/toasts';
import { errorMessage } from '../inventory/labels';
import { appVersion, syncStatus } from '../shell/StatusBar';
import { checkForUpdate, readAppVersion } from '../shell/update';

function Section({ id, title, children, hint }: { id: string; title: string; children: ComponentChildren; hint?: string }) {
  return (
    <section class="settings-section" aria-labelledby={`settings-${id}`}>
      <div class="settings-side">
        <h2 id={`settings-${id}`}>{title}</h2>
        {hint ? <p class="muted">{hint}</p> : null}
      </div>
      <div class="settings-main">{children}</div>
    </section>
  );
}

/** A whole-number setting saved on blur or Enter, with the range the Rust side enforces. */
function NumberSetting({ label, value, min, max, onSave, hint }: { label: string; value: number; min: number; max: number; onSave: (n: number) => void; hint?: string }) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number.parseInt(text.trim(), 10);
    if (!Number.isInteger(n) || n < min || n > max || String(n) !== text.trim()) {
      setError(t('settings.range', { min, max }));
      return;
    }
    setError(null);
    if (n !== value) onSave(n);
  };
  return (
    <TextField label={label} value={text} onValue={setText} inputMode="numeric" class="num" error={error} hint={hint}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} fieldClass="field-narrow" />
  );
}

export function SettingsView() {
  const s = settings.value;
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [baseName, setBaseName] = useState(s?.drive_base_name ?? '');
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    api.appInfo().then(setInfo, () => {});
    void readAppVersion().then((v) => { if (v) appVersion.value = v; });
  }, []);
  useEffect(() => setBaseName(s?.drive_base_name ?? ''), [s?.drive_base_name]);
  if (!s) return null;

  const save = (patch: Partial<AppSettings>) => void saveSettings(patch).catch((e) => toast(errorMessage(e), { tone: 'warn' }));
  const pick = async (kind: 'export' | 'drive') => {
    try {
      const next = await api.pickFolder(kind);
      if (next) settings.value = next;
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    }
  };
  const syncNow = async () => {
    setSyncing(true);
    try {
      syncStatus.value = await api.syncNow();
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setSyncing(false);
    }
  };
  const removeColumn = async (id: number, label: string) => {
    const ok = await confirm({ title: t('settings.columns.deleteTitle', { name: label }), body: t('settings.columns.deleteBody'), confirmLabel: t('settings.columns.delete'), cancelLabel: t('common.cancel'), danger: true });
    if (!ok) return;
    try {
      await api.deleteCustomColumn(id);
      await loadInventory();
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    }
  };
  const sync = syncStatus.value;
  const current = s.language ?? locale.value;
  const langInfo = LOCALES.find((l) => l.code === current);

  return (
    <div class="view settings-view">
      <header class="toolbar">
        <h1 class="view-title">{t('nav.settings')}</h1>
      </header>
      <div class="view-body settings-body">
        <Section id="language" title={t('settings.language.title')}>
          <Select label={t('settings.language.label')} value={current} onValue={(v) => save({ language: v })}
            options={[
              ...LOCALES.map((l) => ({ value: l.code, label: l.reviewed ? l.nativeName : `${l.nativeName} (${t('settings.language.unreviewed')})` })),
              ...(import.meta.env.DEV ? [{ value: PSEUDO_LOCALE, label: 'Pseudo (en-XA)' }] : []),
            ]} />
          {langInfo && !langInfo.reviewed ? <Note icon="globe">{t('settings.language.unreviewedNote')}</Note> : null}
          <Select label={t('settings.theme.label')} value={s.theme} onValue={(v) => save({ theme: v as AppSettings['theme'] })}
            options={[{ value: 'system', label: t('settings.theme.system') }, { value: 'dark', label: t('settings.theme.dark') }, { value: 'light', label: t('settings.theme.light') }]} />
        </Section>

        <Section id="parts" title={t('settings.parts.title')}>
          <NumberSetting label={t('settings.parts.defaultQuantity')} value={s.default_quantity} min={0} max={999_999} onSave={(n) => save({ default_quantity: n })} />
          <NumberSetting label={t('settings.parts.lowStock')} value={s.low_stock_threshold} min={0} max={999_999} onSave={(n) => save({ low_stock_threshold: n })} hint={t('settings.parts.lowStockHint')} />
          <Select label={t('settings.parts.formMode')} value={s.form_mode} onValue={(v) => save({ form_mode: v as AppSettings['form_mode'] })}
            options={[{ value: 'simple', label: t('edit.simple') }, { value: 'detailed', label: t('edit.detailed') }]} />
          <Select label={t('settings.parts.storagePlace')} value={s.show_storage_place} onValue={(v) => save({ show_storage_place: v as AppSettings['show_storage_place'] })}
            hint={t('settings.parts.storagePlaceHint')}
            options={[{ value: 'auto', label: t('settings.parts.placeAuto') }, { value: 'show', label: t('settings.parts.placeShow') }, { value: 'hide', label: t('settings.parts.placeHide') }]} />
        </Section>

        <Section id="backups" title={t('settings.backups.title')} hint={t('settings.backups.hint')}>
          <NumberSetting label={t('settings.backups.interval')} value={s.backup_interval_minutes} min={0} max={1440} onSave={(n) => save({ backup_interval_minutes: n })} hint={t('settings.backups.intervalHint')} />
          <NumberSetting label={t('settings.backups.retention')} value={s.backup_retention} min={1} max={500} onSave={(n) => save({ backup_retention: n })} hint={t('settings.backups.retentionHint')} />
          <div class="inline-actions">
            <Button icon="folder" onClick={() => void api.openFolder('data').catch((e) => toast(errorMessage(e), { tone: 'warn' }))}>{t('settings.backups.openData')}</Button>
          </div>
        </Section>

        <Section id="export" title={t('settings.export.title')}>
          <div class="folder-row">
            <span class={s.export_folder ? 'mono truncate' : 'muted'}>{s.export_folder ?? t('settings.export.none')}</span>
            <Button size="sm" icon="folder" onClick={() => void pick('export')}>{t('settings.choose')}</Button>
            {s.export_folder ? <Button size="sm" variant="quiet" onClick={() => save({ export_folder: null })}>{t('settings.clear')}</Button> : null}
          </div>
        </Section>

        <Section id="drive" title={t('settings.drive.title')} hint={t('settings.drive.hint')}>
          <Switch label={t('settings.drive.enable')} checked={s.drive_enabled} onChange={(on) => save({ drive_enabled: on })} disabled={!s.drive_folder && !s.drive_enabled}
            hint={!s.drive_folder ? t('settings.drive.needFolder') : undefined} />
          <div class="folder-row">
            <span class={s.drive_folder ? 'mono truncate' : 'muted'}>{s.drive_folder ?? t('settings.drive.noFolder')}</span>
            <Button size="sm" icon="folder" onClick={() => void pick('drive')}>{t('settings.choose')}</Button>
            {s.drive_folder ? <Button size="sm" variant="quiet" onClick={() => save({ drive_folder: null, drive_enabled: false })}>{t('settings.clear')}</Button> : null}
          </div>
          <TextField label={t('settings.drive.baseName')} value={baseName} onValue={setBaseName} mono fieldClass="field-narrow"
            hint={t('settings.drive.baseNameHint', { name: baseName || 'croxz' })}
            onBlur={() => { if (baseName.trim() && baseName !== s.drive_base_name) save({ drive_base_name: baseName.trim() }); }} />
          <div class="folder-row">
            <span class={sync?.state === 'error' ? 'tone-warn' : 'muted'}>
              {!sync || sync.state === 'off' ? t('status.syncOff') : sync.state === 'error' ? t('status.syncError', { error: sync.last_error ?? '' })
                : sync.state === 'pending' ? t('status.syncPending') : t('settings.drive.lastSync', { time: formatDateTime(parseDbDate(sync.last_sync_at)) })}
            </span>
            <Button size="sm" icon="refresh" onClick={() => void syncNow()} disabled={!s.drive_enabled || syncing}>{t('settings.drive.syncNow')}</Button>
          </div>
          {sync?.files.length ? <p class="muted mono small">{sync.files.join(', ')}</p> : null}
        </Section>

        <Section id="columns" title={t('settings.columns.title')} hint={t('settings.columns.hint')}>
          {customColumns.value.length ? (
            <ul class="plain-list">
              {customColumns.value.map((c) => (
                <li key={c.id}>
                  <span>{c.col_label}</span>
                  <span class="muted mono small">{c.col_key}</span>
                  <span class="grow" />
                  <IconButton size="sm" icon="trash" label={t('settings.columns.deleteTitle', { name: c.col_label })} onClick={() => void removeColumn(c.id, c.col_label)} />
                </li>
              ))}
            </ul>
          ) : <p class="muted">{t('settings.columns.none')}</p>}
        </Section>

        <Section id="updates" title={t('settings.updates.title')}>
          <Switch label={t('settings.updates.auto')} checked={s.update_check} onChange={(on) => save({ update_check: on })} hint={t('settings.updates.hint')} />
          <div class="inline-actions">
            <Button icon="refresh" onClick={() => void checkForUpdate(true)}>{t('settings.updates.now')}</Button>
          </div>
        </Section>

        <Section id="about" title={t('settings.about.title')}>
          <dl class="kv-list">
            <div class="kv"><dt>{t('settings.about.version')}</dt><dd class="mono">{appVersion.value || '-'}</dd></div>
            <div class="kv"><dt>{t('settings.about.data')}</dt><dd class="mono truncate" title={info?.data_dir}>{info?.data_dir ?? '-'}</dd></div>
            <div class="kv"><dt>{t('settings.about.schema')}</dt><dd class="num">{info ? formatNumber(info.schema_version) : '-'}</dd></div>
            <div class="kv"><dt>{t('settings.about.library')}</dt><dd>{info?.library_available ? <Badge tone="ok">{t('settings.about.libraryOn')}</Badge> : <Badge>{t('settings.about.libraryOff')}</Badge>}</dd></div>
            <div class="kv"><dt>{t('settings.about.languages')}</dt><dd>{LOCALES.map((l) => `${l.nativeName}${l.reviewed ? '' : ` (${t('settings.language.unreviewed')})`}`).join(', ')}</dd></div>
          </dl>
          <div class="inline-actions">
            <Button variant="quiet" icon="github" onClick={() => void api.openUrl('https://github.com/bugragungoz/component-inventory').catch(() => {})}>{t('about.github')}</Button>
            <Button variant="quiet" icon="external" onClick={() => void api.openUrl('https://github.com/bugragungoz/component-inventory/blob/master/CONTRIBUTING.md#translations').catch(() => {})}>{t('settings.about.translate')}</Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
