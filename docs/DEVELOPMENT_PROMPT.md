# Component Inventory: development brief

> **Superseded for the rebuild by `docs/REBUILD_BRIEF.md` (2026-10-03), which records the owner's answers
> to section 11.** This file remains the background on the current app, the shops and the tools.

You are a Claude Code session running on the owner's own Windows laptop. This file is the whole
briefing. It was written at the end of a long cloud session so that nothing learned there is lost.
Read all of it before acting. Then follow section 12 (your first hour).

> **Owner, how to start (Turkce):**
> 1. Bos bir klasor ac, icinde `git clone https://github.com/bugragungoz/component-inventory.git`, sonra
>    `cd component-inventory` ve `git checkout ccr-dc6c3362-vvd4fw`.
> 2. Orada `claude` calistir (en guclu modeli sec) ve sunu yaz:
>    `docs/DEVELOPMENT_PROMPT.md dosyasini bastan sona oku ve oradaki talimatlari uygula. Benimle Turkce konus.`
> 3. Oturum bilgisayarini kullanacaksa (tarayici, ekran) ilk iste izin verdigin seyleri ona soyle; bu dosya
>    hangi islerde sana soracagini zaten belirtiyor.
> 4. Isi bitince bana (veya cloud oturumuna) donup `git diff master...HEAD` ve `docs/FEEDBACK.md` ile review ettir.

---

## 0. Ground rules for you

- **Talk to the owner in Turkish. Write code, comments, commits and docs in English.** The app's own
  UI strings are Turkish and English today (more languages are part of the job).
- **Evidence over assertion.** Say "works" only for what you ran and saw. Keep three words distinct in
  every report: *verified* (you ran it and saw it), *unit-tested*, *not verified*. Rust changes that you did
  not compile are "not compiled".
- **Small, reversible steps.** One topic per commit. Run `npm run lint && npm test && npm run test:ui`
  before each. Never force-push, never rewrite history, never delete a branch without asking.
- **The owner decides product questions.** Collect them (section 11), ask in one batch, and carry on
  with the parts that do not depend on the answer.
- **Honesty about limits beats a green checkmark.** If a shop page, a tool or a permission blocks you, say
  exactly what and what you tried. Do not work around a refusal by another route.
- **Privacy.** The owner is logged in to real shops. Orders contain names, addresses, phone numbers.
  Section 4 says how to handle that. Treat anything from a logged-in page as private until scrubbed.
- **No model or tool names** in code, commits, README or docs you write. Say "the assistant" if you must.

## 1. What this project is

A local-first Windows desktop app that keeps an inventory of electronic components, plus a browser
extension that sends orders and products from Turkish electronics shops into it.

The owner is an electrical and electronics engineering student who uses the app every day.
What matters to them, in order:

1. **Import must be right.** Only the part name or code, its type (category) and the **quantity** matter;
   price and stock numbers do not. The quantity must be exact. A skipped, reported row is better than a
   wrong number.
2. **Shops:** Ozdisan, Direnc.net, Motorobit, Robocombo, Robiz, Robotistan (and similar).
   Ozdisan offers a cart export; the others do not.
3. **Inputs:** (a) browser extension, (b) "print to PDF" of a cart or order page, (c) Excel/CSV.
   Menus, "similar products" and footers must never become rows.
4. **The extension flow:** a button on the shop page, the app opens, a **review screen** lists what will
   be imported, the owner confirms. Order detail pages (what was really received) matter most, product
   pages (type a quantity, one click) next, carts last.
5. **The table has no pages.** All rows scroll; only the visible window is drawn.
6. **The Bugra theme** everywhere: UI, README, app icon.
7. **Standards and more languages** (Chinese, Russian, others), and a professional, well-built app.

## 2. Repository snapshot (as of the brief)

- GitHub: `bugragungoz/component-inventory`. `master` is the last released, working code (v0.3.1).
  **`ccr-dc6c3362-vvd4fw` holds all work since** (about 30 commits ahead, not merged, reviewed by nobody
  yet). Start from it. Make your own branch from it; merge into `master` only after the owner reviews.
- Stack: Tauri v2 (Rust shell, WebView2), **plain JavaScript ES modules** (no framework, no TypeScript),
  Vite, SQLite through `tauri-plugin-sql`, `rusqlite` in Rust for backups. Libraries: SheetJS, jsPDF, PDF.js,
  QRCode.js. Fonts Geist Sans and JetBrains Mono are bundled from `@fontsource`.
