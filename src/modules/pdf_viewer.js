/**
 * Lightweight PDF viewer for the Projects window.
 *
 * Renders a PDF document into a canvas using pdfjs-dist and wires
 * pan / zoom / page navigation controls. The whole viewer is mounted
 * inside a host element supplied by the caller and returns a cleanup
 * function so callers can detach it cleanly when the modal closes
 * or when the schematic file is replaced.
 *
 * The module is intentionally framework-free so it can be reused
 * outside the Projects modal (e.g. detail dialogs) in the future.
 */

let _pdfjs = null;
let _pdfWorkerUrl = null;

async function loadPdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import('pdfjs-dist');
  }
  if (!_pdfWorkerUrl) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    _pdfWorkerUrl = worker.default;
  }
  _pdfjs.GlobalWorkerOptions.workerSrc = _pdfWorkerUrl;
  return _pdfjs;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
const ZOOM_STEP = 1.15;

function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSkeleton(rootEl, labels) {
  rootEl.innerHTML = `
    <div class="pdf-viewer">
      <div class="pdf-viewer__toolbar">
        <button type="button" class="pdf-btn" data-act="prev" title="${escAttr(labels.prev)}" aria-label="${escAttr(labels.prev)}">&lt;</button>
        <span class="pdf-viewer__page">
          <span class="pdf-viewer__page-current">1</span> / <span class="pdf-viewer__page-total">1</span>
        </span>
        <button type="button" class="pdf-btn" data-act="next" title="${escAttr(labels.next)}" aria-label="${escAttr(labels.next)}">&gt;</button>
        <span class="pdf-viewer__sep"></span>
        <button type="button" class="pdf-btn" data-act="zoom-out" title="${escAttr(labels.zoomOut)}" aria-label="${escAttr(labels.zoomOut)}">-</button>
        <span class="pdf-viewer__zoom">100%</span>
        <button type="button" class="pdf-btn" data-act="zoom-in" title="${escAttr(labels.zoomIn)}" aria-label="${escAttr(labels.zoomIn)}">+</button>
        <button type="button" class="pdf-btn" data-act="fit" title="${escAttr(labels.fit)}" aria-label="${escAttr(labels.fit)}">${escAttr(labels.fitShort)}</button>
        <button type="button" class="pdf-btn" data-act="reset" title="${escAttr(labels.reset)}" aria-label="${escAttr(labels.reset)}">${escAttr(labels.resetShort)}</button>
        <span class="pdf-viewer__hint">${escAttr(labels.hint)}</span>
      </div>
      <div class="pdf-viewer__stage">
        <div class="pdf-viewer__inner">
          <canvas class="pdf-viewer__canvas"></canvas>
        </div>
      </div>
    </div>
  `;
  return {
    root: rootEl.querySelector('.pdf-viewer'),
    stage: rootEl.querySelector('.pdf-viewer__stage'),
    inner: rootEl.querySelector('.pdf-viewer__inner'),
    canvas: rootEl.querySelector('.pdf-viewer__canvas'),
    toolbar: rootEl.querySelector('.pdf-viewer__toolbar'),
    pageCur: rootEl.querySelector('.pdf-viewer__page-current'),
    pageTot: rootEl.querySelector('.pdf-viewer__page-total'),
    zoomLabel: rootEl.querySelector('.pdf-viewer__zoom'),
    btn: act => rootEl.querySelector(`.pdf-btn[data-act="${act}"]`),
  };
}

/**
 * Mount a PDF viewer in `rootEl`. Returns an async cleanup function
 * suitable for `await cleanup()` calls.
 *
 * @param {HTMLElement} rootEl
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {object} [options]
 * @param {object} [options.labels] - i18n strings (see defaults below)
 * @returns {Promise<{ destroy: () => Promise<void> }>}
 */
