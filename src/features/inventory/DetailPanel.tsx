/**
 * The detail panel beside the table: what the part is, how many there are (with a stepper that
 * logs a movement), where it is used, its history, and the actions on it.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { Component, ComponentDetail } from '../../api/types';
import { Badge, Spinner } from '../../components/Misc';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { schemaFor } from '../../domain/attributes';
import { parseUserQuantity } from '../../domain/number';
import { subcategoryIcon } from '../../domain/taxonomy';
import { formatDateTime, formatNumber, locale, parseDbDate, t } from '../../i18n';
import { categoryOf, components, customColumns, isLowStock } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { assignTo, detailId, editing, labelsFor, view } from '../../state/ui';
import { selectedProject } from '../projects/state';
import { adjustQuantity, askDelete, duplicatePart } from './actions';
import { attrLabel, categoryLabel, errorMessage, fieldLabel, reasonLabel, subcategoryLabel } from './labels';
import { useImage } from './useImage';

function Row({ label, children, mono }: { label: string; children: ComponentChildren; mono?: boolean }) {
  return (
    <div class="kv">
      <dt>{label}</dt>
      <dd class={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  );
}

function Stepper({ c }: { c: Component }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (delta: number) => {
    setBusy(true);
    await adjustQuantity(c, delta);
    setBusy(false);
  };
  const setTo = async () => {
    const n = parseUserQuantity(text, locale.value);
    if (n === null || n < 0) {
      toast(t('detail.qtyInvalid'), { tone: 'warn' });
      return;
    }
    setText('');
    await run(n - c.quantity);
  };
  return (
    <div class="stepper" role="group" aria-label={t('detail.quantity')}>
      <IconButton icon="minus" label={t('detail.takeOne')} onClick={() => void run(-1)} disabled={busy || c.quantity <= 0} />
      <output class={isLowStock(c) ? 'stepper-value num low' : 'stepper-value num'} aria-live="polite">
        {isLowStock(c) ? <Icon name="alert" size={16} title={t('table.lowStockTitle')} /> : null}
        {formatNumber(c.quantity)}
      </output>
      <IconButton icon="plus" label={t('detail.addOne')} onClick={() => void run(1)} disabled={busy} />
      <form class="stepper-set" onSubmit={(e) => { e.preventDefault(); void setTo(); }}>
        <label class="sr-only" for="detail-set-qty">{t('detail.setTo')}</label>
        <input id="detail-set-qty" class="bg-input num" inputMode="numeric" placeholder={t('detail.setTo')} value={text} onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} />
        <Button size="sm" type="submit" disabled={!text.trim() || busy}>{t('detail.set')}</Button>
      </form>
    </div>
  );
}

export function DetailPanel({ id }: { id: number }) {
  const c = components.value.find((x) => x.id === id) ?? null;
  const [detail, setDetail] = useState<ComponentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const image = useImage(c?.image_path);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api.getComponent(id).then((d) => { if (!cancelled) setDetail(d); }, (e) => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [id, c?.updated_at, c?.quantity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.bg-scrim') && !(e.target as HTMLElement).closest('input, textarea, select')) detailId.value = null;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!c) return null;
  const cat = categoryOf(c);
  const schema = schemaFor(cat, c.subcategory);
  const attrs = Object.entries(c.attributes).filter(([k, v]) => !k.startsWith('_') && v !== '' && v !== null && v !== undefined);
  const facts: Array<[string, string | null, boolean?]> = [
    ['package', c.package || null, true],
    ['location', c.location || null],
    ['manufacturer', c.manufacturer || null],
    ['mpn', c.mpn || null, true],
    ['preferred_supplier', c.preferred_supplier || null],
    ['resistance', c.resistance || null, true],
    ['tolerance', c.tolerance || null, true],
    ['power_rating', c.power_rating === null ? null : `${formatNumber(c.power_rating)} W`, true],
    ['voltage_max', c.voltage_max === null ? null : `${formatNumber(c.voltage_max)} V`, true],
    ['current_max', c.current_max === null ? null : `${formatNumber(c.current_max)} A`, true],
    ['unit_price', c.unit_price === null ? null : formatNumber(c.unit_price, undefined, { maximumFractionDigits: 4 }), true],
  ];

  return (
    <aside class="detail-panel" aria-label={t('detail.label', { code: c.part_code })}>
      <header class="detail-head">
        <div class="detail-icon"><Icon name={subcategoryIcon(cat, c.subcategory)} size={28} /></div>
        <div class="detail-title">
          <h2 class="mono">{c.part_code}</h2>
          <p class="muted">
            {categoryLabel(cat)}
            {c.subcategory ? ` / ${subcategoryLabel(c.subcategory)}` : ''}
          </p>
        </div>
        <IconButton icon="close" label={t('common.close')} onClick={() => { detailId.value = null; }} />
      </header>

      <div class="detail-body">
        <Stepper c={c} />
        {c.description ? <p class="detail-desc">{c.description}</p> : null}

        <div class="detail-actions">
          <Button size="sm" icon="edit" onClick={() => { editing.value = c; }}>{t('detail.edit')}</Button>
          <Button size="sm" variant="quiet" icon="copy" onClick={() => duplicatePart(c)}>{t('detail.duplicate')}</Button>
          <Button size="sm" variant="quiet" icon="label" onClick={() => { labelsFor.value = [c]; }}>{t('detail.printLabel')}</Button>
          <Button size="sm" variant="quiet" icon="projects" onClick={() => { assignTo.value = [c]; }}>{t('detail.assign')}</Button>
          {c.datasheet_url ? (
            <Button size="sm" variant="quiet" icon="external" onClick={() => void api.openUrl(c.datasheet_url).catch((e) => toast(errorMessage(e), { tone: 'warn' }))}>{t('detail.datasheet')}</Button>
          ) : null}
          <Button size="sm" variant="danger" icon="trash" onClick={() => void askDelete([c])}>{t('detail.delete')}</Button>
        </div>

        {image.url ? (
          <figure class="detail-image"><img src={image.url} alt={t('detail.imageAlt', { code: c.part_code })} /></figure>
        ) : image.failed ? (
          <p class="muted"><Icon name="image" size={14} /> {t('detail.imageMissing')}</p>
        ) : null}

        <section>
          <h3 class="section-title">{t('detail.facts')}</h3>
          <dl class="kv-list">
            {facts.filter(([, v]) => v !== null).map(([k, v, mono]) => (
              <Row key={k} label={fieldLabel(k)} mono={mono}>{v}</Row>
            ))}
            {customColumns.value.map((cc) => {
              const v = c.custom_fields[cc.col_key];
              if (v === undefined || v === null || v === '') return null;
              return <Row key={cc.col_key} label={cc.col_label}>{String(v)}</Row>;
            })}
          </dl>
        </section>

        {attrs.length ? (
          <section>
            <h3 class="section-title">{t('detail.parameters')}</h3>
            <dl class="kv-list">
              {attrs.map(([k, v]) => {
                const f = schema?.fields.find((x) => x.key === k);
                return <Row key={k} label={f?.unit ? `${attrLabel(k)} (${f.unit})` : attrLabel(k)} mono={f?.type === 'number'}>{String(v)}</Row>;
              })}
            </dl>
          </section>
        ) : null}

        {c.notes ? (
          <section>
            <h3 class="section-title">{fieldLabel('notes')}</h3>
            <p class="detail-notes">{c.notes}</p>
          </section>
        ) : null}

        <section>
          <h3 class="section-title">{t('detail.projects')}</h3>
          {!detail ? (error ? <p class="muted">{error}</p> : <Spinner label={t('common.loading')} />) : detail.projects.length ? (
            <ul class="plain-list">
              {detail.projects.map((p) => (
                <li key={p.project_id}>
                  <button type="button" class="link-btn" onClick={() => { selectedProject.value = p.project_id; view.value = 'projects'; }}>{p.project_name}</button>
                  <Badge tone={p.required_qty > c.quantity ? 'warn' : 'muted'}>{t('detail.needs', { count: p.required_qty })}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">{t('detail.noProjects')}</p>
          )}
        </section>

        <section>
          <h3 class="section-title">{t('detail.history')}</h3>
          {detail?.movements.length ? (
            <ol class="history">
              {detail.movements.map((m) => (
                <li key={m.id}>
                  <span class={m.delta > 0 ? 'delta num tone-ok' : 'delta num'}>{m.delta > 0 ? '+' : ''}{formatNumber(m.delta)}</span>
                  <span class="history-what">{reasonLabel(m.reason)}</span>
                  <span class="muted num">{t('detail.after', { count: m.quantity_after })}</span>
                  <time class="muted">{formatDateTime(parseDbDate(m.created_at))}</time>
                </li>
              ))}
            </ol>
          ) : detail ? (
            <p class="muted">{t('detail.noHistory')}</p>
          ) : null}
        </section>

        <p class="detail-meta muted">
          {t('detail.created', { time: formatDateTime(parseDbDate(c.created_at)) })}
          <br />
          {t('detail.updated', { time: formatDateTime(parseDbDate(c.updated_at)) })}
        </p>
      </div>
    </aside>
  );
}
