import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { state, escHtml, showToast , closeModal } from '../app.js';
import { t, applyTranslations } from './i18n.js';
import {
  normalizePartKey,
  parseKicadSchForOverlay,
  buildSchOverlaySvg,
} from './kicad_sch_core.js';
import { mountPdfViewer } from './pdf_viewer.js';

let currentProjectId = null;
let currentObjectUrl = null;
let currentPdfHandle = null;

async function destroyPdfHandle() {
  if (!currentPdfHandle) return;
  const handle = currentPdfHandle;
  currentPdfHandle = null;
  try {
    await handle.destroy();
  } catch (_) {
    // pdf already torn down
  }
}

function clearViewerUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

// ============================================================
// DB helpers
// ============================================================

/**
 * Project rows ordered by the manual order_index, then by id as a stable
 * tiebreaker. Newly created rows default to order_index = 0 so they appear
 * at the top of the sidebar until the user reorders them.
 */
async function listProjects() {
  return state.db.select(
    'SELECT * FROM projects ORDER BY order_index ASC, id ASC'
  );
}

async function listProjectItems(projectId) {
  return state.db.select(
    `SELECT pc.id,
            pc.project_id,
            pc.component_id,
            pc.required_qty,
            pc.missing_qty,
            pc.note,
            c.part_code,
            c.description,
            c.category,
            c.subcategory,
            c.quantity
       FROM project_components pc
       JOIN components c ON c.id = pc.component_id
      WHERE pc.project_id = ?
      ORDER BY c.part_code ASC`,
    [projectId]
  );
}

/**
 * Aggregate per-component required_qty across every project. Used to drive
 * the "X used in Y projects" badge on the inventory table and detail modal.
 */
export async function listProjectUsage() {
  if (!state.db) return [];
  return state.db.select(
    `SELECT pc.component_id,
            COUNT(DISTINCT pc.project_id) AS project_count,
            COALESCE(SUM(pc.required_qty), 0) AS total_required
       FROM project_components pc
      GROUP BY pc.component_id`
  );
}

/** Per-project breakdown for a single component (used by component detail). */
export async function listProjectsUsingComponent(componentId) {
  if (!state.db || !componentId) return [];
  return state.db.select(
    `SELECT p.id AS project_id, p.name, pc.required_qty, pc.missing_qty, pc.note
       FROM project_components pc
       JOIN projects p ON p.id = pc.project_id
      WHERE pc.component_id = ?
      ORDER BY p.order_index ASC, p.id ASC`,
    [componentId]
  );
}

// ============================================================
// PDF viewer + KiCad schematic rendering
// ============================================================

function pdfViewerLabels() {
  return {
    prev: t('pdf.prev'),
    next: t('pdf.next'),
    zoomIn: t('pdf.zoomIn'),
    zoomOut: t('pdf.zoomOut'),
    fit: t('pdf.fit'),
    fitShort: t('pdf.fitShort'),
    reset: t('pdf.reset'),
    resetShort: t('pdf.resetShort'),
    hint: t('pdf.hint'),
    loading: t('pdf.loading'),
    error: t('pdf.error'),
  };
}

function pickCurrentProject(projects) {
  if (!projects.length) return null;
  if (currentProjectId && projects.some(p => Number(p.id) === Number(currentProjectId))) return currentProjectId;
  return projects[0].id;
}

// ============================================================
// Sidebar list (rename inline + drag/order + hover delete)
// ============================================================

