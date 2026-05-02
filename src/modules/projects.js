import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { state, escHtml, showToast } from '../app.js';
import { t, applyTranslations } from './i18n.js';
import { STORAGE_KEYS } from './constants.js';
import {
  normalizePartKey,
  parseKicadPlacements,
  parseKicadSchForOverlay,
  buildSchOverlaySvg,
  aggregateSchematicInventoryMatches,
} from './kicad_sch_core.js';

let currentProjectId = null;
let currentObjectUrl = null;

function loadWishlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REORDER_WISHLIST);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveWishlist(rows) {
  localStorage.setItem(STORAGE_KEYS.REORDER_WISHLIST, JSON.stringify(rows));
}

async function listProjects() {
  return state.db.select('SELECT * FROM projects ORDER BY updated_at DESC, id DESC');
}

async function listProjectItems(projectId) {
  return state.db.select(
    `SELECT pc.id,
            pc.project_id,
            pc.component_id,
            pc.required_qty,
            pc.note,
            c.part_code,
            c.description,
            c.quantity
       FROM project_components pc
       JOIN components c ON c.id = pc.component_id
      WHERE pc.project_id = ?
      ORDER BY c.part_code ASC`,
    [projectId]
  );
}

function clearViewerUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function pickCurrentProject(projects) {
  if (!projects.length) return null;
  if (currentProjectId && projects.some(p => Number(p.id) === Number(currentProjectId))) return currentProjectId;
  return projects[0].id;
}

async function renderProjectList(projects) {
  const listEl = document.getElementById('projects-list');
  if (!listEl) return;
  if (!projects.length) {
    listEl.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:0.8rem">${t('project.empty')}</div>`;
    return;
  }
  listEl.innerHTML = projects.map(p => {
    const active = Number(p.id) === Number(currentProjectId) ? 'background:var(--bg-hover);border-color:var(--accent)' : '';
    const desc = String(p.description || '').trim();
    const descShown = desc || t('project.noDesc');
    return `<button type="button" class="btn btn-ghost project-list-item" data-project-id="${p.id}" style="width:100%;justify-content:flex-start;padding:8px 10px;border:1px solid var(--border-subtle);${active}" title="${escHtml(descShown)}">
      <span style="text-align:left;min-width:0">
        <strong style="display:block;font-size:0.8rem;word-break:break-word">${escHtml(p.name || '-')}</strong>
        <span class="project-list-desc" style="font-size:0.68rem;color:var(--text-tertiary)">${escHtml(descShown)}</span>
      </span>
    </button>`;
  }).join('');
  listEl.querySelectorAll('.project-list-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentProjectId = Number(btn.dataset.projectId);
      await renderProjects();
    });
  });
}

function renderProjectSummary(items) {
  const sumEl = document.getElementById('project-summary');
  if (!sumEl) return;
  const totals = items.reduce((acc, row) => {
    const need = Math.max(1, Number(row.required_qty) || 1);
    const stock = Math.max(0, Number(row.quantity) || 0);
    acc.total += need;
    if (stock < need) acc.missing += (need - stock);
    return acc;
  }, { total: 0, missing: 0 });
  sumEl.textContent = t('project.summary', { total: totals.total, missing: totals.missing });
}

function syncShortagesToWishlist(project, items) {
  const list = loadWishlist();
  const withoutThisProject = list.filter(e => !(e && e.source === 'project-shortage' && Number(e.projectId) === Number(project.id)));
  const additions = [];
  for (const row of items) {
    const req = Math.max(1, Number(row.required_qty) || 1);
    const stock = Math.max(0, Number(row.quantity) || 0);
    const miss = req > stock ? (req - stock) : 0;
    if (miss <= 0) continue;
    additions.push({
      id: `proj-${project.id}-${row.component_id}`,
      source: 'project-shortage',
      projectId: Number(project.id),
      partCode: String(row.part_code || ''),
      qty: miss,
      note: `[${project.name}] ${t('project.shortage.note', { req, stock })}`,
    });
  }
  saveWishlist([...withoutThisProject, ...additions]);
}

