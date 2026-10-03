# cinv

The format the browser extension (and any other importer) hands to Component Inventory. Only what the
inventory needs: a name or code, a quantity, and a pack size when the shop sells packs.

```ts
{ format: 'cinv', version: 1,
  source: { site: 'motorobit', kind: 'order' | 'cart' | 'product', url?: string },
  items: [{ name, code?, qty, packSize?, category?, url?, note? }],
  skipped?: number }
```

- `qty` is what the page says was ordered; `packSize` is how many pieces one unit holds. The app's
  review screen shows both and the product (`qty x packSize`), and lets the owner change either.
- `parseCinvPayload` treats every input as untrusted: unknown fields are dropped, text is trimmed and
  capped, counts must be whole numbers from 1 to 999 999, at most 2 000 items.
- Deep links: `component-inventory://import?z=<deflate-raw, base64url>` (or `?d=` plain base64url).
  Windows drops protocol links over about 2 000 characters without an error, so links are capped at
  1 800 characters and larger payloads go through a `.cinv.json` file.
