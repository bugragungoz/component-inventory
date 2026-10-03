/**
 * Shop-independent extraction from the two structured signals most shop platforms expose: GA4/UA
 * dataLayer ecommerce events and schema.org JSON-LD. Pure functions, no DOM.
 */
import { packFromName, type CinvItem } from '@cinv/core';
import { looksLikeManufacturerMpn } from '../../src/domain/importFixup';

/** Events that only describe what is being viewed; shops push them with quantity 1. */
const VIEW_ONLY_EVENTS = ['view_item', 'view_item_list', 'select_item', 'view_promotion', 'select_promotion', 'productDetail', 'detail'];
const EVENT_PRIORITY = ['purchase', 'view_cart', 'begin_checkout', 'checkout', 'add_payment_info', 'add_to_cart'];

type Obj = Record<string, unknown>;

function text(v: unknown, max = 300): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** A count is a whole number of at least 1; anything else is "not read" (null), never guessed. */
export function wholeCount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null;
  const s = text(v).replace(/\s/g, '');
  return /^\d{1,6}$/.test(s) && Number(s) > 0 ? Number(s) : null;
}

/** An explicit mpn is trusted; a sku or item id only when the shop's sku is a manufacturer code. */
export function pickCode(mpn: unknown, others: unknown[], skuIsStockCode: boolean): string {
  const m = text(mpn, 64);
  if (m) return m;
  if (skuIsStockCode) return '';
  for (const c of others) {
    const s = text(c, 64);
    if (s && looksLikeManufacturerMpn(s)) return s;
  }
  return '';
}

export interface Extracted {
  kind: 'order' | 'cart' | 'product';
  items: CinvItem[];
  skipped: number;
}

function eventName(entry: unknown): string {
  if (Array.isArray(entry)) return entry[0] === 'event' ? text(entry[1], 40) : '';
  return text((entry as Obj | null)?.event, 40);
}

function products(entry: unknown): Obj[] | null {
  const params = (Array.isArray(entry) ? entry[2] : entry) as Obj | null;
  if (!params || typeof params !== 'object') return null;
  const ec = ((params.ecommerce as Obj | undefined) ?? params) as Obj;
  if (Array.isArray(ec.items)) return ec.items as Obj[];
  for (const k of ['purchase', 'checkout', 'cart', 'add']) {
    const v = ec[k] as Obj | undefined;
    if (v && Array.isArray(v.products)) return v.products as Obj[];
  }
  return Array.isArray(ec.products) ? (ec.products as Obj[]) : null;
}

/** The most order-like ecommerce event in a dataLayer snapshot. */
export function fromDataLayer(dataLayer: unknown, site: string, skuIsStockCode: boolean): Extracted | null {
  if (!Array.isArray(dataLayer)) return null;
  let best: { event: string; list: Obj[] } | null = null;
  let bestRank = Infinity;
  for (const entry of dataLayer) {
    const list = products(entry);
    if (!list?.length) continue;
    const ev = eventName(entry);
    if (VIEW_ONLY_EVENTS.includes(ev)) continue;
    const i = EVENT_PRIORITY.indexOf(ev);
    const rank = i === -1 ? EVENT_PRIORITY.length : i;
    if (rank <= bestRank) {
      best = { event: ev, list };
      bestRank = rank;
    }
  }
  if (!best) return null;
  let skipped = 0;
  const items: CinvItem[] = [];
  for (const p of best.list) {
    const name = text(p.item_name ?? p.name ?? p.title);
    const code = pickCode(p.mpn, [p.item_id, p.id, p.sku], skuIsStockCode);
    const qty = wholeCount(p.quantity ?? p.qty);
    if (!name && !code) continue;
    if (qty === null) {
      skipped++;
      continue;
    }
    items.push({ name: name || code, code: code || undefined, qty, packSize: packFromName(site, name)?.size });
  }
  return items.length ? { kind: best.event === 'purchase' ? 'order' : 'cart', items, skipped } : null;
}

function flatten(node: unknown, out: Obj[] = []): Obj[] {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, out));
  else if (node && typeof node === 'object') {
    out.push(node as Obj);
    if ((node as Obj)['@graph']) flatten((node as Obj)['@graph'], out);
  }
  return out;
}

const types = (n: Obj) => ([] as unknown[]).concat(n['@type']).map((x) => String(x ?? '').toLowerCase());

/** schema.org Order (with quantities) or a single Product (quantity typed by the owner). */
export function fromJsonLd(objects: unknown[], site: string, skuIsStockCode: boolean): Extracted | null {
  const nodes = flatten(objects);
  const items: CinvItem[] = [];
  let skipped = 0;
  for (const n of nodes) {
    if (!types(n).includes('order')) continue;
    for (const oi of ([] as Obj[]).concat((n.orderedItem as Obj[] | Obj | undefined) ?? [])) {
      const prod = ((oi.orderedItem as Obj | undefined) ?? oi) as Obj;
      const name = text(prod.name);
      const qty = wholeCount(oi.orderQuantity);
      if (qty === null) {
        skipped++;
        continue;
      }
      items.push({ name, code: pickCode(prod.mpn, [prod.sku], skuIsStockCode) || undefined, qty, packSize: packFromName(site, name)?.size });
    }
  }
  if (items.length) return { kind: 'order', items, skipped };
  const product = nodes.find((n) => types(n).includes('product'));
  if (!product) return null;
  const name = text(product.name);
  return { kind: 'product', items: [{ name, code: pickCode(product.mpn, [product.sku], skuIsStockCode) || undefined, qty: 1, packSize: packFromName(site, name)?.size }], skipped: 0 };
}