- Size: about 17 000 lines in `src/`, `style.css` 3400 lines, `index.html` 1150 lines (every dialog is
  static HTML wired by element id), `app.js` 1400 lines (state, DB, init). `patched.db` (36 MB) is a bundled,
  read-only reference library of 60 000+ parts.
- Tests: Vitest unit tests (115), ESLint `no-undef`, and `tests/ui` (a Playwright-driven smoke test of
  the real UI with a mocked Tauri backend and a real SQLite).

```
src/index.html          all markup and dialogs          src/app.js           state, DB, theme, init
src/style.css           tokens (top) + components       src/modules/*.js     one module per feature
  table.js  virtual-scrolling inventory table             import.js / import_core.js / import_fixup.js
  modals.js add/edit/detail/delete                        cinv_format.js  extension <-> app interchange
  projects.js  BOM, schematic PDF                         number_core.js  parseQuantity, parseLocaleNumber
  i18n.js  en + tr dictionaries (~320 keys each)          attribute_schemas.js  per-category parameters
extension/src           content.js, bridge.js, extract_core.js, dom_extractors.js, sites.js
src-tauri/src           lib.rs (commands, deep link, single instance), backup.rs
tools/capture           read-only page capture from a logged-in Brave      tools/icons  icon generator
tests/ui                harness.mjs, smoke.mjs, screenshots.mjs            docs/design/bugra  the design system
build-msi.bat/.ps1      one-click MSI build                                 docs/FEEDBACK.md  everything the owner said
```

Data model (SQLite): `components` (part_code unique, category, subcategory, quantity, package,
manufacturer, mpn, location, preferred_supplier, voltage_max, current_max, description, datasheet_url,
unit_price, notes, image_path, resistance, tolerance, power_rating, attributes JSON), `stock_movements`,
`projects`, `project_components` (project_id, component_id, required_qty, note). No foreign keys; deleting a
component removes its BOM rows in code. Category names are a fixed English taxonomy (`constants.js`,
`attribute_schemas.js`); stored values stay English, labels may be localized.

Commands: see `CLAUDE.md`. Node 22.5+ is needed for `npm run test:ui` (`node:sqlite`). Rust stable and the
MSVC build tools are needed for `build-msi.bat`.

## 3. What is already done, and what is proven

Treat this list as the starting truth. Re-verify anything cheap.

**Import (app).** `parseQuantity` reads `1.000`, `1,000`, `2.500` as thousands, `1.250,50` as a decimal,
rejects `-5` and `1.2.3`. Three modes: *add to stock* (default), *sync* (overwrite quantity), *replace* (clear
all, keep project BOM links by part code). Duplicate codes in one file are summed. One header map
(`import_core.js`); supplier maps to `preferred_supplier`, serial/lot numbers no longer map to MPN,
`url`/`link` no longer map to datasheet. Excel reads every sheet that has recognizable headers. PDF tables are
cropped at the first totals row and repeated page headers are dropped. The review screen lists every row,
quantity is editable, rows can be excluded. A fresh backup is created right before the write. The write is
**not atomic** (many statements through the SQL plugin): see backlog.

**Table.** Windowed rendering above 200 rows (`virtual_window.js`); single-cell spacer rows (a `colspan` larger
than the visible column count once squeezed the description column).

**Projects.** Shortage is derived (`max(0, required - stock)`), the schematic is not redrawn on note edits,
window listeners are cleaned up, description/notes autosave.

**Extension and deep link.** `component-inventory://import?z=<deflate>` (or `?d=<base64>`), limit 1800
characters, bigger payloads download `.cinv.json`. Rust: `tauri-plugin-single-instance` with the
`deep-link` feature plus `tauri-plugin-deep-link` pinned to 2.4.10; the scheme is registered at startup for
the current user. The owner confirmed that sending from the extension to the app works on their machine.
The owner has **not** yet confirmed fixes B1 to B4 (see `docs/FEEDBACK.md`).

**Shop facts (checked on saved real pages and live product pages):**

