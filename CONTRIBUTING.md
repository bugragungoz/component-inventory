# Contributing

Thank you for helping. This file says how the project is built, what every change must keep true, and
how to add or review a language.

## Setup

Node.js 22.5 or newer, Rust stable (1.85 or newer). On Linux the Tauri shell needs
`libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`.

```bash
npm ci
npm run dev          # the app
npm run verify       # versions, tokens, locales, lint, colors, types, unit tests
cargo test --workspace
npm run test:ui      # needs a Chromium: PLAYWRIGHT_BROWSERS_PATH, CHROMIUM_PATH or `npx playwright-core install chromium`
npm run test:ext
```

Run `npm run verify` and the Rust tests before every commit; run `npm run test:ui` when the interface
changed and `npm run test:ext` when the extension changed.

## Rules every change keeps

- **Counts are exact.** Shop numbers go through `parseQuantity` (`1.000` is a thousand); what the owner
  types goes through `parseUserQuantity` in the interface language. A value that cannot be read is
  reported, never guessed.
- **Nothing reaches the inventory without the review screen.** Bulk writes take a backup first and can
  be undone.
- **Rust owns the data.** The interface never writes SQL; it calls a command in
  `crates/inventory-core/src/api.rs`. A new command is added once to `for_each_command!` and appears in
  both the Tauri shell and the test bridge.
- **Never `window.confirm`, `alert` or `prompt`.** Ask with `confirm()` from `src/state/dialogs.ts`, which
  waits for the answer. Lint fails on the browser's versions, and the UI checks record any call.
- **Design system.** Bugra (`docs/design/bugra/README.md`): colors only from the tokens (`npm run
  check:colors` fails otherwise), pills for buttons and badges, borders rather than shadows except on
  floating layers, a 2 px focus ring, no all-caps labels, no emoji. Components Bugra lacks are marked
  "(added)" and listed in `docs/design/ADDED.md`.
- **Logical CSS** (`inset-inline-start`, `margin-inline-end` ...) so Arabic mirrors without extra rules.
- **Privacy.** Real shop pages hold names, addresses and phone numbers. Only scrubbed or synthetic data
  goes into `test-fixtures/`; read every text node of a fixture before committing it.
- **Commits.** One topic per commit, an imperative subject, a body that says why. Never force-push or
  rewrite published history.
- **Versions.** Keep `@tauri-apps/*` on the same minor as the Rust crates; `npm run check:versions`
  keeps every file on one app version.

## Translations

Every message lives in `src/locales/<locale>.json`, one file per language, with English (`en.json`) as
the source and the fallback. `npm run check:locales` fails when a file lacks a key, has an extra one,
changes a `{placeholder}`, has the wrong plural forms for its language (Russian one/few/many/other,
Arabic zero/one/two/few/many/other, Chinese other) or uses an ellipsis or dash character the style
avoids.

### Reviewing a language

1. Read the language in the app: Settings > Language. The glossary for it is in
   `docs/i18n/glossary.<locale>.md`; keep its terms or improve the glossary first.
2. Correct `src/locales/<locale>.json`. Part codes, units and acronyms (SMD, MOSFET, NTC) stay as they
   are. Messages are whole sentences: never build one from pieces.
3. When the whole file has been read by a native speaker, set `"reviewed": true` in its `_meta` block.
   Settings then stops showing "not reviewed yet".

### Adding a language

1. Copy `src/locales/en.json` to `src/locales/<code>.json`, set `_meta` (`nativeName`, `dir`: `ltr` or
   `rtl`, `reviewed`: false) and translate. Category and subcategory names are under `category` and
   `subcategory`; the stored values stay English.
2. Add the file to `src/i18n/index.ts` (the import, `FILES`, `LOCALES`).
3. Add `docs/i18n/glossary.<code>.md`.
4. Check the screens in the language and in the pseudo-locale (`en-XA`, longer and accented, in
   Settings when running `npm run dev`), which shows text that does not fit.

Fonts: Geist covers Latin (Turkish included); other scripts use the Windows font for the script through
the per-language stacks in `src/styles/fonts.css`.

## Shops and the extension

An extractor is a pure function of a `Document`, tested against a fixture cut from the real page
(`test-fixtures/orders/README.md`). Match stable parts (labels, structure, `[class*=...]`), return
nothing rather than guess, and report lines that could not be read. A shop's own stock code is not a part
number. Pack rules are per shop in `packages/cinv/src/shops.ts` and need proof from a real order.
