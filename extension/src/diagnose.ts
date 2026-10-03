/**
 * The "Diagnose" report: page structure only, for writing a selector for a shop that changed its
 * markup. No cookies, no form values, no page text apart from product names and counts.
 */
import { detectShop } from '@cinv/core';
import { collect, readDataLayer, readJsonLd } from './collect';

const trunc = (v: unknown, n = 60) => String(v ?? '').slice(0, n);

function chain(el: Element | null): string[] {
  const out: string[] = [];
  for (let e = el, i = 0; e && i < 6; e = e.parentElement, i++) {
    const cls = typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    out.push(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${cls}`);
  }
  return out;
}

export async function diagnose(): Promise<object> {
  const dl = await readDataLayer();
  const events = dl
    .map((e) => {
      const arr = Array.isArray(e);
      const params = (arr ? (e as unknown[])[2] : e) as Record<string, unknown> | null;
      const ec = ((params?.ecommerce as Record<string, unknown> | undefined) ?? params ?? {}) as Record<string, unknown>;
      const items = Array.isArray(ec.items) ? (ec.items as Array<Record<string, unknown>>) : [];
      return {
        event: arr ? trunc((e as unknown[])[1], 40) : trunc((e as Record<string, unknown> | null)?.event, 40),
        itemCount: items.length,
        itemKeys: items[0] ? Object.keys(items[0]).slice(0, 20) : [],
        items: items.slice(0, 20).map((i) => ({ name: trunc(i.item_name ?? i.name), qty: i.quantity ?? i.qty })),
      };
    })
    .filter((e) => e.event || e.itemCount);
  const ldTypes = new Set<string>();
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>;
      if (o['@type']) ldTypes.add(String(o['@type']));
      if (o['@graph']) walk(o['@graph']);
    }
  };
  readJsonLd().forEach(walk);
  const qtyInputs = [...document.querySelectorAll('input')]
    .filter((i) => i.type === 'number' || /qty|adet|quantity|miktar|count/i.test(`${i.name} ${i.id} ${i.className}`))
    .slice(0, 12)
    .map((i) => ({ type: i.type, name: i.name, id: i.id, class: trunc(i.className, 80), value: i.value, ancestors: chain(i.parentElement) }));
  const classCount: Record<string, number> = {};
  document.querySelectorAll('[class]').forEach((el) => {
    if (typeof el.className !== 'string') return;
    for (const c of el.className.split(/\s+/)) if (/(^|[-_:])(cart|basket|sepet|order|siparis|product|urun|qty|adet)/i.test(c)) classCount[c] = (classCount[c] ?? 0) + 1;
  });
  const found = await collect();
  return {
    tool: 'component-inventory-extension diagnostic v2',
    page: location.origin + location.pathname,
    hash: trunc(location.hash, 40),
    site: detectShop(location.hostname)?.id ?? null,
    detected: found ? { kind: found.payload.source.kind, skipped: found.skipped, items: found.payload.items.map((i) => ({ name: trunc(i.name), code: i.code, qty: i.qty, packSize: i.packSize })) } : null,
    jsonLdTypes: [...ldTypes],
    dataLayerEvents: events,
    qtyInputs,
    candidateClasses: Object.entries(classCount).sort((a, b) => b[1] - a[1]).slice(0, 25),
  };
}
