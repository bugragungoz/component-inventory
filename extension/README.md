# Component Inventory browser extension

Sends the order, cart or product open in a supported Turkish electronics shop to the Component
Inventory app. The app opens its review screen first; nothing is written until you confirm there.

It runs on a few Turkish electronics shops (the list is in `manifest.json`): their order pages are
read line by line, and carts and product pages through the shop's structured data.

## Install (Brave, Chrome, Edge)

The extension is not in a store. Take `component-inventory-extension-<version>.zip` from the
[releases](https://github.com/bugragungoz/component-inventory/releases) and unzip it, or build it:

```bash
npm ci
npm run ext:build      # extension/dist
```

Open `brave://extensions` (or `chrome://extensions`, `edge://extensions`), turn on **Developer mode**,
choose **Load unpacked** and select the unzipped folder (or `extension/dist`).

## Use

A small panel sits at the bottom right of the shop page. It says how many lines it found.

- **Uygulamaya aktar** opens the app through a `component-inventory://` link.
- **Dosya olarak kaydet** saves a `.cinv.json` file; drop it on the app's Import screen. After
  sending by link this button stays offered, because the page cannot see whether Windows opened
  the app. Orders too long for a link are saved as a file automatically.
- **Tanı** copies the page structure (no cookies, no form values, only product names and counts)
  for fixing a shop that changed its pages.

## How it reads a page

1. Known order pages, read from their markup (`src/orders.ts`): an order table, product cards, or
   order lines (cancelled lines left out, count x unit price checked
   against the line total). Tested against the real pages in `test-fixtures/orders`.
2. Otherwise schema.org JSON-LD orders, the GA4/UA `dataLayer` cart or purchase, or a JSON-LD
   product (`src/structured.ts`).

A count that is not a whole number is never guessed: the line is reported as not read. Packs follow
each shop's own rule from `packages/cinv/src/shops.ts`: only names ending in "- 10 Adet" at the one shop that sells that way are packs;
"8'li" and "16'lı" are part properties. A shop's stock code is never used as a part number.

## Tests

```bash
npx vitest run extension     # extractors against the fixtures
npm run test:ext             # the built extension in Chromium on the fixture pages
```