| Shop | What the page offers | Extractor |
|---|---|---|
| Ozdisan | Product page: JSON-LD `Product` with `sku`, `mpn`, brand. Order detail `/kontrol-paneli/siparis-durum-gecmisi/siparis-detay/<id>/ozet`: header table and body table are separate; body columns are product details (`Ürün Kodu:<code>Müşteri Numarası:`), description, **quantity** (`[class*="Quantity"]`), packaging type (reel, tube, bag: **not** a multiplier), price | order: `dom_extractors.js`; product: JSON-LD (trust `mpn`) |
| Motorobit | T-Soft platform. Product page: JSON-LD `Product` in an `@graph`; `sku` is a **shop stock code**, not an MPN (ignored via `useSku:false`). Order detail `/uye-siparisleri#/detail/<id>`: no table; one card per product (`a.size-16` parent) with name link and a `div.text-gray-500` reading `N Adet`. **A "- 10 Adet" product sold as 10 units is 10 x 10 = 100 pieces** (checked against the product page price: 0.50 TRY + VAT per 10-piece unit) | order: `dom_extractors.js`, pack size from the name |
| Robotistan | T-Soft. Product page JSON-LD, `sku` is a shop code | product: JSON-LD; **order detail not seen** |
| Robocombo | Ticimax (AngularJS). Orders at `/Hesabim.aspx#/Siparislerim`: `[ng-repeat="order in orderList"]`, details load lazily when an order is opened (`.orderSubContent<id>`); the saved page had no lines | **no extractor yet**: needs a page captured with an order expanded |
| Robiz | not examined (the home page offered no product links to a script) | none |
| Direnc.net | answers 403 to scripts from the cloud | none: needs the owner's browser |

**Design.** Bugra tokens drive `src/style.css` (see section 8). Light theme is derived, follows the system
setting on first run. Geist and JetBrains Mono ship inside the app. App icon and sidebar mark are the green
outline chip on warm black (`src-tauri/icons/source.svg`).

## 4. Safety and privacy when you use the laptop

You may be able to drive a browser and the screen. Use the least powerful tool that does the job:

1. **Scripts first** (`tools/capture`, `tests/ui`, section 5). They are repeatable and leave an audit trail.
2. **Screen control only where a script cannot reach:** OS dialogs, the installer and SmartScreen, a
   browser "open this app?" prompt, loading the extension in `brave://extensions`.

Rules, no exceptions:

- **Never** place an order, press "complete purchase", submit an address or payment form, change account
  settings, or write a review. Reading pages the owner already has open, and clicking things that only expand
  or navigate (an order accordion, a tab), is allowed. Say what you will click before you click it.
- **Never** read, copy or print cookies, tokens, passwords, saved cards, local storage or session data. The
  capture tool does not touch them; do not add code that does.
- **Never** send page content, screenshots or captures to any service. Everything stays on the laptop.
- Real orders hold names, addresses, phone numbers, order numbers. Captures go to `.captures/` (git-ignored).
  The tool masks e-mail addresses, phone numbers, IBANs and 11-digit numbers; it **cannot** mask names,
  streets or order numbers: pass them with `--redact` and read the file yourself. Commit to `test-fixtures/`
  only a capture you have read line by line, or a synthetic fixture shaped like it (preferred, see
  `extension/tests/dom_extractors.test.js`).
- Ask before: installing software, changing system or registry settings, closing the owner's browser (the
  capture setup needs Brave restarted with a debugging port), killing a process you did not start, or
  deleting anything outside this repository.
- If a shop shows a captcha, a login wall or a bot warning, stop and tell the owner. Do not try to get
  around it.

## 5. Your tools: how to see real shops and test the real app

Prefer these, in this order. All of them run on the laptop.

### 5.1 Capture shop pages from the owner's logged-in Brave (`tools/capture`)

