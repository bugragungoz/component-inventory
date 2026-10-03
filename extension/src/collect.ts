/** Reads the open page: a known order page first, then JSON-LD orders, the dataLayer, a JSON-LD product. */
import { buildPayload, detectShop, type CinvPayload } from '@cinv/core';
import { fromOrderPage } from './orders';
import { fromDataLayer, fromJsonLd } from './structured';

export function readDataLayer(timeout = 600): Promise<unknown[]> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window || !ev.data || ev.data.cinv !== 'datalayer' || ev.data.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      resolve(Array.isArray(ev.data.data) ? ev.data.data : []);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg);
      resolve([]);
    }, timeout);
    window.addEventListener('message', onMsg);
    window.postMessage({ cinv: 'request-datalayer', id }, window.location.origin);
  });
}

export function readJsonLd(doc: Document = document): unknown[] {
  const out: unknown[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      out.push(JSON.parse(el.textContent ?? ''));
    } catch {
      /* not JSON */
    }
  });
  return out;
}

export interface Collected {
  payload: CinvPayload;
  skipped: number;
}

export async function collect(doc: Document = document, loc: Location = location, dataLayer?: unknown[]): Promise<Collected | null> {
  const shop = detectShop(loc.hostname);
  const site = shop?.id ?? loc.hostname;
  const stock = shop?.skuIsStockCode ?? false;
  const order = shop ? fromOrderPage(shop.id, doc, loc) : null;
  const ld = fromJsonLd(readJsonLd(doc), site, stock);
  const dl = order || ld?.kind === 'order' ? null : fromDataLayer(dataLayer ?? (await readDataLayer()), site, stock);
  const hit = order ?? (ld?.kind === 'order' ? ld : null) ?? dl ?? ld;
  if (!hit) return null;
  return { payload: buildPayload({ site, kind: hit.kind, url: loc.href, items: hit.items, skipped: hit.skipped }), skipped: hit.skipped };
}
