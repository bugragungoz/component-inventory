/** Add the chosen parts to a project's parts list (or to a new project). */
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { Component } from '../../api/types';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Select, TextField } from '../../components/Field';
import { Spinner } from '../../components/Misc';
import { parseUserQuantity } from '../../domain/number';
import { locale, t } from '../../i18n';
import { refreshUsage } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { assignTo, view } from '../../state/ui';
import { errorMessage } from '../inventory/labels';
import { loadProjects, projects, projectsLoaded, selectedProject } from './state';

const NEW = 'new';

export function AssignDialog({ parts }: { parts: Component[] }) {
  const [target, setTarget] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects().then((list) => setTarget(String(selectedProject.value ?? list[0]?.id ?? NEW)), () => setTarget(NEW));
  }, []);

  const close = () => { assignTo.value = null; };
  const apply = async (e: Event) => {
    e.preventDefault();
    const n = parseUserQuantity(qty, locale.value);
    if (n === null || n <= 0) {
      setError(t('projects.addInvalid'));
      return;
    }
    setBusy(true);
    try {
      let projectId = Number(target);
      let name = projects.value.find((p) => p.id === projectId)?.name ?? '';
      if (target === NEW) {
        if (!newName.trim()) {
          setError(t('projects.nameRequired'));
          setBusy(false);
          return;
        }
        const p = await api.createProject(newName.trim());
        projectId = p.id;
        name = p.name;
      }
      await api.addBomLines(parts.map((c) => ({ project_id: projectId, component_id: c.id, required_qty: n, note: '', add_to_existing: true })));
      void refreshUsage().catch(() => {});
      await loadProjects();
      close();
      toast(t('assign.done', { count: parts.length, name }), {
        tone: 'ok', actionLabel: t('assign.open'),
        onAction: () => { selectedProject.value = projectId; view.value = 'projects'; },
      });
    } catch (err) {
      toast(errorMessage(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('assign.title', { count: parts.length })} onClose={close} busy={busy}
      actions={<><Button onClick={close} disabled={busy}>{t('common.cancel')}</Button><Button variant="primary" type="submit" form="assign-form" disabled={busy || !target}>{t('assign.confirm')}</Button></>}>
      {!projectsLoaded.value || !target ? <Spinner label={t('common.loading')} /> : (
        <form id="assign-form" class="stack" onSubmit={(e) => void apply(e)}>
          <p class="muted mono truncate">{parts.slice(0, 6).map((p) => p.part_code).join(', ')}{parts.length > 6 ? ` +${parts.length - 6}` : ''}</p>
          <Select label={t('assign.project')} value={target} onValue={setTarget}
            options={[...projects.value.map((p) => ({ value: String(p.id), label: p.name })), { value: NEW, label: t('assign.newProject') }]} />
          {target === NEW ? <TextField label={t('projects.name')} value={newName} onValue={setNewName} /> : null}
          <TextField label={t('assign.qty')} value={qty} onValue={(v) => { setQty(v); setError(null); }} inputMode="numeric" class="num" error={error} hint={t('assign.qtyHint')} />
        </form>
      )}
    </Dialog>
  );
}