Setup, once (needs the owner's go-ahead because Brave must be restarted):

```bat
"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" ^
  --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\brave-capture-profile"
```

A **dedicated profile folder is mandatory**: Chromium 136 and later ignore the debugging port for the default
profile. The owner signs in to the shops in that window once; the login stays in that folder.

```bash
node tools/capture/capture.mjs list
node tools/capture/capture.mjs outline --tab motorobit                    # structure: tables, quantity cells, classes
node tools/capture/capture.mjs snap --tab <n|text> --shop <id> --name <page> \
     [--click "<css>"]... [--scroll] [--redact "<text>"]... [--screenshot]
```

Workflow for each page type, per shop (product page, cart, order list, **order detail with its lines open**):
`outline` -> read it -> write the selector -> `snap` into `.captures/` -> open the file and look for personal
data -> build a **synthetic** fixture shaped like it -> unit-test the extractor with jsdom
(`extension/tests/dom_extractors.test.js` is the model) -> check the extractor against the real capture with
a throwaway jsdom script (do not commit the capture) -> `npm run ext:build` -> test in Brave for real.
Pages built as single-page apps change class names between deploys (hashed CSS-module names, Tailwind):
match on stable parts (`[class*="Quantity"]`, text labels, structure), not whole class strings, and make an
extractor return nothing rather than guess.

### 5.2 Drive the real UI without the desktop shell (`tests/ui`)

`harness.mjs` serves `dist/` in Chromium, mocks `window.__TAURI_INTERNALS__` (SQL plugin backed by real
SQLite, backups, deep link), and gives you `startApp({ theme, extraInit, seedRows })`, `app.seed(n)`,
`app.getDb()`, `app.logs`. Unmocked backend calls are logged as `[unmocked invoke] <name>`: add them to the
harness when a new command appears. Add a check to `smoke.mjs` for every bug you fix and every feature you
build. `npm run shots` regenerates the README screenshots from the same harness.
Set `BROWSER_PATH` to Brave's `brave.exe` if Playwright finds no Chrome or Edge.

### 5.3 Drive the real packaged or dev app (real Rust, real WebView2)

The harness mocks the backend, so it cannot catch Rust or plugin problems. WebView2 accepts a debugging port:

```bat
set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
"C:\path\to\Component Inventory.exe"      & rem or: npm run dev
```

then `chromium.connectOverCDP('http://127.0.0.1:9223')` with `playwright-core` drives the actual app (documented
for WebView2; verify it works here before relying on it, and use a temporary data folder so the owner's real
inventory is never touched: check where `app_data_dir` points and back it up first). Use it for: the deep link
round trip (open `component-inventory://import?z=...` while the app runs and while it is closed), the 30-line
order, backup and restore, single-instance behaviour.

### 5.4 The extension in the owner's Brave

`npm run ext:build`, then `brave://extensions` -> developer mode -> Load unpacked -> `extension/dist`; press
reload on the extension card after every build. The **Tani** button copies a structure-only report of the page.
Ask the owner to press it on any page that misbehaves and paste the result, or capture the page yourself.

### 5.5 What only the owner can prove

Windows installer behaviour (SmartScreen, the MSI itself), the protocol handler prompt in Brave, real orders
on shops you could not open, and whether a count matches the parts physically received. Never claim these.

## 6. Backlog (priority order)

**P0, first.**
1. **Verify B1 to B5** on the real machine (`docs/FEEDBACK.md`): extension quantity, edit, add, the 30-line
   Robocombo order, the MSI build. Get the results in writing.
2. **Shop coverage.** Capture and write extractors, with fixtures and tests, for: Robocombo order lines
   (Ticimax: expand an order first) and its cart, Robotistan order detail, Robiz, Direnc.net, plus the carts of
   Ozdisan and Motorobit. For each shop decide, from a product page, whether quantity is units or pieces
   (the Motorobit "10 Adet" case) and encode the rule with the evidence in a comment.
3. **Atomic import.** Today a failure halfway leaves half a file written. Target: one transaction, an
   `import_batch_id` on every row written, and "undo this import" that reverses only that batch (stock
   movements already exist). Read section 7 before choosing where this lives.
4. **Surface failure honestly.** The extension cannot tell that Windows refused to open the app. Offer a
   fallback that cannot silently fail: after sending, show "Not opened? Save as file" with the `.cinv.json`
   download one click away, and consider a localhost hand-off (the app listens briefly on 127.0.0.1 with a
   one-time token) as a design option; do not build it without the owner's go-ahead.

**P1.**
5. PDF and "print to PDF" import with anchor-based row detection: only blocks that carry a quantity pattern
   (`2 Adet`, `x3`, a quantity column) are product rows; crop between the order heading and "Ara Toplam";
   read product links from the PDF. OCR (`tesseract.js`, Turkish + English, Web Worker, 300 DPI, pre-processing)
   only when there is no text layer. Part codes: correct `O/0 I/1 S/5 B/8` confusions against `patched.db`.
   Needs scrubbed sample PDFs from each shop in `test-fixtures/pdf/` (ask the owner).
6. Column mapping on the review screen, per-shop pack rules, confidence markers (quantity x unit price
   close to the line total is a *confidence hint only*), enrichment of shop product names into category,
   package and value (the code in a shop is a stock number; the real part number is in the name).
7. Optional `supplier_parts` table (component, supplier, supplier SKU, product URL).

**P2.** Quick quantity adjust (+/-) with undo, bulk edit, saved filters, keyboard shortcuts, low-stock view,
fuzzy search with Turkish case folding (`toLocaleLowerCase('tr')`), performance at 100 000 rows, auto-update,
code signing, accessibility audit, empty and error states in Bugra voice.

## 7. Rebuild or refactor: a decision gate, not an assumption

The owner asked for "a professional application, even from scratch if that is what it takes", with Bugra
design, more languages and clear standards. Judge the code before deciding. My assessment from the cloud
session, to confirm or overturn with evidence:

- *Against keeping the structure:* 17 000 untyped lines; every dialog is static HTML wired by element id, so a
  wrong id or missing import fails at runtime (this killed edit and add silently, and a class of six more
  undefined names was found); logic and DOM are intertwined; there is no data layer, so SQL is spread across
  modules and cannot be made atomic through the SQL plugin's connection pool; one 3 400-line stylesheet;
  strings are keyed but the markup mixes `data-i18n` with template literals.
- *For keeping it:* it works, the owner uses it daily, and rewrites lose behaviour nobody wrote down.

**Recommendation: a staged rebuild of the frontend and data layer, keeping what is sound.** Keep: the SQLite
schema (with versioned migrations), `patched.db`, backups, deep link and single-instance plumbing, the
`cinv` interchange format, the extension and its extractors, the pure "core" modules and their tests, the test
harness, the Bugra assets. Replace: the DOM-by-id UI and the scattered SQL.

Target architecture (ask the owner to confirm before you start, section 11):

- **Rust owns the data.** All SQL moves into typed Tauri commands (`list_components`, `import_batch`,
  `undo_import`, ...) using `rusqlite` against the app database, with real transactions, migrations keyed by
  `PRAGMA user_version`, and `cargo test` against in-memory databases. The frontend stops using
  `tauri-plugin-sql`. A pre-migration backup is automatic; a fixture database in the *old* schema must migrate
  in a test. Never break an existing user database.
- **TypeScript, strict**, Vite. A typed client for the commands (`src/api/`); shared types for the `cinv`
  payload used by app and extension.
- **A small component layer that can reuse the Bugra components directly.** The design system ships React
  components (`docs/design/bugra/components/bundle.js`, `index.d.ts`). Preact with `preact/compat` and signals
  (about 4 KB) reuses them, and is a light fit for WebView2. Svelte or Solid would also work but cannot reuse
  that bundle; weigh that.
- **i18n** as in section 9; **virtualized table**; **a real design-token pipeline** (tokens.json to CSS variables
  by a script, so the app cannot drift from Bugra).
- **Tests at every level:** pure unit tests, component tests, the UI harness, the real-app WebView2 run, Rust
  tests, extension fixtures, visual snapshots in light and dark for each locale, axe accessibility checks.

Spike first (one short session, no commitment): port the inventory table and the add/edit dialog to the new
stack with Bugra components, run the harness against it, compare bundle size, cold start and scroll
smoothness with the current app, show the owner screenshots. Then decide. If the spike is not clearly better,
refactor in place instead: types via JSDoc and `tsc --checkJs`, extract a data module, split `index.html`
into templates.

## 8. Design: the Bugra system, applied

Source of truth: `docs/design/bugra/` (copied from the owner's design-system artifact; if they differ, the
artifact wins). Read `README.md`, `tokens.json`, `accessibility.md`, `desktop-and-mobile.md`,
`layout-and-languages.md` and the component guides before drawing anything.

The essentials: dark-first warm black, **one** accent (Android green `#3ddc84`; use `accent-ink` when green is
text or an outline, `on-accent` text on fills), `ok`/`warn`/`info` only as status text with a word or icon,
Geist for UI and JetBrains Mono for code, pill buttons/chips/badges, 10 px fields, 14 px boxes, hairline
borders instead of shadows (only menus, dialogs and snackbars float), a solid 2 px focus ring offset 3 px,
state layers 8/10/10/16 %, motion 100 to 500 ms on `ease-out`, `prefers-reduced-motion` honored, sentence-case
verb-first copy, errors begin with "Error:", ASCII-safe "-" and "...", no emoji, no all-caps labels, no accent
on a single word, text contrast 4.5:1 in both themes, 48 px targets (34 px only in dense desktop bars).

Today's CSS variables map to tokens like this (the current app is a re-skin of the old layout, not yet a
redesign):

