/**
 * Projects: a list on the left; the open project's parts list (BOM) with shortages, and its
 * schematic, on the right. Deleting a project asks first and can be undone.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { BomRow, Component, Project } from '../../api/types';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { TextArea, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { Badge, EmptyState, Spinner, Tabs } from '../../components/Misc';
import { bomFromSchematic, type SchematicMatch } from '../../domain/kicad';
import { parseUserQuantity } from '../../domain/number';
import { fold, matchesAll } from '../../domain/search';
import { subcategoryIcon } from '../../domain/taxonomy';
import { formatNumber, locale, t } from '../../i18n';
import { confirm } from '../../state/dialogs';
import { categoryOf, components, refreshUsage } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { detailId, view } from '../../state/ui';
import { errorMessage } from '../inventory/labels';
import { Schematic } from './Schematic';
import { loadProjects, projects, projectsLoaded, selectedProject, upsertProject } from './state';

function ProjectList() {
  const [name, setName] = useState('');
  const create = async (e: Event) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try {
      const p = await api.createProject(n);
      upsertProject(p);
      selectedProject.value = p.id;
      setName('');
    } catch (err) {
      toast(errorMessage(err), { tone: 'warn' });
    }
  };
  const move = async (i: number, d: -1 | 1) => {
    const list = projects.value.slice();
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    projects.value = list;
    await api.reorderProjects(list.map((p) => p.id)).catch((err) => toast(errorMessage(err), { tone: 'warn' }));
  };
  return (
    <nav class="project-list" aria-label={t('projects.list')}>
      <form class="inline-form" onSubmit={(e) => void create(e)}>
        <TextField label={t('projects.newName')} hideLabel placeholder={t('projects.newName')} value={name} onValue={setName} />
        <IconButton icon="plus" label={t('projects.create')} type="submit" disabled={!name.trim()} />
      </form>
      <ul>
        {projects.value.map((p, i) => (
          <li key={p.id} class="project-item">
            <button type="button" class="project-row" aria-current={selectedProject.value === p.id ? 'true' : undefined} onClick={() => { selectedProject.value = p.id; }}>
              <span class="truncate">{p.name}</span>
              <span class="muted num">{t('projects.lines', { count: p.line_count })}</span>
              {p.shortage > 0 ? <Badge tone="warn">{t('projects.short', { count: p.shortage })}</Badge> : p.line_count ? <Badge tone="ok">{t('projects.ready')}</Badge> : null}
            </button>
            <span class="project-move">
              <IconButton size="sm" icon="chevronUp" label={t('projects.moveUp', { name: p.name })} onClick={() => void move(i, -1)} disabled={i === 0} />
              <IconButton size="sm" icon="chevronDown" label={t('projects.moveDown', { name: p.name })} onClick={() => void move(i, 1)} disabled={i === projects.value.length - 1} />
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AddLine({ project, onAdded }: { project: Project; onAdded: () => void }) {
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState('1');
  const [picked, setPicked] = useState<Component | null>(null);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q || picked) return [];
    const out: Component[] = [];
    for (const c of components.value) {
      if (matchesAll(fold(`${c.part_code} ${c.description} ${c.mpn}`), q)) out.push(c);
      if (out.length >= 8) break;
    }
    return out;
  }, [query, picked, components.value]);
  const add = async (e: Event) => {
    e.preventDefault();
    const n = parseUserQuantity(qty, locale.value);
    if (!picked || n === null || n <= 0) {
      toast(t('projects.addInvalid'), { tone: 'warn' });
      return;
    }
    try {
      await api.upsertBomLine({ project_id: project.id, component_id: picked.id, required_qty: n, note: '', add_to_existing: true });
      setPicked(null);
      setQuery('');
      setQty('1');
      onAdded();
    } catch (err) {
      toast(errorMessage(err), { tone: 'warn' });
    }
  };
  return (
    <form class="add-line" onSubmit={(e) => void add(e)}>
      <div class="add-line-search">
        <TextField label={t('projects.addPart')} value={picked ? picked.part_code : query} mono
          onValue={(v) => { setPicked(null); setQuery(v); }} placeholder={t('projects.addPartPlaceholder')} autoComplete="off" />
        {results.length ? (
          <ul class="popover-list" role="listbox" aria-label={t('projects.matches')}>
            {results.map((c) => (
              <li key={c.id} role="option" aria-selected="false">
                <button type="button" onClick={() => { setPicked(c); setQuery(c.part_code); }}>
                  <Icon name={subcategoryIcon(categoryOf(c), c.subcategory)} size={16} />
                  <span class="mono">{c.part_code}</span>
                  <span class="muted truncate">{c.description}</span>
                  <span class="num muted">{formatNumber(c.quantity)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <TextField label={t('projects.required')} value={qty} onValue={setQty} inputMode="numeric" class="num" fieldClass="qty-field" />
      <Button type="submit" icon="plus" disabled={!picked}>{t('projects.add')}</Button>
    </form>
  );
}

function BomTable({ rows, onChange }: { rows: BomRow[]; onChange: () => void }) {
  const update = async (row: BomRow, text: string) => {
    const n = parseUserQuantity(text, locale.value);
    if (n === null || n <= 0) {
      toast(t('projects.addInvalid'), { tone: 'warn' });
      return;
    }
    if (n === row.required_qty) return;
    try {
      await api.updateBomLine({ id: row.id, required_qty: n });
      onChange();
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    }
  };
  const remove = async (row: BomRow) => {
    try {
      const link = await api.deleteBomLine(row.id);
      onChange();
      toast(t('projects.lineRemoved', { code: row.part_code }), {
        tone: 'ok', actionLabel: t('common.undo'),
        onAction: async () => {
          await api.upsertBomLine({ project_id: link.project_id, component_id: link.component_id, required_qty: link.required_qty, note: link.note, add_to_existing: true });
          onChange();
        },
      });
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    }
  };
  if (!rows.length) return <p class="muted bom-empty">{t('projects.bomEmpty')}</p>;
  return (
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">{t('field.part_code')}</th>
          <th scope="col">{t('field.description')}</th>
          <th scope="col" class="is-end">{t('projects.stock')}</th>
          <th scope="col" class="is-end">{t('projects.required')}</th>
          <th scope="col">{t('projects.status')}</th>
          <th scope="col"><span class="sr-only">{t('table.actions')}</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><button type="button" class="link-btn mono" onClick={() => { detailId.value = r.component_id; view.value = 'inventory'; }}>{r.part_code}</button></td>
            <td class="truncate muted" title={r.description}>{r.description}</td>
            <td class="is-end num">{formatNumber(r.stock)}</td>
            <td class="is-end">
              <input class="bg-input cell-input num" inputMode="numeric" aria-label={t('projects.requiredFor', { code: r.part_code })} value={formatNumber(r.required_qty)}
                onChange={(e) => void update(r, (e.currentTarget as HTMLInputElement).value)} />
            </td>
            <td>{r.shortage > 0 ? <Badge tone="warn">{t('projects.missing', { count: r.shortage })}</Badge> : <Badge tone="ok">{t('projects.enough')}</Badge>}</td>
            <td class="is-end"><IconButton size="sm" icon="trash" label={t('projects.removeLine', { code: r.part_code })} onClick={() => void remove(r)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SchematicBomDialog({ project, text, onClose, onDone }: { project: Project; text: string; onClose: () => void; onDone: () => void }) {
  const { matches, unmatched } = useMemo(() => bomFromSchematic(text, components.value), [text]);
  const [chosen, setChosen] = useState<Set<number>>(new Set(matches.map((m) => m.component_id)));
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    setBusy(true);
    try {
      const lines = matches.filter((m: SchematicMatch) => chosen.has(m.component_id))
        .map((m) => ({ project_id: project.id, component_id: m.component_id, required_qty: m.qty, note: m.refs.join(', '), add_to_existing: false }));
      const r = await api.addBomLines(lines);
      toast(t('projects.schematicAdded', { count: r.count }), { tone: 'ok' });
      onDone();
      onClose();
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={t('projects.schematicTitle')} onClose={onClose} busy={busy} size="wide"
      actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={() => void apply()} disabled={busy || !chosen.size}>{t('projects.schematicApply', { count: chosen.size })}</Button></>}>
      <p class="muted">{t('projects.schematicBody', { matched: matches.length, unmatched: unmatched.length })}</p>
      <table class="data-table">
        <thead><tr><th scope="col"><span class="sr-only">{t('table.selectAll')}</span></th><th scope="col">{t('field.part_code')}</th><th scope="col" class="is-end">{t('projects.required')}</th><th scope="col">{t('projects.refs')}</th></tr></thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.component_id}>
              <td><input type="checkbox" aria-label={m.part_code} checked={chosen.has(m.component_id)} onChange={(e) => {
                const s = new Set(chosen);
                if ((e.currentTarget as HTMLInputElement).checked) s.add(m.component_id); else s.delete(m.component_id);
                setChosen(s);
              }} /></td>
              <td class="mono">{m.part_code}</td>
              <td class="is-end num">{formatNumber(m.qty)}</td>
              <td class="muted mono truncate">{m.refs.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {unmatched.length ? (
        <details class="details">
          <summary>{t('projects.unmatched', { count: unmatched.length })}</summary>
          <p class="mono muted">{unmatched.map((p) => `${p.reference} ${p.value}`).join(', ')}</p>
        </details>
      ) : null}
    </Dialog>
  );
}

function ProjectDetail({ project }: { project: Project }) {
  const [bom, setBom] = useState<BomRow[] | null>(null);
  const [tab, setTab] = useState<'bom' | 'schematic' | 'notes'>('bom');
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [notes, setNotes] = useState(project.notes);
  const [schematicText, setSchematicText] = useState<string | null>(null);

  const reload = async () => {
    const rows = await api.listBom(project.id);
    setBom(rows);
    void loadProjects().catch(() => {});
    void refreshUsage().catch(() => {});
  };
  useEffect(() => {
    setBom(null);
    setName(project.name);
    setDescription(project.description);
    setNotes(project.notes);
    api.listBom(project.id).then(setBom, (e) => toast(errorMessage(e), { tone: 'warn' }));
  }, [project.id]);

  const saveMeta = async (patch: { name?: string; description?: string; notes?: string }) => {
    if (patch.name !== undefined && !patch.name.trim()) {
      setName(project.name);
      return;
    }
    try {
      upsertProject(await api.updateProject({ id: project.id, ...patch }));
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('projects.deleteTitle', { name: project.name }),
      body: t('projects.deleteBody', { count: project.line_count }),
      confirmLabel: t('projects.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      const snap = await api.deleteProject(project.id);
      await loadProjects();
      void refreshUsage().catch(() => {});
      toast(t('projects.deleted', { name: project.name }), {
        tone: 'ok', actionLabel: t('common.undo'),
        onAction: async () => {
          const p = await api.restoreProject(snap);
          await loadProjects();
          selectedProject.value = p.id;
          void refreshUsage().catch(() => {});
        },
      });
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    }
  };

  const shortage = bom?.reduce((a, r) => a + r.shortage, 0) ?? 0;
  const required = bom?.reduce((a, r) => a + r.required_qty, 0) ?? 0;
  return (
    <section class="project-detail" aria-label={project.name}>
      <header class="project-head">
        <input class="title-input" aria-label={t('projects.name')} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          onBlur={() => { if (name !== project.name) void saveMeta({ name }); }} />
        <span class="grow" />
        <Button variant="danger" size="sm" icon="trash" onClick={() => void remove()}>{t('projects.delete')}</Button>
      </header>
      <p class="project-summary muted num">
        {t('projects.summary', { lines: bom?.length ?? 0, pieces: required })}{' '}
        {shortage > 0 ? <Badge tone="warn">{t('projects.missingTotal', { count: shortage })}</Badge> : bom?.length ? <Badge tone="ok">{t('projects.allInStock')}</Badge> : null}
      </p>
      <Tabs value={tab} onChange={setTab} label={t('projects.tabs')}
        tabs={[{ value: 'bom', label: t('projects.bom'), count: bom?.length }, { value: 'schematic', label: t('projects.schematic') }, { value: 'notes', label: t('projects.notes') }]} />
      <div class="tab-panel" role="tabpanel">
        {tab === 'bom' ? (
          <>
            <AddLine project={project} onAdded={() => void reload()} />
            {bom ? <BomTable rows={bom} onChange={() => void reload()} /> : <Spinner label={t('common.loading')} />}
          </>
        ) : null}
        {tab === 'schematic' ? <Schematic project={project} bom={bom ?? []} onImportBom={setSchematicText} /> : null}
        {tab === 'notes' ? (
          <div class="stack">
            <TextArea label={t('projects.description')} value={description} onValue={setDescription} rows={2} onBlur={() => { if (description !== project.description) void saveMeta({ description }); }} />
            <TextArea label={t('projects.notes')} value={notes} onValue={setNotes} rows={10} onBlur={() => { if (notes !== project.notes) void saveMeta({ notes }); }} />
          </div>
        ) : null}
      </div>
      {schematicText !== null ? <SchematicBomDialog project={project} text={schematicText} onClose={() => setSchematicText(null)} onDone={() => void reload()} /> : null}
    </section>
  );
}

export function ProjectsView() {
  useEffect(() => { void loadProjects().catch((e) => toast(errorMessage(e), { tone: 'warn' })); }, []);
  const current = projects.value.find((p) => p.id === selectedProject.value) ?? null;
  return (
    <div class="view projects-view">
      <header class="toolbar">
        <h1 class="view-title">{t('nav.projects')}</h1>
      </header>
      {!projectsLoaded.value ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <div class="split">
          <ProjectList />
          {current ? (
            <ProjectDetail project={current} key={current.id} />
          ) : (
            <EmptyState icon="projects" title={t('projects.emptyTitle')}>{t('projects.emptyBody')}</EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
