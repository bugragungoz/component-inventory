/**
 * Where an import comes from: a file the owner picked or dropped, or a deep link the extension
 * opened. Each becomes a Draft for the review screen; nothing is written here.
 */
import { decodeDeepLink, parseCinvPayload } from '@cinv/core';
import { signal } from '@preact/signals';
import { api } from '../../api/commands';
import { guessColumnMap, type ColumnMap } from '../../domain/importCore';
import { t } from '../../i18n';
import { toast } from '../../state/toasts';
import { view } from '../../state/ui';
import { draftFromCinv, draftFromTable, enrich, type Draft } from './draft';
import { MAX_FILE_BYTES, pdfLines, rowsFromCsv, rowsFromPdfLines, rowsFromXlsx, shopFromLinks } from './parsers';

/** The draft waiting on the review screen (one at a time). */
export const pendingDraft = signal<Draft | null>(null);
export const importBusy = signal<string | null>(null);

export class ImportReadError extends Error {
  constructor(public readonly key: string, public readonly params: Record<string, string | number> = {}) {
    super(key);
  }
}

async function withLibrary(d: Draft): Promise<Draft> {
  const codes = d.rows.map((r) => r.part_code);
  const lib = await api.lookupLibrary(codes).catch(() => codes.map(() => null));
  return { ...d, rows: enrich(d.rows, lib) };
}

export async function draftFromMappedTable(d: Draft, map: ColumnMap): Promise<Draft> {
  if (!d.table) return d;
  const next = draftFromTable(d.table.raw, map, d.kind, d.label);
  return withLibrary({ ...next, site: d.site });
}

/** Reads a file into a draft. Throws ImportReadError with a message key the UI translates. */
export async function readFile(name: string, bytes: Uint8Array): Promise<Draft> {
  if (bytes.length > MAX_FILE_BYTES) throw new ImportReadError('import.errors.tooLarge', { mb: 30 });
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (name.toLowerCase().endsWith('.cinv.json') || ext === 'json') {
    const text = new TextDecoder().decode(bytes);
    const r = parseCinvPayload(text);
    if (!r.ok) throw new ImportReadError(`import.errors.cinv.${r.error}`);
    return withLibrary(draftFromCinv(r.payload, 'cinv', r.dropped));
  }
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    const raw = rowsFromCsv(bytes);
    if (!raw.length) throw new ImportReadError('import.errors.empty');
    return withLibrary(draftFromTable(raw, guessColumnMap(raw), 'csv', name));
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const { rows } = await rowsFromXlsx(bytes);
    if (!rows.length) throw new ImportReadError('import.errors.noHeaders');
    return withLibrary(draftFromTable(rows, guessColumnMap(rows), 'xlsx', name));
  }
  if (ext === 'pdf') {
    const { lines, hasText } = await pdfLines(bytes);
    if (!hasText) throw new ImportReadError('import.errors.pdfNoText');
    const { rows, links } = rowsFromPdfLines(lines);
    if (!rows.length) throw new ImportReadError('import.errors.pdfNoRows');
    const site = shopFromLinks(links) ?? undefined;
    const d = draftFromTable(rows, guessColumnMap(rows), 'pdf', name, site);
    return withLibrary({ ...d, site });
  }
  throw new ImportReadError('import.errors.unknownType', { ext: ext || '?' });
}

/**
 * Links from the extension that wait for the review screen. A link that arrives while another
 * review is open waits its turn instead of replacing it (the owner may be editing counts there).
 */
const waitingLinks: string[] = [];
/** The last link opened, so a repeat delivery of the same send is not reviewed twice. */
let lastOpened: { url: string; at: number } | null = null;
const REPEAT_MS = 15_000;

/** Deep links the shell queued (from the extension). Opens the review screen for the next one. */
export async function openDeepLinks(): Promise<void> {
  const taken = await api.takeDeepLinks().catch(() => [] as string[]);
  const now = Date.now();
  const fresh = taken.filter((u, i) => taken.indexOf(u) === i && !waitingLinks.includes(u)
    && !(lastOpened && lastOpened.url === u && now - lastOpened.at < REPEAT_MS));
  waitingLinks.push(...fresh);
  if (pendingDraft.value) {
    if (fresh.length) toast(t('import.linkQueued'), { tone: 'info' });
    return;
  }
  await openNextLink();
}

/**
 * Turns the next waiting link into a draft. Every failure is shown: a link that silently did
 * nothing looked to the owner as if the extension had not sent anything.
 */
async function openNextLink(): Promise<void> {
  while (waitingLinks.length && !pendingDraft.value) {
    const url = waitingLinks.shift()!;
    lastOpened = { url, at: Date.now() };
    try {
      const raw = await decodeDeepLink(url);
      const r = raw ? parseCinvPayload(raw) : null;
      if (!r?.ok) {
        toast(t('import.errors.link'), { tone: 'warn' });
        continue;
      }
      pendingDraft.value = await withLibrary(draftFromCinv(r.payload, 'link', r.dropped));
      view.value = 'import';
      toast(t('import.linkReceived', { count: r.payload.items.length, shop: pendingDraft.value.label }), { tone: 'info' });
    } catch (e) {
      toast(t('import.errors.linkFailed', { error: e instanceof Error ? e.message : String(e) }), { tone: 'warn' });
    }
  }
}

// When a review closes (imported or cancelled), the next waiting link opens.
pendingDraft.subscribe((d) => {
  if (!d && waitingLinks.length) queueMicrotask(() => void openNextLink());
});
