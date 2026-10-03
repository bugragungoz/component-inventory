/** Export: CSV, Excel and JSON are written by the Rust side; the printable PDF list is drawn here. */
import { useState } from 'preact/hooks';
import { api } from '../../api/commands';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Note, ProgressBar } from '../../components/Misc';
import { Checkbox } from '../../components/Switch';
import { t } from '../../i18n';
import { components, filtered, showStoragePlace } from '../../state/inventory';
import { settings } from '../../state/settings';
import { toast } from '../../state/toasts';
import { exportOpen } from '../../state/ui';
import { errorMessage } from '../inventory/labels';
import { buildInventoryPdf } from './pdf';

type Format = 'xlsx' | 'csv' | 'json' | 'pdf';
const FORMATS: Array<{ id: Format; icon: string }> = [
  { id: 'xlsx', icon: 'file' },
  { id: 'csv', icon: 'file' },
  { id: 'json', icon: 'file' },
  { id: 'pdf', icon: 'filePdf' },
];

export function ExportDialog() {
  const [format, setFormat] = useState<Format>('xlsx');
  const [onlyShown, setOnlyShown] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const total = components.value.length;
  const shown = filtered.value.length;
  const close = () => { exportOpen.value = false; };

  const run = async () => {
    setBusy(true);
    try {
      let path: string | null;
      if (format === 'pdf') {
        setProgress(0);
        const list = onlyShown ? filtered.value : components.value;
        const bytes = await buildInventoryPdf(list, showStoragePlace.value, (d, n) => setProgress(Math.round((d / n) * 100)));
        path = await api.saveGeneratedFile(bytes, `inventory-${new Date().toISOString().slice(0, 10)}.pdf`, 'pdf');
      } else {
        path = await api.exportInventory(format);
      }
      if (path) {
        toast(t('export.saved', { path }), { tone: 'ok' });
        close();
      }
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Dialog
      title={t('export.title')}
      onClose={close}
      busy={busy}
      actions={
        <>
          <Button onClick={close} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="export" onClick={() => void run()} disabled={busy || !total}>{t('export.run')}</Button>
        </>
      }
    >
      <div class="choice-list" role="radiogroup" aria-label={t('export.format')}>
        {FORMATS.map((f) => (
          <label class="choice" key={f.id}>
            <input type="radio" name="export-format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} />
            <Icon name={f.icon} size={20} />
            <span class="choice-text">
              <strong>{t(`export.formats.${f.id}.title`)}</strong>
              <span class="muted">{t(`export.formats.${f.id}.body`)}</span>
            </span>
          </label>
        ))}
      </div>
      {format === 'pdf' && shown !== total ? (
        <Checkbox label={t('export.onlyShown', { count: shown })} checked={onlyShown} onChange={setOnlyShown} />
      ) : null}
      {format !== 'pdf' ? <p class="muted">{t('export.allParts', { count: total })}</p> : null}
      {settings.value?.export_folder ? <Note icon="folder">{t('export.folder', { path: settings.value.export_folder })}</Note> : null}
      {progress !== null ? <ProgressBar value={progress} label={t('export.progress')} /> : null}
    </Dialog>
  );
}
