/**
 * The cinv interchange format (see ../README.md). Shared by the app and the browser extension; no
 * DOM or Tauri imports, so it runs in a content script, the app and Node tests alike.
 */

export const CINV_FORMAT = 'cinv';
export const CINV_VERSION = 1;
export const CINV_SCHEME = 'component-inventory:';
export const MAX_ITEMS = 2000;
export const MAX_QTY = 999_999;
/** Windows silently drops protocol links over about 2000 characters. */
export const DEEP_LINK_MAX_CHARS = 1800;

export type SourceKind = 'order' | 'cart' | 'product';

export interface CinvItem {
  name: string;
  code?: string | undefined;
  qty: number;
  packSize?: number | undefined;
  category?: string | undefined;
  url?: string | undefined;
  /** Why the item looks the way it does, for the review screen ("10 units of a 10-piece pack"). */
  note?: string | undefined;
}

export interface CinvPayload {
  format: typeof CINV_FORMAT;
  version: number;
  source: { site: string; kind: SourceKind; url?: string | undefined };
  items: CinvItem[];
  /** Lines the extractor saw but could not read (no quantity): reported, never guessed. */
  skipped?: number | undefined;
}

export interface CleanItem {
  name: string;
  code: string;
  qty: number;
  packSize: number;
  category: string;
  url: string;
  note: string;
}

export interface CleanPayload {
  format: typeof CINV_FORMAT;
  version: number;
  source: { site: string; kind: SourceKind; url: string };
  items: CleanItem[];
  skipped: number;
}

export type ParseError = 'invalid-json' | 'not-cinv' | 'unsupported-version' | 'no-items' | 'no-valid-items';

export type ParseResult =
  | { ok: true; payload: CleanPayload; dropped: number }
  | { ok: false; error: ParseError; dropped: number };

function cleanText(v: unknown, max = 300): string {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Whole numbers only: 3 or "3". 2.5, "1.000", "3 adet" are not counts here. */
function toCount(v: unknown): number {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  const s = String(v ?? '').trim();
  return /^\d{1,7}$/.test(s) ? parseInt(s, 10) : NaN;
}

function httpUrl(v: unknown): string {
  const s = String(v ?? '');
  return /^https?:\/\//i.test(s) ? s.slice(0, 500) : '';
}

/** Validates and cleans an untrusted payload (a file, a deep link, a message). */
export function parseCinvPayload(input: unknown): ParseResult {
  let data: unknown = input;
  if (typeof input === 'string') {
    if (input.length > 5_000_000) return { ok: false, error: 'invalid-json', dropped: 0 };
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, error: 'invalid-json', dropped: 0 };
    }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'not-cinv', dropped: 0 };
  const d = data as Record<string, unknown>;
  if (d.format !== CINV_FORMAT) return { ok: false, error: 'not-cinv', dropped: 0 };
  if (!Number.isInteger(d.version) || (d.version as number) < 1 || (d.version as number) > CINV_VERSION) {
    return { ok: false, error: 'unsupported-version', dropped: 0 };
  }
  if (!Array.isArray(d.items)) return { ok: false, error: 'no-items', dropped: 0 };

  const items: CleanItem[] = [];
  let dropped = 0;
  for (const raw of d.items.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== 'object') {
      dropped++;
      continue;
    }
    const r = raw as Record<string, unknown>;
    const name = cleanText(r.name);
    const code = cleanText(r.code, 64);
    const qty = toCount(r.qty);
    const packSize = r.packSize == null ? 1 : toCount(r.packSize);
    if ((!name && !code) || !(qty > 0) || !(packSize > 0) || qty * packSize > MAX_QTY) {
      dropped++;
      continue;
    }
    items.push({ name, code, qty, packSize, category: cleanText(r.category, 60), url: httpUrl(r.url), note: cleanText(r.note, 200) });
  }
  dropped += Math.max(0, d.items.length - MAX_ITEMS);
  const src = d.source && typeof d.source === 'object' ? (d.source as Record<string, unknown>) : {};
  const kind: SourceKind = src.kind === 'order' || src.kind === 'product' ? src.kind : 'cart';
  const skipped = toCount(d.skipped);
  if (items.length === 0) return { ok: false, error: 'no-valid-items', dropped };
  return {
    ok: true,
    dropped,
    payload: {
      format: CINV_FORMAT,
      version: CINV_VERSION,
      source: { site: cleanText(src.site, 40), kind, url: httpUrl(src.url) },
      items,
      skipped: Number.isFinite(skipped) ? skipped : 0,
    },
  };
}

export function buildPayload(p: { site: string; kind: SourceKind; url: string; items: CinvItem[]; skipped?: number }): CinvPayload {
  return {
    format: CINV_FORMAT,
    version: CINV_VERSION,
    source: { site: p.site, kind: p.kind, url: p.url },
    items: p.items.map((i) => ({
      name: i.name,
      code: i.code || undefined,
      qty: i.qty,
      packSize: i.packSize && i.packSize > 1 ? i.packSize : undefined,
      category: i.category || undefined,
      note: i.note || undefined,
    })),
    skipped: p.skipped || undefined,
  };
}

// ---- Deep links ----

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = 5_000_000): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as Uint8Array<ArrayBuffer>);
  void writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) throw new Error('payload too large');
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export function encodeDeepLinkPlain(payload: CinvPayload): string {
  return `${CINV_SCHEME}//import?d=${bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)))}`;
}

/** The shorter of the plain (`d`) and deflated (`z`) forms. */
export async function encodeDeepLink(payload: CinvPayload): Promise<string> {
  const plain = encodeDeepLinkPlain(payload);
  try {
    const z = await pipe(new TextEncoder().encode(JSON.stringify(payload)), new CompressionStream('deflate-raw'));
    const compact = `${CINV_SCHEME}//import?z=${bytesToB64url(z)}`;
    return compact.length < plain.length ? compact : plain;
  } catch {
    return plain;
  }
}

/** Decodes either form. Returns the raw object (validate it with parseCinvPayload) or null. */
export async function decodeDeepLink(url: string): Promise<unknown> {
  try {
    if (url.length > 64 * 1024) return null;
    const u = new URL(url);
    if (u.protocol !== CINV_SCHEME || u.hostname !== 'import') return null;
    const z = u.searchParams.get('z');
    const d = u.searchParams.get('d');
    let bytes: Uint8Array;
    if (z) bytes = await pipe(b64urlToBytes(z), new DecompressionStream('deflate-raw'));
    else if (d) bytes = b64urlToBytes(d);
    else return null;
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export * from './shops';