async function renderBomTable(project, items) {
  const tbody = document.getElementById('project-bom-tbody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px">${t('project.bom.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(row => {
    const req = Math.max(1, Number(row.required_qty) || 1);
    const stock = Math.max(0, Number(row.quantity) || 0);
    const miss = req > stock ? (req - stock) : 0;
    const status = miss > 0
      ? `<span class="badge" style="background:var(--danger-bg);color:var(--danger)">${t('project.status.missing', { n: miss })}</span>`
      : `<span class="badge" style="background:var(--accent-green-dim);color:var(--accent-green)">${t('project.status.ok')}</span>`;
    return `<tr data-pc-id="${row.id}" data-comp-id="${row.component_id}">
      <td style="font-family:var(--font-mono)">${escHtml(row.part_code || '')}</td>
      <td style="color:var(--text-muted)">${escHtml(row.description || '')}</td>
      <td><input type="number" class="settings-input-sm project-req-input" min="1" value="${req}" style="width:76px" /></td>
      <td>${stock}</td>
      <td>${status}</td>
      <td><button type="button" class="btn btn-ghost btn-sm project-remove-btn">${t('action.delete')}</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.project-req-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const tr = inp.closest('tr');
      const id = Number(tr?.dataset.pcId);
      const req = Math.max(1, Number(inp.value) || 1);
      await state.db.execute(
        "UPDATE project_components SET required_qty = ?, updated_at = datetime('now') WHERE id = ?",
        [req, id]
      );
      await renderProjects();
    });
  });
  tbody.querySelectorAll('.project-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const id = Number(tr?.dataset.pcId);
      await state.db.execute('DELETE FROM project_components WHERE id = ?', [id]);
      await renderProjects();
    });
  });

  syncShortagesToWishlist(project, items);
}

function buildBomNormMap(items) {
  const m = new Map();
  for (const row of items) {
    const key = normalizePartKey(row.part_code);
    if (!key) continue;
    m.set(key, {
      required: Math.max(1, Number(row.required_qty) || 1),
      stock: Math.max(0, Number(row.quantity) || 0),
    });
  }
  return m;
}

function inventoryNormKeysFromComponents() {
  const s = new Set();
  for (const c of state.components || []) {
    const k = normalizePartKey(c.part_code);
    if (k) s.add(k);
  }
  return s;
}

function schematicLegendHtml() {
  const rows = [
    ['#22c55e', 'project.sch.legend.ok'],
    ['#f59e0b', 'project.sch.legend.short'],
    ['#ef4444', 'project.sch.legend.unknown'],
    ['#94a3b8', 'project.sch.legend.extra'],
    ['#64748b', 'project.sch.legend.unassigned'],
  ];
  return `<div class="sch-legend-bar" role="group" aria-label="legend">
    ${rows.map(([c, key]) => `<span class="sch-legend-item"><span class="sch-legend-dot" style="background:${c}"></span>${escHtml(t(key))}</span>`).join('')}
  </div>`;
}

function wireKicadSchematicZoom(viewportEl) {
  if (!viewportEl) return;
  const inner = viewportEl.querySelector('.project-sch-zoom-inner');
  if (!inner) return;
  let scale = 1;
  const apply = () => {
    inner.style.transform = `scale(${scale})`;
  };
  viewportEl.addEventListener(
    'wheel',
    e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? 0.9 : 1.11;
      scale = Math.min(4.2, Math.max(0.35, scale * step));
      apply();
    },
    { passive: false }
  );
}

async function renderSchematic(project, items) {
  const view = document.getElementById('project-sch-view');
  if (!view) return;
  clearViewerUrl();
  const p = String(project?.schematic_path || '').trim();
  if (!p) {
    view.innerHTML = `<div style="padding:12px;color:var(--text-muted)">${t('project.schematic.empty')}</div>`;
    return;
  }
  try {
    const bytes = await invoke('read_external_file', { path: p });
    const ext = p.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      currentObjectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
      view.innerHTML = `<div class="project-sch-viewport" style="padding:8px;display:flex;align-items:center;justify-content:center"><img src="${currentObjectUrl}" alt="schematic" style="max-width:100%;object-fit:contain" /></div>`;
      return;
    }
    if (ext === 'pdf') {
      currentObjectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      view.innerHTML = `<div class="project-sch-viewport" style="padding:0;min-height:min(52vh,560px)"><iframe src="${currentObjectUrl}" title="schematic pdf" style="width:100%;height:min(52vh,560px);min-height:480px"></iframe></div>`;
      return;
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    const isKicadSch =
      ext === 'kicad_sch' || (ext === 'sch' && text.trimStart().startsWith('(kicad_sch'));
    if (isKicadSch) {
      const bomByNormKey = buildBomNormMap(items || []);
      const inventoryNormKeys = inventoryNormKeysFromComponents();
      const { placements, wires, bounds } = parseKicadSchForOverlay(text, { tightBounds: true });
      const hasGeometry = placements.length > 0 || wires.length > 0;
      if (hasGeometry) {
        const svg = buildSchOverlaySvg(placements, wires, bounds, bomByNormKey, inventoryNormKeys);
        view.innerHTML = `${schematicLegendHtml()}
          <div class="project-sch-viewport project-sch-viewport--kicad">
            <div class="project-sch-zoom-hint">${escHtml(t('project.sch.zoomHint'))}</div>
            <div class="project-sch-zoom-outer">
              <div class="project-sch-zoom-inner">${svg}</div>
            </div>
          </div>
          <details style="margin-top:8px">
            <summary style="cursor:pointer;font-size:0.75rem;color:var(--text-muted)">${escHtml(t('project.sch.showSource'))}</summary>
            <pre style="margin:8px 0 0;padding:10px;max-height:240px;overflow:auto;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-raised);font-size:11px;font-family:var(--font-mono)">${escHtml(text.slice(0, 50000))}</pre>
          </details>`;
        wireKicadSchematicZoom(view.querySelector('.project-sch-viewport--kicad'));
        return;
      }
      view.innerHTML = `<div style="padding:8px;color:var(--text-muted);font-size:0.8rem">${escHtml(t('project.sch.parseEmpty'))}</div>
        <pre style="margin:8px 0 0;padding:10px;max-height:360px;overflow:auto;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-raised);font-size:11px;font-family:var(--font-mono)">${escHtml(text.slice(0, 50000))}</pre>`;
      return;
    }
    view.innerHTML = `<pre style="margin:0;padding:10px;max-height:360px;overflow:auto;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-raised);font-size:11px;font-family:var(--font-mono)">${escHtml(text.slice(0, 50000))}</pre>`;
  } catch (err) {
    view.innerHTML = `<div style="padding:12px;color:var(--danger)">${escHtml(t('project.schematic.error'))}: ${escHtml(err?.message || String(err))}</div>`;
  }
}

async function fillProjectForm(project) {
  document.getElementById('project-name').value = project?.name || '';
  document.getElementById('project-desc').value = project?.description || '';
  document.getElementById('project-sch-path').value = project?.schematic_path || '';
  const title = document.getElementById('project-detail-title');
  if (title) title.textContent = project?.name || t('project.new');
}

function partCodeCandidates() {
  return [...new Set((state.components || []).map(c => c.part_code).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'tr-TR', { sensitivity: 'base' }));
}

function renderPartCodeDatalist() {
  const dl = document.getElementById('list-project-part-code');
  if (!dl) return;
  dl.innerHTML = partCodeCandidates().map(v => `<option value="${escHtml(v)}">`).join('');
}

async function addProjectComponent(projectId) {
  const codeEl = document.getElementById('project-add-part');
  const qtyEl = document.getElementById('project-add-qty');
  const noteEl = document.getElementById('project-add-note');
  const code = String(codeEl?.value || '').trim();
  if (!code) {
    showToast(t('project.part.required'), 'warning');
    return;
  }
  const comp = (state.components || []).find(c => String(c.part_code).toLocaleLowerCase('tr-TR') === code.toLocaleLowerCase('tr-TR'));
  if (!comp) {
    showToast(t('project.part.notFound', { code }), 'warning');
    return;
  }
  const qty = Math.max(1, Number(qtyEl?.value) || 1);
  const note = String(noteEl?.value || '').trim();
  await state.db.execute(
    `INSERT INTO project_components (project_id, component_id, required_qty, note)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, component_id) DO UPDATE SET required_qty = excluded.required_qty, note = excluded.note, updated_at = datetime('now')`,
    [projectId, comp.id, qty, note]
  );
  codeEl.value = '';
  if (noteEl) noteEl.value = '';
  if (qtyEl) qtyEl.value = '1';
  await renderProjects();
}

async function renderProjects() {
  const overlay = document.getElementById('overlay-projects');
  if (!overlay || overlay.style.display === 'none') return;
  const projects = await listProjects();
  currentProjectId = pickCurrentProject(projects);
  await renderProjectList(projects);
  renderPartCodeDatalist();

  const emptyWrap = document.getElementById('projects-empty-state');
  const detail = document.getElementById('project-detail-panel');
  if (!currentProjectId) {
    if (emptyWrap) emptyWrap.style.display = '';
    if (detail) detail.style.display = 'none';
    return;
  }
  if (emptyWrap) emptyWrap.style.display = 'none';
  if (detail) detail.style.display = '';

  const project = projects.find(p => Number(p.id) === Number(currentProjectId));
  await fillProjectForm(project);
  const items = await listProjectItems(currentProjectId);
  renderProjectSummary(items);
  await renderBomTable(project, items);
  await renderSchematic(project, items);
}

async function createProject() {
  await state.db.execute(
    `INSERT INTO projects (name, description, schematic_path) VALUES (?, '', '')`,
    [t('project.untitled')]
  );
  await renderProjects();
}

async function saveProjectMeta() {
  if (!currentProjectId) return;
  const name = String(document.getElementById('project-name')?.value || '').trim();
  if (!name) {
    showToast(t('project.name.required'), 'warning');
    return;
  }
  const desc = String(document.getElementById('project-desc')?.value || '').trim();
  const sch = String(document.getElementById('project-sch-path')?.value || '').trim();
  await state.db.execute(
    `UPDATE projects
        SET name = ?, description = ?, schematic_path = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [name, desc, sch, currentProjectId]
  );
  await renderProjects();
  showToast(t('project.saved'), 'success');
}

async function deleteCurrentProject() {
  if (!currentProjectId) return;
  await state.db.execute('DELETE FROM project_components WHERE project_id = ?', [currentProjectId]);
  await state.db.execute('DELETE FROM projects WHERE id = ?', [currentProjectId]);
  currentProjectId = null;
  await renderProjects();
}

async function addMatchedPartsFromSchematic() {
  if (!currentProjectId) return;
  const projects = await listProjects();
  const project = projects.find(p => Number(p.id) === Number(currentProjectId));
  const path = String(project?.schematic_path || '').trim();
  if (!path) {
    showToast(t('project.schematic.empty'), 'warning');
    return;
  }
  let text;
  try {
    const bytes = await invoke('read_external_file', { path });
    const ext = path.split('.').pop().toLowerCase();
    text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    const isKicad =
      ext === 'kicad_sch' || (ext === 'sch' && text.trimStart().startsWith('(kicad_sch'));
    if (!isKicad) {
      showToast(t('project.match.needKicad'), 'warning');
      return;
    }
  } catch {
    showToast(t('project.schematic.error'), 'error');
    return;
  }
  const placements = parseKicadPlacements(text);
  const matches = aggregateSchematicInventoryMatches(placements, state.components || []);
  const items = await listProjectItems(currentProjectId);
  const existing = new Set(items.map(r => Number(r.component_id)));
  const toAdd = matches.filter(m => !existing.has(Number(m.component_id)));
  if (!toAdd.length) {
    showToast(t('project.match.none'), 'info');
    return;
  }
  if (!confirm(t('project.match.confirm', { n: toAdd.length }))) return;
  for (const m of toAdd) {
    await state.db.execute(
      `INSERT INTO project_components (project_id, component_id, required_qty, note)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, component_id) DO UPDATE SET
         required_qty = required_qty + excluded.required_qty,
         updated_at = datetime('now')`,
      [currentProjectId, m.component_id, m.qty, '']
    );
  }
  showToast(t('project.match.done', { n: toAdd.length }), 'success');
  await renderProjects();
}

async function pickSchematicFile() {
  const picked = await openDialog({
    title: t('project.schematic.pick'),
    multiple: false,
    filters: [
      { name: 'Schematic', extensions: ['kicad_sch', 'sch', 'pdf', 'png', 'jpg', 'jpeg', 'svg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (!picked || Array.isArray(picked)) return;
  const pathEl = document.getElementById('project-sch-path');
  if (pathEl) pathEl.value = picked;
  await saveProjectMeta();
}

export function initProjects() {
  const openBtn = document.getElementById('btn-projects');
  const overlay = document.getElementById('overlay-projects');
  if (!openBtn || !overlay) return;

  openBtn.addEventListener('click', async () => {
    applyTranslations(overlay);
    overlay.style.display = 'flex';
    await renderProjects();
  });

  document.getElementById('btn-project-create')?.addEventListener('click', createProject);
  document.getElementById('btn-project-save-meta')?.addEventListener('click', saveProjectMeta);
  document.getElementById('btn-project-delete')?.addEventListener('click', deleteCurrentProject);
  document.getElementById('btn-project-add-part')?.addEventListener('click', async () => {
    if (!currentProjectId) return;
    await addProjectComponent(currentProjectId);
  });
  document.getElementById('btn-project-pick-sch')?.addEventListener('click', pickSchematicFile);
  document.getElementById('btn-project-refresh-sch')?.addEventListener('click', renderProjects);
  document.getElementById('btn-project-match-sch')?.addEventListener('click', addMatchedPartsFromSchematic);
  document.getElementById('btn-project-sync-order')?.addEventListener('click', async () => {
    await renderProjects();
    showToast(t('project.order.synced'), 'success');
  });
}