function renderProjectList(projects) {
  const listEl = document.getElementById('projects-list');
  if (!listEl) return;
  if (!projects.length) {
    listEl.innerHTML = `<div class="projects-list-empty">${escHtml(t('project.empty'))}</div>`;
    return;
  }
  listEl.innerHTML = projects.map((p, idx) => {
    const isActive = Number(p.id) === Number(currentProjectId);
    const safeName = escHtml(p.name || '');
    const isFirst = idx === 0;
    const isLast = idx === projects.length - 1;
    return `<div class="project-list-item${isActive ? ' active' : ''}" data-project-id="${p.id}">
      <div class="project-list-row">
        <div class="project-list-order">
          <button type="button" class="project-list-icon-btn project-list-up" data-i18n-title="project.btn.moveUp" title="Move up" ${isFirst ? 'disabled' : ''}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button type="button" class="project-list-icon-btn project-list-down" data-i18n-title="project.btn.moveDown" title="Move down" ${isLast ? 'disabled' : ''}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
        <input type="text" class="project-list-name-input" value="${safeName}" data-i18n-title="project.btn.rename" title="Rename project" spellcheck="false" />
        <button type="button" class="project-list-icon-btn project-list-delete" data-i18n-title="project.btn.delete" title="Delete project">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  applyTranslations(listEl);

  listEl.querySelectorAll('.project-list-item').forEach(item => {
    const id = Number(item.dataset.projectId);
    const nameInput = item.querySelector('.project-list-name-input');
    const upBtn = item.querySelector('.project-list-up');
    const downBtn = item.querySelector('.project-list-down');
    const delBtn = item.querySelector('.project-list-delete');

    item.addEventListener('click', e => {
      // Activate the project unless the user is interacting with controls
      if (e.target.closest('.project-list-icon-btn')) return;
      if (e.target === nameInput) return;
      currentProjectId = id;
      renderProjects();
    });

    nameInput?.addEventListener('focus', () => {
      currentProjectId = id;
    });
    nameInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); nameInput.value = projects.find(p => Number(p.id) === id)?.name || ''; nameInput.blur(); }
    });
    nameInput?.addEventListener('change', async () => {
      const next = String(nameInput.value || '').trim();
      if (!next) {
        showToast(t('project.name.required'), 'warning');
        nameInput.value = projects.find(p => Number(p.id) === id)?.name || '';
        return;
      }
      await state.db.execute(
        "UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?",
        [next, id]
      );
      await renderProjects();
    });

    upBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      await moveProject(id, -1);
    });
    downBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      await moveProject(id, +1);
    });
    delBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      const proj = projects.find(p => Number(p.id) === id);
      if (!proj) return;
      const confirmed = window.confirm(t('project.delete.confirm', { name: proj.name }));
      if (!confirmed) return;
      await deleteProject(id);
    });
  });
}

async function moveProject(projectId, direction) {
  const projects = await listProjects();
  const idx = projects.findIndex(p => Number(p.id) === Number(projectId));
  if (idx < 0) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= projects.length) return;
  // Swap order_index with neighbor; rewrite the entire list with sequential
  // values so ties cannot drift over time.
  const reordered = projects.slice();
  const [picked] = reordered.splice(idx, 1);
  reordered.splice(targetIdx, 0, picked);
  for (let i = 0; i < reordered.length; i++) {
    await state.db.execute(
      "UPDATE projects SET order_index = ?, updated_at = datetime('now') WHERE id = ?",
      [i, reordered[i].id]
    );
  }
  await renderProjects();
}

async function deleteProject(projectId) {
  await state.db.execute('DELETE FROM project_components WHERE project_id = ?', [projectId]);
  await state.db.execute('DELETE FROM projects WHERE id = ?', [projectId]);
  if (Number(currentProjectId) === Number(projectId)) currentProjectId = null;
  await renderProjects();
}

// ============================================================
// BOM
// ============================================================

function renderProjectSummary(items) {
  const sumEl = document.getElementById('project-summary');
  if (!sumEl) return;
  const totals = items.reduce((acc, row) => {
    acc.required += Math.max(0, Number(row.required_qty) || 0);
    acc.missing += Math.max(0, Number(row.missing_qty) || 0);
    return acc;
  }, { required: 0, missing: 0 });
  sumEl.textContent = t('project.summary', { total: totals.required, missing: totals.missing });
}

async function renderBomTable(_project, items) {
  const tbody = document.getElementById('project-bom-tbody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:16px">${escHtml(t('project.bom.empty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(row => {
    const req = Math.max(0, Number(row.required_qty) || 0);
    const missing = Math.max(0, Number(row.missing_qty) || 0);
    const stock = Math.max(0, Number(row.quantity) || 0);
    const note = String(row.note || '');
    return `<tr data-pc-id="${row.id}" data-comp-id="${row.component_id}">
      <td class="bom-part">${escHtml(row.part_code || '')}</td>
      <td class="bom-desc">${escHtml(row.description || '')}</td>
      <td><input type="number" class="settings-input-sm project-req-input" min="0" value="${req}" /></td>
      <td><input type="number" class="settings-input-sm project-missing-input" min="0" value="${missing}" /></td>
      <td class="bom-stock">${stock}</td>
      <td><input type="text" class="settings-input-path project-note-input" value="${escHtml(note)}" /></td>
      <td>
        <button type="button" class="btn btn-ghost btn-sm project-remove-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  // Bind one save helper per row that respects the latest form values.
  const persistRow = async (tr) => {
    const id = Number(tr?.dataset.pcId);
    if (!id) return;
    const reqEl = tr.querySelector('.project-req-input');
    const missEl = tr.querySelector('.project-missing-input');
    const noteEl = tr.querySelector('.project-note-input');
    const req = Math.max(0, Number(reqEl?.value) || 0);
    const miss = Math.max(0, Number(missEl?.value) || 0);
    const note = String(noteEl?.value || '');
    await state.db.execute(
      `UPDATE project_components
          SET required_qty = ?, missing_qty = ?, note = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [req, miss, note, id]
    );
  };

  tbody.querySelectorAll('.project-req-input, .project-missing-input, .project-note-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const tr = inp.closest('tr');
      await persistRow(tr);
      const project = await getCurrentProject();
      const items2 = await listProjectItems(currentProjectId);
      renderProjectSummary(items2);
      // Keep schematic colour state aligned with the new BOM values
      await renderSchematic(project, items2);
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
}

function buildBomNormMap(items) {
  const m = new Map();
  for (const row of items) {
    const key = normalizePartKey(row.part_code);
    if (!key) continue;
    m.set(key, {
      required: Math.max(0, Number(row.required_qty) || 0),
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

// ============================================================
// Schematic viewer
// ============================================================

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
  const outer = viewportEl.querySelector('.project-sch-zoom-outer');
  const inner = viewportEl.querySelector('.project-sch-zoom-inner');
  if (!outer || !inner) return;

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;

  function applyTransform() {
    inner.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  outer.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = outer.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.11;
    const newScale = Math.min(5, Math.max(0.25, scale * factor));
    panX = mx - (mx - panX) * (newScale / scale);
    panY = my - (my - panY) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }, { passive: false });

  outer.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    outer.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    outer.style.userSelect = '';
  });

  outer.addEventListener('dblclick', () => {
    scale = 1; panX = 0; panY = 0;
    applyTransform();
  });
}

async function renderSchematic(project, items) {
  const view = document.getElementById('project-sch-view');
  if (!view) return;
  await destroyPdfHandle();
  clearViewerUrl();
  const p = String(project?.schematic_path || '').trim();
  if (!p) {
    view.innerHTML = `<div class="project-sch-empty">${escHtml(t('project.schematic.empty'))}</div>`;
    return;
  }
  try {
    const bytes = await invoke('read_external_file', { path: p });
    const ext = p.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      currentObjectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
      view.innerHTML = `<div class="project-sch-viewport"><img src="${currentObjectUrl}" alt="schematic" /></div>`;
      return;
    }
    if (ext === 'pdf') {
      view.innerHTML = `<div class="project-sch-viewport project-sch-viewport--pdf"></div>`;
      const host = view.querySelector('.project-sch-viewport--pdf');
      currentPdfHandle = await mountPdfViewer(host, new Uint8Array(bytes), {
        labels: pdfViewerLabels(),
      });
      return;
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    const isKicadSch =
      ext === 'kicad_sch' || (ext === 'sch' && text.trimStart().startsWith('(kicad_sch'));
    if (isKicadSch) {
      const bomByNormKey = buildBomNormMap(items || []);
      const inventoryNormKeys = inventoryNormKeysFromComponents();
      const { placements, wires, bounds, libDrawMap } = parseKicadSchForOverlay(text, { tightBounds: true });
      const hasGeometry = placements.length > 0 || wires.length > 0;
      if (hasGeometry) {
        const svg = buildSchOverlaySvg(placements, wires, bounds, bomByNormKey, inventoryNormKeys, libDrawMap);
        const hintText = t('project.sch.zoomHint');
        const sourceLabel = t('project.sch.showSource');
        view.innerHTML = `${schematicLegendHtml()}
          <div class="project-sch-viewport project-sch-viewport--kicad">
            <span class="project-sch-zoom-hint">${escHtml(hintText)}</span>
            <div class="project-sch-zoom-outer">
              <div class="project-sch-zoom-inner">${svg}</div>
            </div>
          </div>
          <details class="project-sch-source">
            <summary>${escHtml(sourceLabel)}</summary>
            <pre>${escHtml(text.slice(0, 50000))}</pre>
          </details>`;
        wireKicadSchematicZoom(view.querySelector('.project-sch-viewport--kicad'));
        return;
      }
      view.innerHTML = `<div class="project-sch-empty">${escHtml(t('project.sch.parseEmpty'))}</div>
        <pre class="project-sch-source-pre">${escHtml(text.slice(0, 50000))}</pre>`;
      return;
    }
    view.innerHTML = `<pre class="project-sch-source-pre">${escHtml(text.slice(0, 50000))}</pre>`;
  } catch (err) {
    view.innerHTML = `<div class="project-sch-error">${escHtml(t('project.schematic.error'))}: ${escHtml(err?.message || String(err))}</div>`;
  }
}

// ============================================================
// Detail panel form
// ============================================================

function fillProjectForm(project) {
  const desc = document.getElementById('project-desc');
  const notes = document.getElementById('project-notes');
  const sch = document.getElementById('project-sch-path');
  const title = document.getElementById('project-detail-title');
  if (desc) desc.value = project?.description || '';
  if (notes) notes.value = project?.notes || '';
  if (sch) sch.value = project?.schematic_path || '';
  if (title) title.textContent = project?.name || t('project.new');
}

async function getCurrentProject() {
  if (!currentProjectId) return null;
  const rows = await state.db.select(
    'SELECT * FROM projects WHERE id = ? LIMIT 1',
    [currentProjectId]
  );
  return rows && rows[0] ? rows[0] : null;
}

// ============================================================
// BOM add row: category + part-code datalist + inventory results
// ============================================================

function partCodeCandidates(category) {
  return [...new Set(
    (state.components || [])
      .filter(c => !category || String(c.category || '').toLocaleLowerCase('tr-TR') === category.toLocaleLowerCase('tr-TR'))
      .map(c => c.part_code)
      .filter(Boolean)
  )].sort((a, b) => String(a).localeCompare(String(b), 'tr-TR', { sensitivity: 'base' }));
}

function renderPartCodeDatalist(category) {
  const dl = document.getElementById('list-project-part-code');
  if (!dl) return;
  dl.innerHTML = partCodeCandidates(category).map(v => `<option value="${escHtml(v)}">`).join('');
}

function populateCategorySelect() {
  const sel = document.getElementById('project-add-category');
  if (!sel) return;
  const cats = [...new Set((state.components || []).map(c => String(c.category || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'tr-TR', { sensitivity: 'base' }));
  const previous = sel.value;
  sel.innerHTML = `<option value="">${escHtml(t('project.cat.all'))}</option>` +
    cats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
  if (previous && cats.includes(previous)) sel.value = previous;
}

function renderInventoryQuickResults(category, query) {
  const out = document.getElementById('project-inventory-search-results');
  if (!out) return;
  const q = String(query || '').trim().toLocaleLowerCase('tr-TR');
  const cat = String(category || '').trim().toLocaleLowerCase('tr-TR');
  // Show results only when there is a category filter or a search term -
  // otherwise the listing would dump the entire inventory under the form.
  if (!q && !cat) {
    out.innerHTML = '';
    out.style.display = 'none';
    return;
  }
  const rows = (state.components || [])
    .filter(c => {
      if (cat && String(c.category || '').toLocaleLowerCase('tr-TR') !== cat) return false;
      if (!q) return true;
      const code = String(c.part_code || '').toLocaleLowerCase('tr-TR');
      const desc = String(c.description || '').toLocaleLowerCase('tr-TR');
      return code.includes(q) || desc.includes(q);
    })
    .sort((a, b) => String(a.part_code || '').localeCompare(String(b.part_code || ''), 'tr-TR', { sensitivity: 'base' }))
    .slice(0, 60);

  out.style.display = '';
  if (!rows.length) {
    out.innerHTML = `<div class="project-inv-empty">${escHtml(t('project.inv.search.empty'))}</div>`;
    return;
  }
  out.innerHTML = rows.map(c => {
    const qty = Math.max(0, Number(c.quantity) || 0);
    const subLabel = [c.category, c.subcategory].filter(Boolean).join(' / ');
    return `<button type="button" class="project-inv-item" data-part-code="${escHtml(c.part_code || '')}">
      <div class="project-inv-meta">
        <div class="project-inv-code">${escHtml(c.part_code || '-')}</div>
        <div class="project-inv-desc">${escHtml(c.description || '')}</div>
        ${subLabel ? `<div class="project-inv-sub">${escHtml(subLabel)}</div>` : ''}
      </div>
      <div class="project-inv-qty">${escHtml(t('project.inv.qty', { n: qty }))}</div>
    </button>`;
  }).join('');
  out.querySelectorAll('.project-inv-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const partEl = document.getElementById('project-add-part');
      if (!partEl) return;
      partEl.value = btn.dataset.partCode || '';
      partEl.focus();
      out.style.display = 'none';
    });
  });
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
  const comp = (state.components || []).find(c =>
    String(c.part_code).toLocaleLowerCase('tr-TR') === code.toLocaleLowerCase('tr-TR')
  );
  if (!comp) {
    showToast(t('project.part.notFound', { code }), 'warning');
    return;
  }
  const qty = Math.max(1, Number(qtyEl?.value) || 1);
  const note = String(noteEl?.value || '').trim();
  // Stock is NOT decremented - BOM lines just track requirements.
  // ON CONFLICT: keep existing missing_qty so a manual shortage is preserved
  // when the row is re-added with a new required value.
  await state.db.execute(
    `INSERT INTO project_components (project_id, component_id, required_qty, note)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, component_id) DO UPDATE SET
        required_qty = excluded.required_qty,
        note         = excluded.note,
        updated_at   = datetime('now')`,
    [projectId, comp.id, qty, note]
  );
  if (codeEl) codeEl.value = '';
  if (noteEl) noteEl.value = '';
  if (qtyEl) qtyEl.value = '1';
  await renderProjects();
}

// ============================================================
// Top-level render
// ============================================================

async function renderProjects() {
  const overlay = document.getElementById('overlay-projects');
  if (!overlay || overlay.style.display === 'none') return;
  const projects = await listProjects();
  currentProjectId = pickCurrentProject(projects);
  renderProjectList(projects);
  populateCategorySelect();
  const catSel = document.getElementById('project-add-category');
  renderPartCodeDatalist(catSel?.value || '');
  renderInventoryQuickResults(catSel?.value || '',
    document.getElementById('project-add-part')?.value || '');

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
  fillProjectForm(project);
  const items = await listProjectItems(currentProjectId);
  renderProjectSummary(items);
  await renderBomTable(project, items);
  await renderSchematic(project, items);
}

async function createProject() {
  // New rows go to the top of the list. We push every other project's
  // order_index down by one so the manual ordering stays sequential.
  await state.db.execute(
    "UPDATE projects SET order_index = order_index + 1, updated_at = datetime('now')"
  );
  await state.db.execute(
    `INSERT INTO projects (name, description, notes, schematic_path, order_index)
     VALUES (?, '', '', '', 0)`,
    [t('project.untitled')]
  );
  // Activate the freshly inserted row
  const rows = await state.db.select(
    'SELECT id FROM projects WHERE order_index = 0 ORDER BY id DESC LIMIT 1'
  );
  if (rows && rows[0]) currentProjectId = Number(rows[0].id);
  await renderProjects();
}

async function saveProjectMeta() {
  if (!currentProjectId) return;
  const desc = String(document.getElementById('project-desc')?.value || '').trim();
  const notes = String(document.getElementById('project-notes')?.value || '');
  const sch = String(document.getElementById('project-sch-path')?.value || '').trim();
  await state.db.execute(
    `UPDATE projects
        SET description = ?, notes = ?, schematic_path = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [desc, notes, sch, currentProjectId]
  );
  showToast(t('project.saved'), 'success');
  await renderProjects();
}

async function pickSchematicFile() {
  const picked = await openDialog({
    title: t('project.schematic.pick'),
    multiple: false,
    filters: [
      { name: 'Schematic PDF', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (!picked || Array.isArray(picked)) return;
  const pathEl = document.getElementById('project-sch-path');
  if (pathEl) pathEl.value = picked;
  await saveProjectMeta();
}

// ============================================================
// "Assign component to project" flow (driven from component detail)
// ============================================================

let assignContext = null;

async function openAssignModal(component) {
  if (!component) return;
  assignContext = component;
  const overlay = document.getElementById('overlay-assign-project');
  const select = document.getElementById('assign-project');
  const partLabel = document.getElementById('assign-part-label');
  const qty = document.getElementById('assign-qty');
  const note = document.getElementById('assign-note');
  if (!overlay || !select) return;

  applyTranslations(overlay);
  const projects = await listProjects();
  if (!projects.length) {
    showToast(t('project.empty'), 'warning');
    return;
  }
  select.innerHTML = projects
    .map(p => `<option value="${p.id}">${escHtml(p.name || t('project.untitled'))}</option>`)
    .join('');
  if (partLabel) {
    partLabel.textContent = `${component.part_code || '-'} - ${component.description || ''}`.trim();
  }
  if (qty) qty.value = '1';
  if (note) note.value = '';
  overlay.style.display = 'flex';
}

async function commitAssign() {
  if (!assignContext) return;
  const select = document.getElementById('assign-project');
  const qtyEl = document.getElementById('assign-qty');
  const noteEl = document.getElementById('assign-note');
  const projectId = Number(select?.value || 0);
  if (!projectId) {
    showToast(t('project.empty'), 'warning');
    return;
  }
  const qty = Math.max(1, Number(qtyEl?.value) || 1);
  const note = String(noteEl?.value || '').trim();
  await state.db.execute(
    `INSERT INTO project_components (project_id, component_id, required_qty, note)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, component_id) DO UPDATE SET
        required_qty = excluded.required_qty,
        note         = excluded.note,
        updated_at   = datetime('now')`,
    [projectId, assignContext.id, qty, note]
  );
  showToast(t('assign.saved'), 'success');
  closeModal(document.getElementById('overlay-assign-project'));
  document.dispatchEvent(new CustomEvent('project-usage-changed'));
}

// ============================================================
// Public init
// ============================================================

export function initProjects() {
  const openBtn = document.getElementById('btn-projects');
  const overlay = document.getElementById('overlay-projects');
  if (!openBtn || !overlay) return;

  openBtn.addEventListener('click', async () => {
    applyTranslations(overlay);
    overlay.style.display = 'flex';
    await renderProjects();
  });

  // Free the PDF document and any object URLs whenever the modal closes,
  // regardless of whether the user clicked the X, the footer Close button,
  // pressed Escape, or clicked outside the modal.
  const observer = new MutationObserver(() => {
    if (overlay.style.display === 'none') {
      destroyPdfHandle();
      clearViewerUrl();
      document.dispatchEvent(new CustomEvent('project-usage-changed'));
    }
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ['style'] });

  document.getElementById('btn-project-create')?.addEventListener('click', createProject);
  document.getElementById('btn-project-save-meta')?.addEventListener('click', saveProjectMeta);
  document.getElementById('btn-project-add-part')?.addEventListener('click', async () => {
    if (!currentProjectId) return;
    await addProjectComponent(currentProjectId);
  });
  document.getElementById('btn-project-pick-sch')?.addEventListener('click', pickSchematicFile);
  document.getElementById('btn-project-refresh-sch')?.addEventListener('click', renderProjects);

  // Inventory finder controls (category + part code)
  const catSel = document.getElementById('project-add-category');
  const partInput = document.getElementById('project-add-part');
  catSel?.addEventListener('change', () => {
    renderPartCodeDatalist(catSel.value || '');
    renderInventoryQuickResults(catSel.value || '', partInput?.value || '');
  });
  partInput?.addEventListener('input', () => {
    renderInventoryQuickResults(catSel?.value || '', partInput.value || '');
  });

  // Assign-to-project modal (opened from component detail)
  document.addEventListener('open-assign-project', e => {
    openAssignModal(e.detail);
  });
  document.getElementById('btn-assign-project-save')?.addEventListener('click', commitAssign);
}
