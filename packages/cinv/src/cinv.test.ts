import { describe, expect, it } from 'vitest';
import { buildPayload, decodeDeepLink, encodeDeepLink, encodeDeepLinkPlain, parseCinvPayload, DEEP_LINK_MAX_CHARS } from './index';

const sample = buildPayload({
  site: 'motorobit',
  kind: 'order',
  url: 'https://www.motorobit.com/uye-siparisleri#/detail/1',
  items: Array.from({ length: 30 }, (_, i) => ({ name: `91K 603 SMD Direnç - 10 Adet ${i}`, qty: 10, packSize: 10 })),
});

describe('parseCinvPayload', () => {
  it('accepts a clean payload', () => {
    const r = parseCinvPayload(sample);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.items).toHaveLength(30);
      expect(r.payload.items[0]).toMatchObject({ qty: 10, packSize: 10 });
    }
  });
  it('rejects what is not cinv', () => {
    expect(parseCinvPayload('nope')).toMatchObject({ ok: false, error: 'invalid-json' });
    expect(parseCinvPayload({ format: 'x' })).toMatchObject({ ok: false, error: 'not-cinv' });
    expect(parseCinvPayload({ format: 'cinv', version: 9, items: [] })).toMatchObject({ ok: false, error: 'unsupported-version' });
  });
  it('drops lines it cannot trust instead of guessing', () => {
    const r = parseCinvPayload({
      format: 'cinv',
      version: 1,
      source: { site: 's', kind: 'weird' },
      items: [{ name: 'ok', qty: 2 }, { name: 'frac', qty: 2.5 }, { name: 'thousand', qty: '1.000' }, { qty: 3 }, { name: 'neg', qty: -1 }, { name: 'big', qty: 1000, packSize: 1000 }],
    });
    expect(r.ok && r.payload.items.map((i) => i.name)).toEqual(['ok']);
    expect(r.dropped).toBe(5);
    expect(r.ok && r.payload.source.kind).toBe('cart');
  });
  it('strips control characters and caps text', () => {
    const r = parseCinvPayload({ format: 'cinv', version: 1, items: [{ name: 'a\u0000b' + 'x'.repeat(400), code: 'LM358', qty: 1, url: 'javascript:alert(1)' }] });
    expect(r.ok && r.payload.items[0]!.name.length).toBe(300);
    expect(r.ok && r.payload.items[0]!.name.startsWith('a b')).toBe(true);
    expect(r.ok && r.payload.items[0]!.url).toBe('');
  });
});

describe('deep links', () => {
  it('a 30-line order stays under the Windows limit and round-trips', async () => {
    const link = await encodeDeepLink(sample);
    expect(link.length).toBeLessThan(DEEP_LINK_MAX_CHARS);
    expect(link.length).toBeLessThan(encodeDeepLinkPlain(sample).length);
    const back = parseCinvPayload(await decodeDeepLink(link));
    expect(back.ok && back.payload.items).toHaveLength(30);
  });
  it('reads the plain form and refuses other links', async () => {
    expect(parseCinvPayload(await decodeDeepLink(encodeDeepLinkPlain(sample))).ok).toBe(true);
    expect(await decodeDeepLink('https://example.com/import?d=xx')).toBeNull();
    expect(await decodeDeepLink('component-inventory://other?d=xx')).toBeNull();
    expect(await decodeDeepLink('component-inventory://import?z=!!!')).toBeNull();
  });
});
