/**
 * Order-detail extractors for shops whose pages carry no structured data. Each reads what was
 * actually delivered, from markup checked against the fixtures in test-fixtures/orders (cut from
 * the live pages on 2026-10-03). Stable parts only (labels, structure, [class*=...]); a shop that
 * changes its markup returns nothing, and the generic extractors are tried next.
 * Pure functions of a Document.
 */
import { packFromName, type CinvItem } from '@cinv/core';

const clean = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Digits only, 1 to 999999. Anything else is "not read". */
export function strictInt(t: unknown): number | null {
  const s = clean(t);
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n > 0 ? n : null;
}

export interface OrderResult {
  items: CinvItem[];
  skipped: number;
}

/** Özdisan: the body table (the header table is separate); code in "Ürün Kodu:<code>Müşteri Numarası". Sold per piece. */
export function ozdisanOrder(doc: Document): OrderResult {
  const rows = doc.querySelectorAll('table[class*="body-table"] tr, table[class*="DashboardOrderScrollTable"]:not([class*="header-table"]) tr');
  const items: CinvItem[] = [];
  let skipped = 0;
  for (const tr of rows) {
    const cells = tr.children;
    if (cells.length < 3) continue;
    const m = /Ürün Kodu:\s*(.+?)\s*Müşteri Numarası/i.exec(clean(cells[0]!.textContent));
    const code = clean(m ? m[1] : cells[0]!.querySelector('img[alt]')?.getAttribute('alt'));
    const name = clean(cells[1]!.textContent);
    const qty = strictInt((cells[2]!.querySelector('[class*="Quantity"]') ?? cells[2]!).textContent);
    if (!code && !name) continue;
    if (qty === null) {
      skipped++;
      continue;
    }
    items.push({ name: name || code, code: code || undefined, qty });
  }
  return { items, skipped };
}

/** Motorobit: one card per product (the parent of a.size-16) with an "N Adet" line. "- 10 Adet" names are packs of 10. */
export function motorobitOrder(doc: Document): OrderResult {
  const items: CinvItem[] = [];
  let skipped = 0;
  for (const img of doc.querySelectorAll('a.size-16')) {
    const card = img.parentElement;
    if (!card) continue;
    const name = clean(card.querySelector('a.line-clamp-2')?.textContent ?? img.querySelector('img')?.getAttribute('alt'));
    if (!name) continue;
    const qtyEl = [...card.querySelectorAll('div.text-gray-500')].find((d) => d.children.length === 0 && /^\s*\d+\s*adet\s*$/i.test(d.textContent ?? ''));
    const qty = qtyEl ? strictInt((qtyEl.textContent ?? '').replace(/adet/i, '')) : null;
    if (qty === null) {
      skipped++;
      continue;
    }
    items.push({ name, qty, packSize: packFromName('motorobit', name)?.size });
  }
  return { items, skipped };
}

/**
 * Robocombo (Ticimax): .package-product-item.siparisUrun per line; the name is .solDetay > a and the
 * strong inside it is the shop's stock code (not a part number); the count is the first
 * .sagDetay .hsbmSpan strong, whose label is empty, "Adet" or "ADET". Lines with class "iptal" were
 * cancelled. "8'li", "16'lı" are part properties, not packs. Count x unit price = line total is
 * checked: a line where it does not hold is reported as not read.
 */
export function robocomboOrder(doc: Document): OrderResult {
  const items: CinvItem[] = [];
  let skipped = 0;
  for (const el of doc.querySelectorAll('.package-product-item.siparisUrun')) {
    if (el.classList.contains('iptal')) continue;
    const link = el.querySelector('.solDetay > a');
    if (!link) continue;
    const stock = clean(link.querySelector('strong')?.textContent);
    const name = clean([...link.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
    if (!name) continue;
    const spans = [...el.querySelectorAll('.sagDetay .hsbmSpan')];
    const first = spans[0];
    const label = clean(first?.querySelector('span')?.textContent);
    const qty = first && /^(|adet)$/i.test(label) ? strictInt(first.querySelector('strong')?.textContent) : null;
    const money = (s: Element | undefined) => {
      const v = clean(s?.querySelector('strong')?.textContent).replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
      return v ? Number(v) : NaN;
    };
    const unit = money(spans.find((s) => /birim fiyat/i.test(s.textContent ?? '')));
    const total = money(spans.find((s) => /toplam fiyat/i.test(s.textContent ?? '')));
    const consistent = !Number.isFinite(unit) || !Number.isFinite(total) || (qty !== null && Math.abs(qty * unit - total) < 0.02 + total * 0.001);
    if (qty === null || !consistent) {
      skipped++;
      continue;
    }
    items.push({ name, code: stock || undefined, qty });
  }
  return { items, skipped };
}

interface Profile {
  match: (loc: Location | URL) => boolean;
  extract: (doc: Document) => OrderResult;
}

export const ORDER_PAGES: Record<string, Profile> = {
  ozdisan: { match: (l) => /\/siparis-detay\//.test(l.pathname), extract: ozdisanOrder },
  motorobit: { match: (l) => l.pathname.startsWith('/uye-siparisleri') && /detail/.test(l.hash), extract: motorobitOrder },
  robocombo: { match: (l) => /hesabim/i.test(l.pathname) && /siparis/i.test(l.hash), extract: robocomboOrder },
};

export function fromOrderPage(site: string, doc: Document, loc: Location | URL): (OrderResult & { kind: 'order' }) | null {
  const p = ORDER_PAGES[site];
  if (!p || !p.match(loc)) return null;
  const r = p.extract(doc);
  return r.items.length ? { ...r, kind: 'order' } : null;
}
