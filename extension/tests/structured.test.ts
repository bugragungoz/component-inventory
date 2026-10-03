import { parseCinvPayload, buildPayload } from '@cinv/core';
import { describe, expect, it } from 'vitest';
import { fromDataLayer, fromJsonLd, wholeCount } from '../src/structured';

describe('dataLayer', () => {
  it('reads GA4 view_cart items and drops shop stock codes', () => {
    const dl = [{ event: 'page_view' }, { event: 'view_cart', ecommerce: { items: [
      { item_id: '48213', item_name: 'LM7805 Regülatör TO-220', quantity: 3 },
      { item_id: 'NE555P', item_name: 'NE555 Timer', quantity: '2' },
    ] } }];
    const r = fromDataLayer(dl, 'direncnet', false)!;
    expect(r.kind).toBe('cart');
    expect(r.items[0]).toMatchObject({ code: undefined, qty: 3 });
    expect(r.items[1]).toMatchObject({ code: 'NE555P', qty: 2 });
    expect(fromDataLayer(dl, 'robotistan', true)!.items[1]!.code).toBeUndefined();
  });

  it('prefers purchase, reads gtag argument arrays, ignores view-only events', () => {
    expect(fromDataLayer([['event', 'add_to_cart', { items: [{ item_name: 'A', quantity: 1 }] }], ['event', 'purchase', { items: [{ item_name: 'B', quantity: 4 }] }]], 'x', false)).toMatchObject({ kind: 'order', items: [{ name: 'B', qty: 4 }] });
    expect(fromDataLayer([{ event: 'view_item', ecommerce: { items: [{ item_name: 'A', quantity: 1 }] } }], 'x', false)).toBeNull();
  });

  it('never guesses a count', () => {
    const r = fromDataLayer([{ event: 'view_cart', ecommerce: { items: [{ item_name: 'A', quantity: 2.5 }, { item_name: 'B', quantity: 'iki' }, { item_name: 'C', quantity: 1 }] } }], 'x', false)!;
    expect(r.items.map((i) => i.name)).toEqual(['C']);
    expect(r.skipped).toBe(2);
    expect(wholeCount('1.000')).toBeNull();
  });

  it("applies only the shop's own pack rule", () => {
    const items = [{ item_name: "10K Direnç 1/4W 10'lu Paket", quantity: 2 }, { item_name: '91K 603 SMD Direnç - 10 Adet', quantity: 3 }];
    expect(fromDataLayer([{ event: 'view_cart', ecommerce: { items } }], 'robotistan', true)!.items.map((i) => i.packSize)).toEqual([undefined, undefined]);
    expect(fromDataLayer([{ event: 'view_cart', ecommerce: { items } }], 'motorobit', true)!.items.map((i) => i.packSize)).toEqual([undefined, 10]);
  });
});

describe('JSON-LD', () => {
  it('reads a Product inside @graph and an Order with quantities', () => {
    expect(fromJsonLd([{ '@graph': [{ '@type': 'Product', name: 'ATmega328P-PU', mpn: 'ATMEGA328P-PU' }] }], 'x', false)).toMatchObject({ kind: 'product', items: [{ code: 'ATMEGA328P-PU', qty: 1 }] });
    const r = fromJsonLd([{ '@type': 'Order', orderedItem: [{ '@type': 'OrderItem', orderQuantity: 5, orderedItem: { '@type': 'Product', name: '1N4007 Diyot' } }] }], 'x', false)!;
    expect(r).toMatchObject({ kind: 'order', items: [{ qty: 5 }] });
  });

  it('builds a payload the app accepts', () => {
    const r = fromJsonLd([{ '@type': 'Product', name: 'NE555', sku: '123' }], 'robotistan', true)!;
    const parsed = parseCinvPayload(JSON.stringify(buildPayload({ site: 'robotistan', kind: r.kind, url: 'https://www.robotistan.com/ne555', items: r.items })));
    expect(parsed.ok).toBe(true);
  });
});