export async function mountPdfViewer(rootEl, bytes, options = {}) {
  if (!rootEl) throw new Error('mountPdfViewer requires a root element');

  const labels = Object.assign({
    prev: 'Previous page',
    next: 'Next page',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit to width',
    fitShort: 'Fit',
    reset: 'Reset view',
    resetShort: '1:1',
    hint: 'Ctrl+Wheel: zoom, Drag: pan, Double-click: reset',
    loading: 'Loading PDF...',
    error: 'Failed to render PDF',
  }, options.labels || {});

  rootEl.innerHTML = `<div class="pdf-viewer__loading">${escAttr(labels.loading)}</div>`;

  let pdfjs;
  try {
    pdfjs = await loadPdfjs();
  } catch (err) {
    rootEl.innerHTML = `<div class="pdf-viewer__error">${escAttr(labels.error)}: ${escAttr(err && err.message || String(err))}</div>`;
    return { destroy: async () => {} };
  }

  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    rootEl.innerHTML = `<div class="pdf-viewer__error">${escAttr(labels.error)}: ${escAttr(err && err.message || String(err))}</div>`;
    return { destroy: async () => {} };
  }

  const ui = buildSkeleton(rootEl, labels);
  ui.pageTot.textContent = String(doc.numPages);

  const state = {
    pageIndex: 1,
    scale: 1,
    panX: 0,
    panY: 0,
    rendering: false,
    pendingPage: null,
    destroyed: false,
    devicePixelRatio: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
  };

  const ctx = ui.canvas.getContext('2d', { alpha: false });

  function applyTransform() {
    ui.inner.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
    ui.zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  }

  async function renderPage(num) {
    if (state.destroyed) return;
    if (state.rendering) {
      state.pendingPage = num;
      return;
    }
    state.rendering = true;
    try {
      const page = await doc.getPage(num);
      const stageRect = ui.stage.getBoundingClientRect();
      const targetWidth = Math.max(320, stageRect.width - 24);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale: fitScale * state.devicePixelRatio });

      ui.canvas.width = Math.floor(viewport.width);
      ui.canvas.height = Math.floor(viewport.height);
      ui.canvas.style.width = `${Math.floor(viewport.width / state.devicePixelRatio)}px`;
      ui.canvas.style.height = `${Math.floor(viewport.height / state.devicePixelRatio)}px`;

      await page.render({ canvasContext: ctx, viewport }).promise;
      ui.pageCur.textContent = String(num);
    } catch (err) {
      if (!state.destroyed) {
        console.warn('PDF render failed:', err);
      }
    } finally {
      state.rendering = false;
      if (state.pendingPage != null && !state.destroyed) {
        const next = state.pendingPage;
        state.pendingPage = null;
        renderPage(next);
      }
    }
  }

  function clampPage(n) {
    return Math.max(1, Math.min(doc.numPages, Math.round(Number(n) || 1)));
  }
  function setPage(n) {
    const target = clampPage(n);
    if (target === state.pageIndex) return;
    state.pageIndex = target;
    renderPage(target);
  }
  function setScale(next, focusX = null, focusY = null) {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    if (Math.abs(clamped - state.scale) < 1e-3) return;
    if (focusX != null && focusY != null) {
      state.panX = focusX - (focusX - state.panX) * (clamped / state.scale);
      state.panY = focusY - (focusY - state.panY) * (clamped / state.scale);
    }
    state.scale = clamped;
    applyTransform();
  }
  function fitToWidth() {
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    applyTransform();
    renderPage(state.pageIndex);
  }
  function resetView() {
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    applyTransform();
  }

  ui.btn('prev').addEventListener('click', () => setPage(state.pageIndex - 1));
  ui.btn('next').addEventListener('click', () => setPage(state.pageIndex + 1));
  ui.btn('zoom-in').addEventListener('click', () => setScale(state.scale * ZOOM_STEP));
  ui.btn('zoom-out').addEventListener('click', () => setScale(state.scale / ZOOM_STEP));
  ui.btn('fit').addEventListener('click', fitToWidth);
  ui.btn('reset').addEventListener('click', resetView);

  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = ui.stage.getBoundingClientRect();
    const fx = e.clientX - rect.left;
    const fy = e.clientY - rect.top;
    setScale(e.deltaY > 0 ? state.scale / ZOOM_STEP : state.scale * ZOOM_STEP, fx, fy);
  };
  ui.stage.addEventListener('wheel', onWheel, { passive: false });

  let dragging = false;
  let dragStart = null;
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
    ui.stage.classList.add('pdf-viewer__stage--dragging');
  };
  const onMouseMove = (e) => {
    if (!dragging || !dragStart) return;
    state.panX = dragStart.panX + (e.clientX - dragStart.x);
    state.panY = dragStart.panY + (e.clientY - dragStart.y);
    applyTransform();
  };
  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    dragStart = null;
    ui.stage.classList.remove('pdf-viewer__stage--dragging');
  };
  ui.stage.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  ui.stage.addEventListener('dblclick', resetView);

  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      renderPage(state.pageIndex);
    });
  };
  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(ui.stage);
  } else {
    window.addEventListener('resize', onResize);
  }

  applyTransform();
  await renderPage(1);

  // Centre the canvas horizontally inside the stage on first paint so the
  // page is not clinging to the left edge while still leaving room for pan.
  try {
    const stageRect = ui.stage.getBoundingClientRect();
    const canvasRect = ui.canvas.getBoundingClientRect();
    const slack = stageRect.width - canvasRect.width - 24;
    if (slack > 0) {
      state.panX = slack / 2;
      applyTransform();
    }
  } catch (_) {
    // bounding rects unavailable (test env etc.)
  }

  return {
    destroy: async () => {
      state.destroyed = true;
      try { ui.stage.removeEventListener('wheel', onWheel); } catch (_) { /* noop */ }
      try { ui.stage.removeEventListener('mousedown', onMouseDown); } catch (_) { /* noop */ }
      try { ui.stage.removeEventListener('dblclick', resetView); } catch (_) { /* noop */ }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch (_) { /* noop */ }
      }
      try {
        await doc.destroy();
      } catch (_) {
        // pdfjs already destroyed
      }
      if (rootEl.isConnected) {
        rootEl.innerHTML = '';
      }
    },
  };
}