| App variable | Bugra token | | App variable | Bugra token |
|---|---|---|---|---|
| `--bg` | `bg` | | `--accent` | `accent` (fill) |
| `--bg-surface` | `surface` | | `--accent-ink` | `accent-ink` |
| `--bg-raised`, `--surface-2` | `surface-2` | | `--accent-dim` | `accent-quiet` |
| `--bg-overlay`, `--bg-hover`, `--surface-3` | **derived, not in Bugra** | | `--accent-green` | `ok` |
| `--border` | `line-strong` | | `--accent-blue` | `info` |
| `--border-subtle` | `line` | | `--accent-amber`, `--danger` | `warn` |
| `--border-strong` | `border-control` | | `--code-bg`, `--code-muted` | `code-bg`, `code-muted` |
| `--text-primary` / `-secondary` / `-tertiary` | `ink` / `muted` / `code-muted` | | `--shadow-menu`, `--shadow-dialog` | same names |

In the redesign, generate this from `tokens.json` instead of copying values by hand.

Gaps in Bugra for a data app (table, tree, tabs, toolbar, menu, tooltip, progress, toast stack, virtual list
row, review table): design them in the same language, label them "(added)" as the system does, and give the
owner a list of every new token and component so they can be added to the Bugra artifact. Do not silently
invent colors. Open design questions for the owner: the per-category schematic icons are currently
multi-color; Bugra has one accent, so propose a monochrome outline set in `muted` (accent on selection);
and the in-app wordmark ("CompInv") versus the full name.

