/**
 * The project's schematic: a PDF, an image, or a KiCad schematic drawn with each part marked by
 * whether there is enough stock for this project (a word in the legend and the tooltip, never
 * color alone).
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { BomRow, Project } from '../../api/types';
import { Button } from '../../components/Button';
import { EmptyState, Spinner } from '../../components/Misc';
import { IconButton } from '../../components/IconButton';
import { buildOverlayModel, normalizePartKey, type OverlayModel, type PlacementStatus } from '../../domain/kicad';
import { t } from '../../i18n';
import { components } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { errorMessage } from '../inventory/labels';
import { PdfViewer } from './PdfViewer';
import { upsertProject } from './state';

type Loaded =
  | { kind: 'pdf'; bytes: Uint8Array }
  | { kind: 'image'; url: string }
  | { kind: 'kicad'; text: string }
  | { kind: 'text'; text: string };

const IMAGE: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' };

export function classifySchematic(path: string, bytes: Uint8Array): Loaded {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf' || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return { kind: 'pdf', bytes };
  if (IMAGE[ext]) return { kind: 'image', url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: IMAGE[ext] })) };
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (text.trimStart().startsWith('(kicad_sch')) return { kind: 'kicad', text };
  return { kind: 'text', text: text.slice(0, 50_000) };
}

const STATUS_ORDER: PlacementStatus[] = ['ok', 'short', 'extra', 'unknown'];

function KicadView({ model }: { model: OverlayModel }) {
  const [view, setView] = useState({ x: 0, y: 0, w: model.width, h: model.height });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pad = 30;
  const reset = () => setView({ x: 0, y: 0, w: model.width, h: model.height });
  const zoom = (factor: number, cx = 0.5, cy = 0.5) =>
    setView((v) => {
      const w = Math.min(model.width * 4, Math.max(40, v.w / factor));
      const h = (w / v.w) * v.h;
      return { x: v.x + (v.w - w) * cx, y: v.y + (v.h - h) * cy, w, h };
    });
  return (
    <div class="viewer">
      <div class="viewer-bar" role="toolbar" aria-label={t('schematic.toolbar')}>
        <IconButton size="sm" icon="zoomOut" label={t('schematic.zoomOut')} onClick={() => zoom(1 / 1.25)} />
        <IconButton size="sm" icon="zoomIn" label={t('schematic.zoomIn')} onClick={() => zoom(1.25)} />
        <IconButton size="sm" icon="fit" label={t('schematic.fit')} onClick={reset} />
        <span class="sep" aria-hidden="true" />
        <ul class="legend">
          {STATUS_ORDER.map((s) => (
            <li key={s}><span class={`legend-dot sch-${s}`} aria-hidden="true" />{t(`schematic.status.${s}`)}</li>
          ))}
        </ul>
      </div>
      <div class="viewer-stage kicad-stage">
        <svg
          ref={svg}
          class="kicad"
          viewBox={`${view.x - pad} ${view.y - pad} ${view.w + pad * 2} ${view.h + pad * 2}`}
          role="img"
          aria-label={t('schematic.kicadAlt', { count: model.markers.length })}
          onWheel={(e) => {
            e.preventDefault();
            const r = svg.current!.getBoundingClientRect();
            zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
          }}
          onPointerDown={(e) => {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const r = svg.current!.getBoundingClientRect();
            const k = (view.w + pad * 2) / r.width;
            setView((v) => ({ ...v, x: d.vx - (e.clientX - d.x) * k, y: d.vy - (e.clientY - d.y) * k }));
          }}
          onPointerUp={() => { drag.current = null; }}
          onDblClick={reset}
        >
          <g class="sch-wires">{model.wires.map((w, i) => <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} />)}</g>
          <g class="sch-symbols">{model.symbols.map((w, i) => <line key={`s${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} />)}</g>
          <g class="sch-markers">
            {model.markers.map((m) => (
              <g key={`${m.reference}-${m.x}-${m.y}`} class={`sch-marker sch-${m.status}`}>
                <title>{`${m.reference} ${m.value}: ${t(`schematic.status.${m.status}`)}`}</title>
                <circle cx={m.x} cy={m.y} r={model.dotR} />
                <text x={m.x + model.dotR + 2} y={m.y - model.dotR} font-size={model.refSize}>{m.reference}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <p class="muted viewer-hint">{t('schematic.kicadHint')}</p>
    </div>
  );
}

export function Schematic({ project, bom, onImportBom }: { project: Project; bom: BomRow[]; onImportBom: (text: string) => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoaded(null);
    setError(null);
    if (!project.schematic_path) return;
    let cancelled = false;
    let url: string | null = null;
    api.readSchematic(project.id).then(
      (bytes) => {
        if (cancelled) return;
        const l = classifySchematic(project.schematic_path, bytes);
        if (l.kind === 'image') url = l.url;
        setLoaded(l);
      },
      (e) => { if (!cancelled) setError(errorMessage(e)); },
    );
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [project.id, project.schematic_path]);

  const model = useMemo(() => {
    if (loaded?.kind !== 'kicad') return null;
    const byKey = new Map<string, { required: number; stock: number }>();
    for (const r of bom) byKey.set(normalizePartKey(r.part_code), { required: r.required_qty, stock: r.stock });
    const inv = new Set(components.value.map((c) => normalizePartKey(c.part_code)));
    return buildOverlayModel(loaded.text, byKey, inv);
  }, [loaded, bom, components.value]);

  const pick = async () => {
    setBusy(true);
    try {
      const p = await api.pickSchematic(project.id);
      if (p) upsertProject({ ...project, ...p });
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      upsertProject(await api.updateProject({ id: project.id, schematic_path: '' }));
    } catch (e) {
      toast(errorMessage(e), { tone: 'warn' });
    }
  };

  if (!project.schematic_path) {
    return (
      <EmptyState icon="schematic" title={t('schematic.emptyTitle')} actions={<Button icon="folder" onClick={() => void pick()} disabled={busy}>{t('schematic.pick')}</Button>}>
        {t('schematic.emptyBody')}
      </EmptyState>
    );
  }
  return (
    <div class="schematic">
      <div class="schematic-head">
        <span class="mono truncate muted" title={project.schematic_path}>{project.schematic_path.split(/[\\/]/).pop()}</span>
        <span class="grow" />
        {loaded?.kind === 'kicad' ? <Button size="sm" icon="import" onClick={() => onImportBom(loaded.text)}>{t('schematic.importBom')}</Button> : null}
        <Button size="sm" variant="quiet" icon="folder" onClick={() => void pick()} disabled={busy}>{t('schematic.change')}</Button>
        <Button size="sm" variant="quiet" onClick={() => void remove()}>{t('schematic.remove')}</Button>
      </div>
      {error ? <p class="muted">{t('schematic.readError', { error })}</p> : !loaded ? <Spinner label={t('common.loading')} /> : null}
      {loaded?.kind === 'pdf' ? <PdfViewer bytes={loaded.bytes} /> : null}
      {loaded?.kind === 'image' ? <div class="viewer-stage"><img class="schematic-image" src={loaded.url} alt={t('schematic.imageAlt', { name: project.name })} /></div> : null}
      {loaded?.kind === 'kicad' ? (model ? <KicadView model={model} /> : <p class="muted">{t('schematic.kicadEmpty')}</p>) : null}
      {loaded?.kind === 'text' ? <pre class="schematic-text">{loaded.text}</pre> : null}
    </div>
  );
}
