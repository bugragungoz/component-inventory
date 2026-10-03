// The order-page extractors against pages cut from the real shops (test-fixtures/orders/README.md).
// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { fromOrderPage, robocomboOrder } from '../src/orders';

const dir = path.resolve(__dirname, '../../test-fixtures/orders');
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8')) as Record<string, Array<{ name: string; code: string; qty: number; packSize: number }>>;
const load = (shop: string, url: string, edit = (s: string) => s) => {
  const dom = new JSDOM(edit(fs.readFileSync(path.join(dir, `${shop}-order-detail.html`), 'utf8')), { url, virtualConsole: new VirtualConsole() });
  return dom.window;
};
const pick = (items: Array<{ name: string; qty: number; packSize?: number }>) => items.map((i) => ({ name: i.name, qty: i.qty, packSize: i.packSize ?? 1 }));
const want = (shop: string) => expected[shop]!.map((i) => ({ name: i.name.trim(), qty: i.qty, packSize: i.packSize }));

describe('order pages from the real shops', () => {
  it('Özdisan: every line, exact counts, manufacturer codes, no pack multiplier', () => {
    const w = load('ozdisan', 'https://www.ozdisan.com/kontrol-paneli/siparis-durum-gecmisi/siparis-detay/x/ozet');
    const r = fromOrderPage('ozdisan', w.document, w.location)!;
    expect(r.skipped).toBe(0);
    expect(pick(r.items)).toEqual(want('ozdisan'));
    expect(r.items.map((i) => i.code)).toEqual(expected.ozdisan!.map((i) => i.code));
  });

  it('Motorobit: every line; "- 10 Adet" names are packs of 10', () => {
    const w = load('motorobit', 'https://www.motorobit.com/uye-siparisleri#/detail/1');
    const r = fromOrderPage('motorobit', w.document, w.location)!;
    expect(r.skipped).toBe(0);
    expect(pick(r.items)).toEqual(want('motorobit'));
    expect(r.items.reduce((a, i) => a + i.qty * (i.packSize ?? 1), 0)).toBe(635);
  });

  it("Robocombo: 30 lines, 114 pieces, \"8'li\" is not a pack, the stock code is not a part number", () => {
    const w = load('robocombo', 'https://www.robocombo.com/Hesabim.aspx#/Siparislerim');
    const r = fromOrderPage('robocombo', w.document, w.location)!;
    expect(r.skipped).toBe(0);
    expect(pick(r.items).map((i) => ({ ...i, name: i.name.trim() }))).toEqual(want('robocombo'));
    expect(r.items.reduce((a, i) => a + i.qty, 0)).toBe(114);
    expect(r.items.map((i) => i.code)).toEqual(expected.robocombo!.map((i) => i.code));
  });

  it('Robocombo: cancelled lines are left out and a count that disagrees with the prices is not read', () => {
    let n = 0;
    const w = load('robocombo', 'https://www.robocombo.com/Hesabim.aspx#/Siparislerim', (s) =>
      s.replace(/class="package-product-item siparisUrun/g, (m) => (n++ === 0 ? `${m} iptal` : m)));
    expect(robocomboOrder(w.document).items).toHaveLength(29);
    const w2 = load('robocombo', 'https://www.robocombo.com/Hesabim.aspx#/Siparislerim', (s) => s.replace('<strong class="ng-binding">1</strong></span>', '<strong class="ng-binding">7</strong></span>'));
    expect(robocomboOrder(w2.document).skipped).toBe(1);
  });

  it('other pages of the same shop are not order pages', () => {
    const w = load('robocombo', 'https://www.robocombo.com/sepet');
    expect(fromOrderPage('robocombo', w.document, w.location)).toBeNull();
  });
});