Brand surfaces, all in Bugra: the app icon and sidebar mark (`src-tauri/icons/source.svg`, then
`npm run icons`), the installer images (WiX banner and dialog bitmaps, currently stock), README (Bugra look,
icons from `docs/icons`, real screenshots from `npm run shots`), the extension icon and panel, the social image
(`SocialCard` spec), release notes.

## 9. Languages and internationalization

Goal: Turkish and English complete, **Chinese (Simplified) and Russian next**, then others the owner names
(German, Arabic with right-to-left, ...). Build the infrastructure once so that adding a language is adding a
file.

- One JSON file per locale in `src/locales/` (`tr`, `en`, `zh-CN`, `ru`); English is the fallback. A script
  fails the build when any locale lacks a key, has an extra key, or uses different `{placeholders}` than
  English. Add a pseudo-locale (accented, +40 % longer) for visual tests.
- Plurals through `Intl.PluralRules` with CLDR forms (Russian has *one/few/many/other*, Chinese has only
  *other*); never `n === 1`. Numbers, dates, lists, sorting through `Intl` and `Intl.Collator(locale)`.
- No sentence built from fragments. Keep strings out of markup. Allow 30 % growth (German, Russian) and
  shorter CJK lines; test the toolbar, tables and dialogs in every locale.
- **Fonts: Geist (as bundled) has no Cyrillic, Greek or CJK glyphs** (checked on the files). Decide with the
  owner: system fallbacks per language (Segoe UI for Cyrillic, Microsoft YaHei UI for Chinese, Yu Gothic UI for
  Japanese, Malgun Gothic for Korean) as the Bugra layout notes suggest, or bundle a Cyrillic-capable sans.
  JetBrains Mono ships Cyrillic subsets: import them. Set `lang` on `html`, use logical CSS properties, set
  heading `letter-spacing` to normal for Arabic and CJK.
- Search and filtering must fold case by locale (`toLocaleLowerCase('tr')`: dotless i). Category values stay
  English in the database; show a localized label.
- `parseQuantity` is deliberately about **shop data** (`1.000` is a thousand). Quantity inputs typed by the
  user follow the locale. Keep the two apart and test both.
- Translations written by the assistant are drafts: mark each locale `reviewed: false` in its file until a
  native speaker signs it off, and keep a per-language glossary of electronics terms (capacitor, resistor,
  MOSFET, footprint, BOM, stock, ...). Do not machine-translate part numbers, package names or units.
