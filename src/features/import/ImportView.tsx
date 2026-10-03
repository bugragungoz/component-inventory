/**
 * Import: pick or drop a file (or arrive from the extension), review every line, choose how to
 * apply it, then write it in one step that can be undone. Past imports are listed with Undo.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { ImportBatch, ImportMode, ImportResult, UndoResult } from '../../api/types';
import { Button } from '../../components/Button';
import { Select } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Badge, EmptyState, Note, Spinner, Tabs } from '../../components/Misc';
import { Checkbox } from '../../components/Switch';
import { IMPORT_FIELDS, type ColumnMap, type ImportField } from '../../domain/importCore';
import { parseUserQuantity } from '../../domain/number';
import { UNCATEGORIZED } from '../../domain/taxonomy';
import { formatDateTime, formatNumber, locale, parseDbDate, t } from '../../i18n';
import { confirm } from '../../state/dialogs';
import { components, loadInventory } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { view } from '../../state/ui';
import { categoryLabel, errorMessage, fieldLabel } from '../inventory/labels';
import { markDuplicates, needsLook, pieces, toImportRows, totals, type Draft, type DraftRow, type Issue, type Reason } from './draft';
import { draftFromMappedTable, ImportReadError, importBusy, pendingDraft, readFile } from './sources';

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.ods,.pdf,.json';
/** Review lines drawn at a time; more come as the list is scrolled. Orders are far shorter. */
const REVIEW_STEP = 200;

function reasonText(r: Reason): string {
  switch (r.code) {
    case 'read-from': return t('import.reason.readFrom', { column: r.column });
    case 'pack-rule': return t('import.reason.packRule', { size: r.size });
    case 'pack-extension': return t('import.reason.packExtension', { size: r.size });
    case 'pack-edited': return t('import.reason.packEdited', { size: r.size });
    case 'per-piece': return t('import.reason.perPiece');
    case 'note': return r.text;
  }
}

function issueText(i: Issue): string {
  switch (i.code) {
    case 'no-quantity': return i.raw ? t('import.issue.noQuantityRaw', { raw: i.raw }) : t('import.issue.noQuantity');
    case 'not-whole': return t('import.issue.notWhole', { raw: i.raw });
    case 'no-code': return t('import.issue.noCode');
    case 'name-as-code': return t('import.issue.nameAsCode');
    case 'code-from-name': return t('import.issue.codeFromName');
    case 'shop-code': return t('import.issue.shopCode', { code: i.code_ });
    case 'filled-library': return i.source === 'library' ? t('import.issue.filledLibrary') : t('import.issue.filledRules');
    case 'duplicate': return t('import.issue.duplicate', { count: i.count });
  }
}

/** "10 units x 10-piece pack = 100 pieces", and where each number came from. */
export function whyText(r: DraftRow): string {
  const p = pieces(r);
  const head = p === null ? t('import.why.unknown') : r.pack > 1 ? t('import.why.pack', { units: r.units ?? 0, pack: r.pack, pieces: p }) : t('import.why.plain', { count: p });
  return [head, ...r.why.map(reasonText)].join('\n');
}

