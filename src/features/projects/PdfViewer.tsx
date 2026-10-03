/** A PDF schematic: page buttons, zoom buttons, Ctrl + wheel to zoom, scroll to pan. */
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'preact/hooks';
import { IconButton } from '../../components/IconButton';
import { Spinner } from '../../components/Misc';
import { formatNumber, t } from '../../i18n';
import { openPdf } from './pdfjs';

const MIN = 0.25;
const MAX = 6;

export function PdfViewer({ bytes }: { bytes: Uint8Array }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [shown, setShown] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let d: PDFDocumentProxy | null = null;
    let cancelled = false;
    openPdf(bytes.slice()).then((x) => { d = x; if (!cancelled) setDoc(x); else void x.destroy(); }, () => { if (!cancelled) setError(true); });
    return () => { cancelled = true; void d?.destroy(); };
  }, [bytes]);

  useEffect(() => {
    if (!doc || !canvas.current || !stage.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    void (async () => {
      const p = await doc.getPage(page);
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min((stage.current!.clientWidth - 24) / base.width, (stage.current!.clientHeight - 24) / base.height);
      const scale = zoom === 'fit' ? Math.max(MIN, fit) : zoom;
      setShown(scale);
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: scale * dpr });
      const c = canvas.current!;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = `${Math.floor(vp.width / dpr)}px`;
      c.style.height = `${Math.floor(vp.height / dpr)}px`;
      task = p.render({ canvas: c, viewport: vp });
      await task.promise.catch(() => {});
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, page, zoom]);

  const setScale = (s: number) => setZoom(Math.min(MAX, Math.max(MIN, s)));
  if (error) return <p class="muted">{t('schematic.pdfError')}</p>;
  if (!doc) return <Spinner label={t('common.loading')} />;
  return (
    <div class="viewer">
      <div class="viewer-bar" role="toolbar" aria-label={t('schematic.toolbar')}>
        <IconButton size="sm" icon="chevronLeft" label={t('schematic.prevPage')} onClick={() => setPage(page - 1)} disabled={page <= 1} />
        <span class="num">{t('schematic.page', { page, pages: doc.numPages })}</span>
        <IconButton size="sm" icon="chevronRight" label={t('schematic.nextPage')} onClick={() => setPage(page + 1)} disabled={page >= doc.numPages} />
        <span class="sep" aria-hidden="true" />
        <IconButton size="sm" icon="zoomOut" label={t('schematic.zoomOut')} onClick={() => setScale(shown / 1.2)} />
        <span class="num zoom-value">{formatNumber(shown, undefined, { style: 'percent' })}</span>
        <IconButton size="sm" icon="zoomIn" label={t('schematic.zoomIn')} onClick={() => setScale(shown * 1.2)} />
        <IconButton size="sm" icon="fit" label={t('schematic.fit')} onClick={() => setZoom('fit')} pressed={zoom === 'fit'} />
      </div>
      <div class="viewer-stage" ref={stage} tabIndex={0} aria-label={t('schematic.stage')}
        onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setScale(shown * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); } }}>
        <canvas ref={canvas} class="viewer-canvas" />
      </div>
    </div>
  );
}