- The extension gets the same treatment (`_locales/`, `default_locale`), and the README gets `README.tr.md`
  at least.

## 10. Engineering standards

- **Code.** New code in strict TypeScript. ESLint with at least `no-undef`, `no-unused-vars`, `eqeqeq`; keep
  `npm run lint` mandatory in `build-msi.bat` and CI. One module, one reason to change; pure "core" files for
  logic (parsers, mappers, extractors) with no DOM or Tauri imports so they stay unit-testable.
- **Untrusted input.** Shop pages, `.cinv.json`, deep links, CSV, PDF and Excel files are untrusted. Validate
  (`parseCinvPayload` is the pattern), cap sizes, escape every string that reaches HTML (`escHtml`), never
  build SQL from text, never `eval`.
- **Security.** `app.security.csp` is `null` today: set a strict CSP. Narrow the Tauri capabilities (fs scopes
  to the app data folder and user-picked paths, drop unused plugins such as `shell`). Do not log personal data.
- **Tests.** Every bug fix lands with a test that failed before. Pyramid: unit (Vitest), component, UI harness
  (`tests/ui`), real-app WebView2 run, `cargo test` for the data layer, extension fixtures, visual snapshots
  (light and dark, each locale), axe accessibility checks. Performance budgets: table stays smooth to 100 000
  rows, a 2 000-row import commits in under 3 s, cold start under 2 s.
- **CI.** A GitHub Actions workflow on `windows-latest` runs lint, unit tests, the UI harness and a Rust build
  on every push; the existing `release.yml` builds installers on `v*` tags. Keep the three Tauri versions in
  step (npm packages and crates on the same minor; the lockfile enforces it).
- **Git.** Feature branches from `ccr-dc6c3362-vvd4fw`, small commits, imperative subject, a body that says
  why, no force-push, merge to `master` only after the owner's review. Tag releases `vX.Y.Z`; keep
  `package.json`, `tauri.conf.json` and `Cargo.toml` versions identical.
- **Docs.** README stays short and true (what it does, install, import, extension, develop), with real
  screenshots. `CHANGELOG.md` per release. Decisions go in `docs/adr/NNNN-title.md` (context, decision,
  consequences). Keep `docs/FEEDBACK.md` current: it is how the owner reviews you.
- **UX copy** follows the Bugra content rules. Errors say what went wrong and how to fix it. Every
  destructive action confirms or can be undone.
- **Definition of done.** Behaviour verified in the UI harness (and the real app when it touches Rust),
  tests added, lint clean, both themes and every shipped language looked at, keyboard path works, focus ring
  visible, no new hard-coded color, docs and `FEEDBACK.md` updated, and an honest line about what is *not*
  verified.

## 11. Decisions to put to the owner (ask once, in Turkish, with your recommendation)

1. Rebuild the frontend and data layer in stages, or refactor in place? *(Recommend the spike, then staged
   rebuild.)*
2. UI stack: Preact + TypeScript (reuses the Bugra React components) or Svelte/Solid? *(Recommend Preact.)*
3. Fonts for Cyrillic and CJK: system fallbacks (no size cost) or bundled fonts? *(Recommend system
   fallbacks for CJK, a bundled Cyrillic-capable sans only if the mismatch with Geist looks bad.)*
4. Category icons: keep multi-color, or monochrome outline in `muted`? *(Recommend monochrome.)*
5. Language order after Turkish and English, and who can review the translations.
6. Installer signing (certificate) and whether to publish the extension to a store, or keep it unpacked.
7. Do Drive sync and local-Ollama auto-categorise stay in the product? They are the only network and AI features.
8. Which screen-control actions you may take on the laptop without asking each time (section 4).
9. The localhost hand-off for the extension (section 6, item 4): allowed or not.

## 12. Your first hour

1. `git status`, `git log --oneline -30`, `git branch -a`. Confirm you are on a branch made from
   `ccr-dc6c3362-vvd4fw`. Read `CLAUDE.md`, `docs/FEEDBACK.md`, `docs/design/bugra/README.md`.
2. `npm ci`, then `npm run lint`, `npm test`, `npm run test:ui`. Report the numbers. If `test:ui` finds no browser,
   set `BROWSER_PATH` to Brave, Chrome or Edge.
3. Ask the owner (Turkish) for the permissions in section 4 and the answers to section 11 that block you.
   Do not stall on them: continue with what is independent.
