/** Print labels: choose a sheet, what goes on the label and how many copies; preview; save a PDF. */
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { Component } from '../../api/types';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Select, TextField } from '../../components/Field';
import { Spinner } from '../../components/Misc';
import { Checkbox } from '../../components/Switch';
import { formatNumber, t } from '../../i18n';
import { showStoragePlace } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { labelsFor } from '../../state/ui';
import { errorMessage, fieldLabel } from '../inventory/labels';
import { pageCount, SHEETS } from './layout';
import { buildLabelPdf, drawLabel, type LabelOptions } from './render';

export function LabelsDialog({ parts }: { parts: Component[] }) {
  const [opt, setOpt] = useState<LabelOptions>({
    sheet: SHEETS[0]!, copies: 1, skip: 0, showCategory: true, showPlace: showStoragePlace.value, showQuantity: false, showPackage: true,
    showDescription: true, qr: true,
  });
  const [copiesText, setCopiesText] = useState('1');
  const [skipText, setSkipText] = useState('0');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const words = { qty: fieldLabel('quantity'), place: fieldLabel('location'), pkg: fieldLabel('package') };
  const total = parts.length * opt.copies;
  const perPage = opt.sheet.cols * opt.sheet.rows;

  useEffect(() => {
    let cancelled = false;
    if (!parts[0]) return;
    void drawLabel(parts[0], opt, words).then((c) => { if (!cancelled) setPreview(c.toDataURL('image/png')); });
    return () => { cancelled = true; };
  }, [opt]);

  const close = () => { labelsFor.value = null; };
  const save = async () => {
    setBusy(true);
    try {
      const bytes = await buildLabelPdf(parts, opt, words);
      const name = parts.length === 1 ? `label-${parts[0]!.part_code.replace(/[^\w.-]+/g, '_')}.pdf` : `labels-${new Date().toISOString().slice(0, 10)}.pdf`;
      const path = await api.saveGeneratedFile(bytes, name, 'pdf');
      if (path) {
        toast(t('labels.saved', { path }), { tone: 'ok' });
        close();
      }
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };
  const flag = (k: keyof LabelOptions, label: string) => (
    <Checkbox label={label} checked={opt[k] as boolean} onChange={(on) => setOpt({ ...opt, [k]: on })} />
  );

  return (
    <Dialog
      title={t('labels.title', { count: parts.length })}
      onClose={close}
      busy={busy}
      size="wide"
      actions={
        <>
          <span class="muted num">{t('labels.summary', { count: total, pages: pageCount(opt.sheet, total, opt.skip) })}</span>
          <span class="grow" />
          <Button onClick={close} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="download" onClick={() => void save()} disabled={busy || !parts.length}>{t('labels.save')}</Button>
        </>
      }
    >
      <div class="labels-layout">
        <div class="stack">
          <Select label={t('labels.sheet')} value={opt.sheet.id} onValue={(v) => setOpt({ ...opt, sheet: SHEETS.find((s) => s.id === v)!, skip: 0 })}
            options={SHEETS.map((s) => ({ value: s.id, label: t(`labels.sheets.${s.id}`) }))} />
          <div class="form-grid">
            <TextField label={t('labels.copies')} value={copiesText} inputMode="numeric" class="num"
              onValue={(v) => { setCopiesText(v); const n = Number.parseInt(v, 10); if (Number.isInteger(n) && n >= 1 && n <= 500) setOpt({ ...opt, copies: n }); }} />
            {perPage > 1 ? (
              <TextField label={t('labels.skip')} value={skipText} inputMode="numeric" class="num" hint={t('labels.skipHint')}
                onValue={(v) => { setSkipText(v); const n = Number.parseInt(v || '0', 10); if (Number.isInteger(n) && n >= 0 && n < perPage) setOpt({ ...opt, skip: n }); }} />
            ) : null}
          </div>
          <fieldset class="fieldset">
            <legend class="bg-field-label">{t('labels.show')}</legend>
            {flag('qr', t('labels.qr'))}
            {flag('showCategory', fieldLabel('category'))}
            {flag('showDescription', fieldLabel('description'))}
            {flag('showPackage', fieldLabel('package'))}
            {flag('showPlace', fieldLabel('location'))}
            {flag('showQuantity', fieldLabel('quantity'))}
          </fieldset>
        </div>
        <figure class="label-preview">
          {preview ? <img src={preview} alt={t('labels.previewAlt', { code: parts[0]?.part_code ?? '' })} style={{ aspectRatio: `${opt.sheet.labelW} / ${opt.sheet.labelH}` }} /> : <Spinner label={t('common.loading')} />}
          <figcaption class="muted num">{`${formatNumber(opt.sheet.labelW)} × ${formatNumber(opt.sheet.labelH)} mm`}</figcaption>
        </figure>
      </div>
    </Dialog>
  );
}