function SourcePicker() {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async (file: File) => {
    setError(null);
    importBusy.value = file.name;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      pendingDraft.value = await readFile(file.name, bytes);
    } catch (e) {
      setError(e instanceof ImportReadError ? t(e.key, e.params) : errorMessage(e));
    } finally {
      importBusy.value = null;
    }
  };
  return (
    <div class="import-start">
      <div
        class={drag ? 'dropzone is-over' : 'dropzone'}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer?.files?.[0];
          if (f) void open(f);
        }}
      >
        <Icon name="import" size={32} />
        <h2>{t('import.dropTitle')}</h2>
        <p class="muted">{t('import.dropBody')}</p>
        <Button variant="primary" icon="folder" onClick={() => input.current?.click()} disabled={!!importBusy.value}>{t('import.choose')}</Button>
        <input ref={input} type="file" accept={ACCEPT} class="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; (e.currentTarget as HTMLInputElement).value = ''; if (f) void open(f); }} />
        {importBusy.value ? <p class="muted"><Spinner label={t('common.loading')} /> {t('import.reading', { name: importBusy.value })}</p> : null}
        {error ? <Note tone="warn" icon="alert">{error}</Note> : null}
      </div>
      <div class="source-grid">
        <div class="source-card">
          <Icon name="globe" size={22} />
          <h3>{t('import.sources.extension.title')}</h3>
          <p class="muted">{t('import.sources.extension.body')}</p>
        </div>
        <div class="source-card">
          <Icon name="filePdf" size={22} />
          <h3>{t('import.sources.pdf.title')}</h3>
          <p class="muted">{t('import.sources.pdf.body')}</p>
        </div>
        <div class="source-card">
          <Icon name="file" size={22} />
          <h3>{t('import.sources.table.title')}</h3>
          <p class="muted">{t('import.sources.table.body')}</p>
        </div>
      </div>
    </div>
  );
}

function ColumnMapper({ draft, onChange }: { draft: Draft; onChange: (map: ColumnMap) => void }) {
  if (!draft.table) return null;
  const { map, columns, raw } = draft.table;
  const sample = (c: string) => raw.find((r) => (r[c] ?? '').trim())?.[c] ?? '';
  return (
    <details class="details mapper" open={!Object.values(map).includes('quantity') || !Object.values(map).includes('part_code')}>
      <summary>{t('import.mapping.title', { count: columns.length })}</summary>
      <p class="muted">{t('import.mapping.body')}</p>
      <div class="mapper-grid">
        {columns.map((c) => (
          <div class="mapper-row" key={c}>
            <div class="mapper-source">
              <strong class="truncate" title={c}>{c}</strong>
              <span class="muted truncate mono small" title={sample(c)}>{sample(c) || '-'}</span>
            </div>
            <Select label={t('import.mapping.fieldFor', { column: c })} hideLabel value={map[c] ?? ''}
              onValue={(v) => onChange({ ...map, [c]: (v || null) as ImportField | null })}
              options={[{ value: '', label: t('import.mapping.ignore') }, ...IMPORT_FIELDS.map((f) => ({ value: f, label: fieldLabel(f) }))]} />
          </div>
        ))}
      </div>
    </details>
  );
}