4. `build-msi.bat` once (first build is slow: Rust and WiX). Tell the owner exactly what failed, if anything.
5. Write `docs/STATE.md`: what you found, what is unproven, what you will do first, and why. Short.
6. Start milestone M0.

## 13. Milestones (each ends with a report and a pause for the owner)

| | Goal | Done when |
|---|---|---|
| **M0** | Verified baseline | Lint, unit tests, UI harness and MSI build pass on the laptop. The owner has run B1 to B5 and the results are in `FEEDBACK.md`. Real-app WebView2 run works (or the reason it does not is written down). |
| **M1** | Shop coverage | Captured (scrubbed) and tested extractors for every shop in section 3, order detail first, with the unit/pack rule per shop written as a comment with its evidence. The owner imported a real order from each shop and the counts match what arrived. |
| **M2** | Import hardening | Atomic import with batch id and single-import undo; PDF anchor detection and OCR with scrubbed sample PDFs; column mapping on the review screen; failure paths are visible, never silent. |
| **M3** | Spike and decision | The spike of section 7 with measurements and screenshots; the owner chose. |
| **M4** | Foundation | Rust data layer with migrations and tests; typed API client; token pipeline from `tokens.json`; Bugra components (and the "(added)" ones for a data app); i18n infrastructure with parity script; CI. |
| **M5** | Feature parity | Table, add/edit/detail/delete, import and review, extension hand-off, projects and BOM, labels, export, backup and restore, settings, theme toggle: each proven by a harness check; an old-schema database migrates in a test. |
| **M6** | Languages and quality | Chinese and Russian shipped (marked unreviewed until signed off), pseudo-locale and every-locale visual snapshots, axe checks clean, keyboard-only pass, performance budgets met. |
| **M7** | Release | Bugra everywhere (UI, icon, installer images, README, screenshots), `CHANGELOG`, ADRs, a signed or at least documented MSI, a review package for the owner: `git diff master...HEAD --stat`, an updated `FEEDBACK.md`, screenshots in both themes and all languages. |

Between milestones: ship small, keep the app usable at every commit (the owner uses it daily), and keep the
old behaviour alive until the new one is proven.

## 14. How to report

At the end of every session, and when you stop to ask something, write in Turkish:

- **Done and verified** (what you ran, with the result), **done, unit-tested only**, **done, not verified**.
- **Broken or risky**, including anything you introduced.
- **What only the owner can check**, as numbered steps they can follow in two minutes.
- **Decisions needed**, each with your recommendation.
- Commits (hashes and subjects) and the files that matter most for review.

Update `docs/FEEDBACK.md` in the same commit as the work it describes.

## 15. Lessons already paid for (do not relearn them)

- A name used but never imported fails only when that code path runs. `no-undef` found six; the next
  refactor will make more. Keep the lint in the build.
- Never trust a shop's `sku` or dataLayer id as a part number; never read a `view_item` event as a cart.
- A `colspan` larger than the number of visible columns adds phantom columns in a fixed-layout table.
- Windows drops protocol links over about 2000 characters silently. Anything that must arrive goes through
  a channel that reports failure.
- Quantities and units differ per shop; the same words ("10 Adet") mean pieces in one place and units of a
  pack in another. Check against the product page price, then write the rule down with the evidence.
- `npm install` can move `@tauri-apps/*` ahead of the Rust crates and break `tauri build`. Use `npm ci`.
- Chromium 136+ ignores `--remote-debugging-port` on the default profile: use a dedicated profile folder.
- `pkill -f` or `pgrep -f` with a word that is in your own command line can kill your shell; use PIDs.
  Never run `vitest --root /`.
- The first MSI build downloads WiX and compiles Rust (minutes). npm prints "install-scripts blocked"
  warnings for `esbuild` and `core-js`; they are harmless here.
- jsdom prints "Could not parse CSS stylesheet" for modern CSS in saved pages; the DOM is still usable.
- Saved single-page-app HTML (Ticimax, T-Soft, Nuxt) may hold only what was open at save time: capture with
  the order expanded.
- The cloud sandbox where the first version of this work was done could not compile Rust (no WebKit), could not
  reach Direnc.net, and could not log in anywhere. Everything in section 3 marked "verified" was verified in
  the mocked-backend harness or against saved pages, not in the packaged app.