function ReviewRow({ r, onChange, existing }: { r: DraftRow; onChange: (r: DraftRow) => void; existing: number | null }) {
  const [unitsText, setUnitsText] = useState(r.units === null ? '' : String(r.units));
  const [packText, setPackText] = useState(String(r.pack));
  useEffect(() => setUnitsText(r.units === null ? '' : String(r.units)), [r.units]);
  useEffect(() => setPackText(String(r.pack)), [r.pack]);
  const look = needsLook(r);
  const p = pieces(r);
  const commitUnits = () => {
    const n = unitsText.trim() ? parseUserQuantity(unitsText, locale.value) : null;
    if (n === null || n < 0) {
      setUnitsText(r.units === null ? '' : String(r.units));
      return;
    }
    onChange({ ...r, units: n, issues: r.issues.filter((i) => i.code !== 'no-quantity' && i.code !== 'not-whole') });
  };
  const commitPack = () => {
    const n = parseUserQuantity(packText, locale.value);
    if (n === null || n < 1 || n > 10000) {
      setPackText(String(r.pack));
      return;
    }
    if (n !== r.pack) onChange({ ...r, pack: n, why: [...r.why.filter((w) => w.code !== 'pack-rule' && w.code !== 'pack-extension' && w.code !== 'pack-edited' && w.code !== 'per-piece'), { code: 'pack-edited', size: n }] });
  };
  return (
    <tr class={[!r.include && 'is-excluded', look && r.include && 'needs-look'].filter(Boolean).join(' ')}>
      <td class="col-check"><Checkbox label={t('import.review.include', { name: r.part_code || r.name })} hideLabel checked={r.include} onChange={(on) => onChange({ ...r, include: on })} /></td>
      <td class="col-flag">
        {look ? (
          <span class="row-flag tone-warn" title={r.issues.map(issueText).join('\n')}><Icon name="alert" size={15} /><span class="sr-only">{t('import.review.check')}</span></span>
        ) : (
          <span class="row-flag tone-ok" title={r.issues.map(issueText).join('\n') || t('import.review.ok')}><Icon name="checkCircle" size={15} /><span class="sr-only">{t('import.review.ok')}</span></span>
        )}
      </td>
      <td class="col-code">
        <input class="bg-input cell-input mono" value={r.part_code} aria-label={t('import.review.codeFor', { name: r.name || r.part_code })} spellcheck={false}
          onChange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value.trim();
            onChange({ ...r, part_code: v, issues: r.issues.filter((i) => !(v && (i.code === 'no-code' || i.code === 'name-as-code' || i.code === 'code-from-name' || i.code === 'shop-code'))) });
          }} />
      </td>
      <td class="col-name">
        <div class="review-name">
          <span class="truncate" title={r.name}>{r.name || r.description}</span>
          {r.issues.length ? <span class="review-issues muted small">{r.issues.map(issueText).join(' · ')}</span> : null}
        </div>
      </td>
      <td class="is-end col-units">
        <input class="bg-input cell-input num" inputMode="numeric" value={unitsText} aria-label={t('import.review.unitsFor', { name: r.part_code || r.name })}
          onInput={(e) => setUnitsText((e.currentTarget as HTMLInputElement).value)} onBlur={commitUnits} onKeyDown={(e) => { if (e.key === 'Enter') commitUnits(); }}
          aria-invalid={r.units === null ? true : undefined} />
      </td>
      <td class="is-end col-pack">
        <input class="bg-input cell-input num narrow" inputMode="numeric" value={packText} aria-label={t('import.review.packFor', { name: r.part_code || r.name })}
          onInput={(e) => setPackText((e.currentTarget as HTMLInputElement).value)} onBlur={commitPack} onKeyDown={(e) => { if (e.key === 'Enter') commitPack(); }} />
      </td>
      <td class="is-end num col-pieces">
        <span class="why" title={whyText(r)} tabIndex={0} aria-label={whyText(r)}>{p === null ? '?' : formatNumber(p)}</span>
      </td>
      <td class="muted truncate col-cat">{categoryLabel(r.category || UNCATEGORIZED)}</td>
      <td class="is-end num muted col-stock">{existing === null ? <Badge tone="info">{t('import.review.new')}</Badge> : t('import.review.inStock', { count: existing })}</td>
    </tr>
  );
}

function Review({ draft }: { draft: Draft }) {
  const [rows, setRows] = useState<DraftRow[]>(draft.rows);
  const [mode, setMode] = useState<ImportMode>('add');
  const [filter, setFilter] = useState<'all' | 'check'>('all');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  useEffect(() => setRows(draft.rows), [draft]);
  const stock = useMemo(() => new Map(components.value.map((c) => [c.part_code.toUpperCase(), c.quantity])), [components.value]);
  const sum = totals(rows);
  const shown = filter === 'check' ? rows.filter((r) => needsLook(r) || r.units === null) : rows;
  // A long file (an old inventory sheet) is drawn in steps, so the review opens at once.
  const [limit, setLimit] = useState(REVIEW_STEP);
  useEffect(() => setLimit(REVIEW_STEP), [draft, filter]);
  const visible = shown.length > limit ? shown.slice(0, limit) : shown;
  const moreRef = useRef<HTMLTableRowElement>(null);
  const hasMore = visible.length < shown.length;
  useEffect(() => {
    const el = moreRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + REVIEW_STEP);
    }, { root: el.closest('.review-table-wrap'), rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, limit]);
  const update = (next: DraftRow) => {
    const list = rows.map((r) => (r.key === next.key ? next : r));
    markDuplicates(list);
    setRows(list);
  };

  const apply = async () => {
    const importRows = toImportRows(rows);
    if (!importRows.length) return;
    if (mode === 'replace') {
      const ok = await confirm({ title: t('import.replaceTitle'), body: t('import.replaceBody', { count: components.value.length }), confirmLabel: t('import.replaceConfirm'), cancelLabel: t('common.cancel'), danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api.applyImport({ source_label: draft.label, source_kind: draft.kind, mode, rows: importRows });
      await loadInventory();
      setResult(r);
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  if (result) return <Done result={result} label={draft.label} />;
  return (
    <div class="review">
      <header class="review-head">
        <div>
          <h2>{t('import.review.title', { source: draft.label })}</h2>
          <p class="muted num">
            {t('import.review.lineCount', { count: sum.lines })} · {t('import.review.pieceCount', { count: sum.pieces })}
            {sum.check ? <> · <span class="tone-warn">{t('import.review.toCheck', { count: sum.check })}</span></> : null}
            {sum.unreadable ? <> · <span class="tone-warn">{t('import.review.unreadable', { count: sum.unreadable })}</span></> : null}
            {sum.excluded ? <> · {t('import.review.excluded', { count: sum.excluded })}</> : null}
            {draft.skipped ? <> · {t('import.review.skipped', { count: draft.skipped })}</> : null}
          </p>
        </div>
        <span class="grow" />
        <Button variant="quiet" onClick={() => { pendingDraft.value = null; }} disabled={busy}>{t('common.cancel')}</Button>
      </header>
      <ColumnMapper draft={{ ...draft, rows }} onChange={(map) => void draftFromMappedTable(draft, map).then((d) => { pendingDraft.value = d; })} />
      <Tabs value={filter} onChange={setFilter} label={t('import.review.filter')} tabs={[{ value: 'all', label: t('import.review.all'), count: rows.length }, { value: 'check', label: t('import.review.checkTab'), count: rows.filter((r) => needsLook(r) || r.units === null).length }]} />
      <div class="review-table-wrap">
        <table class="data-table review-table">
          <thead>
            <tr>
              <th scope="col" class="col-check"><Checkbox label={t('table.selectAll')} hideLabel checked={rows.every((r) => r.include)} indeterminate={rows.some((r) => r.include) && !rows.every((r) => r.include)} onChange={(on) => setRows(rows.map((r) => ({ ...r, include: on })))} /></th>
              <th scope="col" class="col-flag"><span class="sr-only">{t('import.review.status')}</span></th>
              <th scope="col" class="col-code">{fieldLabel('part_code')}</th>
              <th scope="col" class="col-name">{t('import.review.name')}</th>
              <th scope="col" class="is-end col-units">{t('import.review.units')}</th>
              <th scope="col" class="is-end col-pack">{t('import.review.pack')}</th>
              <th scope="col" class="is-end col-pieces">{t('import.review.pieces')}</th>
              <th scope="col" class="col-cat">{fieldLabel('category')}</th>
              <th scope="col" class="is-end col-stock">{t('import.review.stock')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => <ReviewRow key={r.key} r={r} onChange={update} existing={r.part_code ? stock.get(r.part_code.toUpperCase()) ?? null : null} />)}
            {hasMore ? (
              <tr ref={moreRef} class="review-more">
                <td colSpan={9} class="muted small">{t('import.review.showing', { shown: visible.length, total: shown.length })}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <footer class="review-foot">
        <div class="mode-choice" role="radiogroup" aria-label={t('import.mode.label')}>
          {(['add', 'sync', 'replace'] as const).map((m) => (
            <label class="choice" key={m}>
              <input type="radio" name="import-mode" checked={mode === m} onChange={() => setMode(m)} />
              <span class="choice-text">
                <strong>{t(`import.mode.${m}.title`)}</strong>
                <span class="muted">{t(`import.mode.${m}.body`)}</span>
              </span>
            </label>
          ))}
        </div>
        <div class="review-apply">
          <Note icon="backup">{t('import.backupNote')}</Note>
          <Button variant="primary" icon="check" onClick={() => void apply()} disabled={busy || !sum.lines}>
            {t('import.apply', { count: sum.lines })}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function undoNotes(r: UndoResult): string {
  if (!r.notes.length) return '';
  return r.notes.slice(0, 5).map((n) => t(`import.undoNote.${n.reason}`, { code: n.part_code })).join('\n');
}

async function undoBatch(batchId: number, label: string, after: () => void): Promise<void> {
  const ok = await confirm({ title: t('import.undoTitle'), body: t('import.undoBody', { source: label }), confirmLabel: t('import.undo'), cancelLabel: t('common.cancel'), danger: true });
  if (!ok) return;
  try {
    const r = await api.undoImport(batchId);
    await loadInventory();
    after();
    const notes = undoNotes(r);
    toast(t('import.undone', { count: r.reverted + r.deleted }) + (notes ? `\n${notes}` : ''), { tone: r.notes.length ? 'warn' : 'ok' });
  } catch (e) {
    toast(errorMessage(e), { tone: 'warn' });
  }
}

function Done({ result, label }: { result: ImportResult; label: string }) {
  const [undone, setUndone] = useState(false);
  return (
    <EmptyState icon="checkCircle" title={undone ? t('import.doneUndoneTitle') : t('import.doneTitle')}
      actions={
        <>
          <Button variant="primary" icon="inventory" onClick={() => { pendingDraft.value = null; view.value = 'inventory'; }}>{t('import.showInventory')}</Button>
          {!undone ? <Button icon="undo" onClick={() => void undoBatch(result.batch_id, label, () => setUndone(true))}>{t('import.undo')}</Button> : null}
          <Button variant="quiet" onClick={() => { pendingDraft.value = null; }}>{t('import.another')}</Button>
        </>
      }>
      {undone ? t('import.doneUndoneBody') : t('import.doneBody', { created: result.created, updated: result.updated, pieces: result.pieces })}
    </EmptyState>
  );
}

function History() {
  const [list, setList] = useState<ImportBatch[] | null>(null);
  const reload = () => api.listImports().then(setList, () => setList([]));
  useEffect(() => { void reload(); }, [components.value.length]);
  if (!list) return <Spinner label={t('common.loading')} />;
  if (!list.length) return <p class="muted">{t('import.history.empty')}</p>;
  return (
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">{t('import.history.when')}</th>
          <th scope="col">{t('import.history.source')}</th>
          <th scope="col">{t('import.history.mode')}</th>
          <th scope="col" class="is-end">{t('import.history.result')}</th>
          <th scope="col"><span class="sr-only">{t('table.actions')}</span></th>
        </tr>
      </thead>
      <tbody>
        {list.map((b) => (
          <tr key={b.id} class={b.status === 'undone' ? 'is-excluded' : undefined}>
            <td>{formatDateTime(parseDbDate(b.created_at))}</td>
            <td class="truncate" title={b.source_label}>{b.source_label}</td>
            <td>{t(`import.mode.${b.mode}.title`)}</td>
            <td class="is-end num muted">{t('import.history.counts', { created: b.created, updated: b.updated, pieces: b.pieces })}</td>
            <td class="is-end">
              {b.status === 'undone' ? <Badge tone="muted">{t('import.history.undone')}</Badge> : (
                <Button size="sm" variant="quiet" icon="undo" onClick={() => void undoBatch(b.id, b.source_label, () => void reload())}>{t('import.undo')}</Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ImportView() {
  const draft = pendingDraft.value;
  return (
    <div class="view import-view">
      <header class="toolbar">
        <h1 class="view-title">{t('nav.import')}</h1>
      </header>
      <div class="view-body">
        {draft ? <Review draft={draft} /> : (
          <>
            <SourcePicker />
            <section class="import-history">
              <h2 class="section-title">{t('import.history.title')}</h2>
              <History />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
