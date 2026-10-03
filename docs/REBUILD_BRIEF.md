# Component Inventory: rebuild brief

You are a cloud coding session. This file is your whole briefing for **rebuilding Component Inventory
from scratch** so that it meets every requirement below. Read it end to end before you write code, then
follow section 14 (your first session). It supersedes `docs/DEVELOPMENT_PROMPT.md` wherever they differ;
that older brief is still the best background on the current app and the shops.

It was written on 2026-10-03 by a session that ran on the owner's Windows laptop, with the owner's
answers to every open question. Facts marked *verified* were run and seen on that laptop.

---

## 0. Ground rules

- **Talk to the owner in Turkish. Write code, comments, commits and docs in English.** The owner is not a
  programmer: explain results in plain Turkish, give them steps they can follow in two minutes, never ask
  them to judge code.
- **Evidence over assertion.** In every report keep three words apart: *verified* (you ran it and saw
  it), *unit-tested*, *not verified*. CI results count as verified when you read the log.
- **Small, reversible steps.** One topic per commit, imperative subject, a body that says why. Never
  force-push, never rewrite history, never delete a branch, never merge to `master` without the owner's
  go-ahead.
- **No model or tool names** in code, commits, README or docs. Say "the assistant" if you must.
- **Privacy.** Real orders hold names, addresses, phone numbers. Nothing personal goes into the repo
  (the repo is public). `test-fixtures/` holds only scrubbed or synthetic data.
- **The owner uses the current app every day.** Never break their data. The new app must open their
  existing database, back it up first, and migrate it (section 7).

## 1. What the product is

A local-first Windows desktop app that keeps an inventory of electronic components, plus a browser
extension that sends orders and products from Turkish electronics shops into it. The owner is an
electrical and electronics engineering student.

What matters to them, in order:

1. **Import must be right.** Only the part name or code, its type (category) and the **quantity** matter;
   prices and stock numbers do not. The quantity must be exact. A skipped, reported row is better than a
   wrong number.
2. **Shops:** Özdisan, Motorobit, Robocombo (orders exist), Robotistan, Direnç.net, Robiz (no orders yet).
3. **Inputs:** (a) the browser extension, (b) "print to PDF" of a cart or order page, (c) Excel/CSV.
   Menus, "similar products" and footers never become rows.
4. **Extension flow:** a button on the shop page, the app opens, a **review screen** lists what will be
   imported, the owner confirms. Order detail pages matter most, product pages next, carts last.
   The owner likes the current extension panel; keep its behaviour, restyle it in Bugra.
5. **The table has no pages.** All rows scroll; only the visible window is drawn; smooth to 100 000 rows.
6. **The Bugra design system everywhere:** UI, app icon, installer, README, extension.
7. **Languages and standards:** Turkish and English complete, more languages done properly, a
   professional, well-built app.

## 2. The owner's decisions (final, do not re-ask)

| Topic | Decision |
|---|---|
| Rebuild | Rebuild the app from scratch on a new branch. Keep the old app usable until the new one is proven. |
| Stack | Your call, with this recommendation: Tauri v2 (keep), **TypeScript strict + Preact (with signals) + Vite**, Rust owns all data (section 6). Preact can reuse the Bugra React components through `preact/compat`. Write an ADR for the final choice. |
| Fonts | **The least troublesome path**: bundle Geist (400/500/600) and JetBrains Mono (with its Cyrillic subset); for scripts Geist lacks, use Windows system fonts through the font stack, no extra downloads: Cyrillic and Greek `Segoe UI`, Simplified Chinese `Microsoft YaHei UI`, Japanese `Yu Gothic UI`, Korean `Malgun Gothic`, Arabic `Segoe UI`. Set `lang` on `<html>` per locale and pick the stack by `:lang()`. |
| Icons | Every category **and subcategory** gets an icon: single-stroke outline SVG on a 24 px grid, 1.6 px stroke, round caps, drawn in `muted`, `accent-ink` when selected. Monochrome, in the Bugra style. Fill every gap; the owner likes the current shapes, so redraw them in this style instead of inventing new metaphors. |
| Languages | Turkish and English first and complete. Then Simplified Chinese, Russian, German; Arabic (right-to-left) when the layout is ready. The owner cannot review translations: make them careful and consistent (glossary, CLDR plurals, no fragments), mark each locale `reviewed: false`, and add a `CONTRIBUTING.md` section so others can review or add languages by pull request. The owner will have other tools check them. |
| Installer signing | At the very end, before a release. Not now. Keep the build ready for it. |
| Extension | Not published to a store. It lives in the repo; releases attach a zip; the README explains "Load unpacked". |
| Google Drive sync | **Keep.** The owner finds it very useful (section 8). |
| Local AI (Ollama) | **Remove** everything Ollama/AI: `ai.js`, its UI, settings, status dot, and any Rust proxy commands. Keep the rule-based categorization and datasheet look-ups. |
| Update check | Show a toast only. **Never** open Settings by itself. Skip the check when the app version cannot be read. |
| Storage place | The owner did not know what "Locations" was for. It is where a part is kept (drawer, box, shelf). Rename it to a clear label (TR "Saklama yeri", EN "Storage place") with a one-line hint, make it optional and hidden from the main table until used. Keep existing values (72 of the owner's rows have one). |
| Screen control | Not available in the cloud. Anything that needs the owner's laptop goes into a short Turkish checklist for the owner. |

## 3. Bugs and traps found in the current app (do not carry them over)

All are written up in `docs/FEEDBACK.md` with status. Fixed ones were fixed in the old app on 2026-10-03;
the rebuild must not reintroduce them, and each needs a test in the new app.

- **B7/B8 - confirmations that do not wait.** `tauri-plugin-dialog` replaces `window.confirm` with an
  async function; code that did not `await` it deleted a project, and restored a backup, the moment the
  dialog appeared. **Never use `window.confirm`, `alert` or `prompt`.** Use an in-app Bugra dialog that
  returns a Promise, and test the Cancel path of every destructive action.
- **B6 - update check.** A version that cannot be read compared as `0`, so every release looked newer
  and Settings opened by itself.
- **B9 - app icon looks strange in the Windows taskbar.** `src-tauri/icons/icon.ico` is well formed (16 to
  256 px PNG frames). Likely causes: the dark tile fills the whole canvas with no margin, it vanishes on a
  dark taskbar, or the Windows icon cache. Redesign with Windows' icon margins in mind, render 16/20/24/32/
  40/48/64/256 px frames with pixel-hinted small sizes, check light and dark taskbars in screenshots.
- **B11 - pack size from names.** `detectPackSize("8'li DIP Switch")` returns 8 and `"16'lı Entegre
  Soketi"` 16: those are one part with 8 positions or 16 pins. Pack rules must be **per shop** and narrow:
  only Motorobit's "- N Adet" suffix is proven to be a pack (section 9).
- **Unmocked network in tests.** The UI harness reached the real GitHub API on a connected machine.
  Every browser test must abort external requests and assert that none was made.
- Lessons from earlier sessions still apply: an undeclared name fails only at runtime (keep `no-undef`
  and strict TypeScript); a `colspan` wider than the visible columns adds phantom columns; Windows drops
  protocol links over about 2000 characters silently; never trust a shop's `sku` or dataLayer id as a part
  number; never read a `view_item` event as a cart; the browser's "open this app?" prompt is tab-modal and
  blocks clicks on the page while shown; `npm install` can move `@tauri-apps/*` ahead of the Rust crates
  (use `npm ci`, keep npm packages and crates on the same minor).

## 4. Everything the current app does (feature parity list)

The rebuild must keep all of this unless section 2 removes it. Read the old code for behaviour before
replacing a feature; rewrites lose what nobody wrote down.

- **Inventory table:** virtual scrolling, column show/hide and order, custom columns (`custom_columns`
  table), sort, search (fuzzy, must fold Turkish case: `İ/i`, `I/ı`), filters by category/subcategory,
  low-stock threshold and highlight, category sidebar with counts, rename category, theme toggle.
- **Parts:** add, edit (simple and detailed form modes), detail view, delete with confirm, per-category
  attributes (`attribute_schemas.js`), datasheet link, image, stock movements history, assign to project.
- **Import:** CSV/XLSX (every sheet with recognizable headers), PDF (text layer, cropped at totals), the
  `.cinv.json` file and `component-inventory://import?z=` deep link from the extension; review screen with
  editable quantity, row exclusion; modes add-to-stock (default), sync, replace; duplicate codes summed;
  backup before the write; header map in `import_core.js`; `parseQuantity` reads shop numbers (`1.000` is a
  thousand, `1.250,50` a decimal, rejects negatives).
- **Bulk tools:** rule-based categorize and normalize, duplicate groups, datasheet backfill (keep; drop
  only the AI parts), bulk confirm dialog.
- **Built-in library:** `patched.db` (36 MB, 60 000+ parts, read-only) with `search_builtin_library` and
  `batch_lookup_builtin`; Özdisan look-up and part-number patterns.
- **Projects and BOM:** create, rename, reorder, delete (confirm), description and notes autosave,
  schematic PDF viewer, KiCad schematic import (`kicad_sch_core.js`), BOM rows with required quantity and
  note, shortage derived as `max(0, required - stock)`.
- **Labels:** printable labels with QR codes (`labels.js`).
- **Export:** CSV, XLSX, PDF (jsPDF), export folder setting.
- **Backups:** automatic on an interval, retention count, manual create, list, restore (confirm), diff
  between a backup and the current database (`backup_diff`).
- **Google Drive sync:** see section 8.
- **Settings:** language, default quantity, form mode, low-stock threshold, storage places, export
  folder, backup interval and retention, backup diff, Drive folder and base name, update check, about
  (database path, version), reset.
- **Desktop plumbing:** single instance (a second launch focuses the window and passes deep links),
  deep-link scheme registered per user at startup, update check against GitHub Releases.
- Rust commands today: `create_backup`, `set_backup_interval_minutes`, `list_backups_cmd`,
  `restore_backup_cmd`, `fetch_url`, `get_app_data_dir`, `write_external_file`, `copy_db_to_external`,
  `read_external_file`, `search_builtin_library`, `batch_lookup_builtin`.

Screenshots of the current UI are in `docs/screenshots/`; the old UI harness (`tests/ui`) shows how to
drive it.

## 5. Design: Bugra

Source of truth: `docs/design/bugra/` (`README.md`, `tokens.json`, `accessibility.md`,
`desktop-and-mobile.md`, `layout-and-languages.md`, component guides, React bundle). Read it before drawing
anything. Essentials: dark-first warm black, one accent (Android green `#3ddc84`; `accent-ink` for green
text and outlines, `on-accent` on fills), `ok`/`warn`/`info` only as status text with a word or icon,
Geist and JetBrains Mono, pill buttons/chips/badges, 10 px fields, 14 px boxes, hairline borders instead
of shadows (only menus, dialogs, snackbars float), 2 px focus ring offset 3 px, state layers 8/10/10/16 %,
motion 100 to 500 ms `ease-out` with `prefers-reduced-motion`, sentence-case verb-first copy, errors begin
with "Error:", ASCII "-" and "...", no emoji, no all-caps, 4.5:1 text contrast in both themes, 48 px
targets (34 px in dense desktop bars). Light theme is derived; follow the system setting on first run.

- Generate CSS variables from `tokens.json` with a script; no hand-copied hex anywhere (lint for it).
- Bugra lacks a data-app vocabulary: table, virtual row, tree, tabs, toolbar, menu, tooltip, progress,
  toast stack, review table, empty and error states. Design them in the same language, label each
  "(added)", and list every new token and component in `docs/design/ADDED.md` for the owner.
- Brand surfaces: app icon and sidebar mark (B9), installer banner and dialog bitmaps (WiX), README
  (Turkish copy `README.tr.md` too), extension icon and panel, social image, release notes.

## 6. Target architecture

```
crates/inventory-core/   pure Rust: schema, migrations, queries, import batches, backups (rusqlite,
                         bundled SQLite). No Tauri dependency, so `cargo test` runs on Linux in the cloud.
src-tauri/               thin shell: typed commands that call inventory-core, deep link, single
                         instance, dialogs, file access scoped to the app folder and user-picked paths.
src/                     TypeScript strict + Preact + signals. src/api/ is the only place that calls invoke.
src/locales/*.json       one file per locale (section 10).
packages/cinv/           shared TypeScript types and validator for the cinv payload (app + extension).
extension/               Manifest V3; extractors as pure functions; _locales/.
tools/                   token pipeline, icon generator, locale checker, capture tool (kept).
tests/                   unit, component, UI harness, real-app (WebView2), visual, a11y.
```

- **Rust owns the data.** All SQL lives in `inventory-core`, with real transactions. The frontend stops
  using `tauri-plugin-sql`. Commands are coarse and typed (`list_components`, `save_component`,
  `import_batch`, `undo_import`, `delete_project`, ...).
- **Atomic import with undo:** one transaction per import, an `import_batch_id` on every row and stock
  movement it writes, and "undo this import" that reverses only that batch. A 2 000-row import commits
  in under 3 s.
- **Untrusted input** (shop pages, `.cinv.json`, deep links, CSV, PDF, XLSX): validate, cap sizes, never
  build SQL from text, never `eval`, escape everything that reaches HTML (Preact does by default; no
  `dangerouslySetInnerHTML` with untrusted text).
- **Security:** a strict CSP (today `app.security.csp` is `null`), Tauri capabilities narrowed to what is
  used, drop `tauri-plugin-shell` and the SQL plugin, no personal data in logs.

## 7. Data and migration (never lose the owner's data)

- The owner's real database: `%APPDATA%\com.bugragungoz.component-inventory\component_inventory.db`,
  `PRAGMA user_version = 0`, 635 components, 2942 stock movements, 0 projects, 72 rows with a location
  (2026-10-03). WebView storage (theme, language, UI settings) is in
  `%LOCALAPPDATA%\com.bugragungoz.component-inventory\EBWebView`: move settings into the database.
- **Keep the identifier** `com.bugragungoz.component-inventory` so the new app finds that database.
- `test-fixtures/db/v0-schema.sql` is the exact schema of that database (copied from `sqlite_master`)
  with synthetic edge-case rows. A test must load it, migrate to the new schema and check every row,
  movement, project, BOM row and custom column survives.
- Migrations keyed by `PRAGMA user_version`, each in a transaction, with an automatic backup file
  written **before** the first migration runs. Never drop a column that holds data without moving it.
- Normalize legacy category names during migration and record it in a migration log: the owner has
  `Thyristors` and `Thyristors & Triacs`, `Uncategorized` and `Unclassified`, `Consumables` and
  `Consumables & Tools`, and `Legacy Parts (Sony/VCR)`. Stored category values stay English (fixed
  taxonomy in `constants.js` / `attribute_schemas.js`); labels are localized.
- Drop `project_components.missing_qty` only after confirming nothing reads it (shortage is derived).

## 8. Google Drive sync (keep)

It is not an API integration. After every save the app writes `<base>.xlsx`, `<base>.json` and `<base>.db`
snapshots into a folder the owner picked inside their Google Drive for Desktop folder; Drive uploads them,
and the owner opens the XLSX on the phone in Google Sheets. XLSX layout: a "Summary" sheet with all parts,
one sheet per main category with category-specific columns, frozen header, auto-filter, sized columns.
Keep this behaviour, make writes atomic (write to a temp name, then rename), debounce, and show the last
sync time and any error in the status bar. Code: `src/modules/drive_sync.js`, `drive_sync_core.js`,
Rust `write_external_file`, `copy_db_to_external`.

## 9. Shops and import accuracy

**Real order pages are in `test-fixtures/orders/`** (cut from the owner's logged-in pages on 2026-10-03,
personal data removed, read node by node) with `expected.json` as ground truth. Read
`test-fixtures/orders/README.md`. Verified facts:

| Shop | Order detail page | Quantity rule | State |
|---|---|---|---|
| Özdisan | `/kontrol-paneli/siparis-durum-gecmisi/siparis-detay/<id>/ozet`; body table separate from header table; code in `Ürün Kodu:<code>Müşteri Numarası:`, quantity in `[class*="Quantity"]` | per piece; REEL/TUBE/Cut Tape is packaging, not a multiplier | extractor matches the fixture (14 lines, 70 pieces), *verified* |
| Motorobit | `/uye-siparisleri#/detail/<id>` (T-Soft, Tailwind); one card per product (`a.size-16` parent), `N Adet` line | names ending "- 10 Adet" are packs of 10 (10 units = 100 pieces, checked against product price); nothing else is a pack | extractor matches the fixture (13 lines, 635 pieces), *verified* |
| Robocombo | `/Hesabim.aspx#/Siparislerim` (Ticimax, AngularJS); `.package-product-item.siparisUrun`; name in `.solDetay > a`, the `strong` in it is a shop stock code; quantity is the first `.sagDetay .hsbmSpan strong` (label empty, "Adet" or "ADET"); unit and line price follow; class `iptal` = cancelled | per piece; "8'li", "16'lı" are part properties, not packs; qty x unit price = line total on all 30 lines (use as a confidence hint) | **no extractor yet**: write it against the fixture (30 lines, 114 pieces); a `todo` test waits in `extension/tests/order_fixtures.test.js` |
| Robotistan | product pages: JSON-LD, `sku` is a shop code | per piece unless proven | no order yet |
| Direnç.net, Robiz | not seen (Direnç.net answers 403 to scripts) | unknown | no order yet; generic JSON-LD/dataLayer product extraction, and the Tanı (diagnose) report for later |

Rules for every extractor: pure function of a Document; match stable parts (labels, structure,
`[class*=...]`), never whole hashed class strings; return nothing rather than guess; report skipped rows;
the shop's stock code is not a part number (the real part number is usually in the name, so enrich name
-> part number, category, package, value with the built-in library and patterns, as a suggestion on the
review screen).

**PDF import ("print to PDF"):** anchor-based row detection (only blocks with a quantity pattern such as
`2 Adet`, `x3` or a quantity column are rows), crop between the order heading and "Ara Toplam", read
product links from the PDF; OCR (Turkish + English, in a worker) only when there is no text layer; correct
`O/0 I/1 S/5 B/8` against the library. Build sample PDFs **synthetically from the HTML fixtures** (print
them headless) since you cannot reach the shops.

**Review screen:** column mapping, per-row confidence markers, editable quantity and pack size, exclude,
"why this number" tooltip (e.g. "10 units x 10-piece pack").

## 10. Languages

- One JSON per locale in `src/locales/` (`en`, `tr`, `zh-CN`, `ru`, `de`, later `ar`); English is the
  fallback. A script fails the build when a locale lacks a key, has an extra key, or uses different
  `{placeholders}`. A pseudo-locale (accented, +40 % longer) for visual tests.
- `Intl.PluralRules` with CLDR forms (Russian one/few/many/other, Chinese other only), never `n === 1`;
  numbers, dates, lists, sorting through `Intl`; search folds case by locale.
- No sentence built from fragments; strings out of markup; layouts take +30 % text and RTL (logical CSS
  properties) from the start.
- `parseQuantity` is about **shop data** and stays locale-independent; quantities typed by the user follow
  the UI locale. Test both.
- A glossary per language (`docs/i18n/glossary.<locale>.md`: component, resistor, capacitor, MOSFET,
  package, footprint, BOM, stock, storage place, ...). Never translate part numbers, package names or units.
- Each locale file carries `"_meta": { "reviewed": false }` until a person signs it off; the About screen
  lists the review state honestly. `CONTRIBUTING.md` explains how to review or add a language.
- The extension gets the same treatment (`_locales/`, `default_locale: "tr"`).

## 11. Testing and CI (you have no Windows machine: CI is your Windows)

- **GitHub Actions on `windows-latest` is where Windows truth comes from:** lint, typecheck, unit tests,
  `cargo test`, the UI harness, the extension e2e, `tauri build` (MSI and NSIS as artifacts), and a
  **real-app run**: launch the built exe with
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` and drive it with
  `playwright-core`'s `connectOverCDP`: first run on an empty profile, migration of the v0 fixture, deep
  link while running and while closed, single instance, backup and restore, an import and its undo. Upload
  screenshots as artifacts and read them. Use `gh run view --log` to read results.
- Linux in the cloud: `cargo test -p inventory-core`, Vitest, the UI harness against Vite's build with a
  mocked backend (keep `tests/ui/harness.mjs` ideas: real SQLite via `node:sqlite`, external requests
  aborted, async `confirm` mocked as the dialog plugin does).
- Visual snapshots in light and dark for every locale and the pseudo-locale; axe accessibility checks;
  keyboard-only paths; performance budgets (100 000 rows smooth, 2 000-row import < 3 s, cold start < 2 s).
- Every bug fix lands with a test that failed before.

## 12. Repository and branches

- GitHub `bugragungoz/component-inventory`. `master` = v0.3.1 (released). Branch `rebuild-prep` (this
  brief, the fixtures and the fixes of 2026-10-03) builds on `ccr-dc6c3362-vvd4fw`, which holds about 30
  unreviewed but tested commits since v0.3.1.
- Start the rebuild on a new branch from `rebuild-prep` (for example `rebuild`). Keep the old app
  buildable on its branch so the owner can keep using it.
- Version the new app `1.0.0-beta.N` until the owner accepts it; keep `package.json`, `tauri.conf.json`
  and `Cargo.toml` versions identical; tag releases `vX.Y.Z`; `CHANGELOG.md` per release; decisions in
  `docs/adr/NNNN-title.md`; keep `docs/FEEDBACK.md` current (it is how the owner reviews you).

## 13. Milestones (each ends with a short Turkish report and a pause for the owner)

| | Goal | Done when |
|---|---|---|
| **R0** | Foundation | ADR for the stack; workspace with `inventory-core`, typed API, token pipeline, locale checker, CI green on Windows including `tauri build` and a real-app smoke run that opens an empty window. |
| **R1** | Data | Schema, migrations, v0 fixture migrates in `cargo test`, backup-before-migrate, atomic import batches with undo, settings in the database. |
| **R2** | Core UI | Bugra components (+ "(added)" ones), virtual table, add/edit/detail/delete with in-app confirm dialogs, search with Turkish folding, category sidebar with the new icon set, storage place (section 2), status bar. |
| **R3** | Import | CSV/XLSX/PDF/cinv/deep link, review screen with confidence and pack size, Robocombo extractor and the fixed pack rules, extension restyled in Bugra with "save as file" fallback kept, extension e2e in CI. |
| **R4** | Everything else | Projects/BOM, KiCad and schematic viewer, labels, export, backups and diff, Drive sync, update toast; every feature in section 4 proven by a test. Ollama removed. |
| **R5** | Languages and quality | tr/en complete, zh-CN/ru/de shipped as unreviewed, pseudo-locale and visual snapshots, axe clean, keyboard pass, performance budgets met, CSP strict. |
| **R6** | Release candidate | New icon (B9) checked in taskbar screenshots, installer images, README (+ `README.tr.md`) with real screenshots, CHANGELOG, MSI and NSIS from CI, a review package for the owner (`git diff master...HEAD --stat`, screenshots, `FEEDBACK.md`). Signing is prepared but done last, by the owner's decision. |

## 14. Your first session

1. Clone, check out `rebuild-prep`, read `CLAUDE.md`, this file, `docs/FEEDBACK.md`, `docs/STATE.md`,
   `docs/design/bugra/README.md`, `test-fixtures/orders/README.md`.
2. `npm ci`, `npm run lint`, `npm test` (expect 117 passed, 1 todo). Run the old UI harness if a browser
   is available. Report numbers.
3. Write the stack ADR and the R0 plan; start R0. Set up the Windows CI job early: it is your only way to
   see the real app.
4. Report to the owner in Turkish (section 15). Ask only what blocks you; section 2 already answers the
   product questions.

## 15. How to report (in Turkish, for a non-programmer)

- **Ne bitti ve doğrulandı** (what ran, with the result), **yalnızca birim testli**, **doğrulanmadı**.
- **Bozuk veya riskli** olan her şey, kendi getirdiklerin dahil.
- **Sahibin kontrol etmesi gerekenler:** numbered steps of at most two minutes each (install this MSI,
  click this, compare this number with the box on your desk).
- Commit hashes and subjects, and links to CI runs and artifacts.

## 16. What only the owner can do (collect these into one checklist per milestone)

Install the MSI on their laptop (SmartScreen), load the extension in Brave (`brave://extensions`, Load
unpacked, `extension/dist`), send a real order from each shop and compare counts with the parts received,
confirm the taskbar icon, open their real database with the new app. New shop pages (Robotistan,
Direnç.net, Robiz orders, carts) can be captured later on the laptop with `tools/capture` (see
`tools/capture/README.md`; Brave is at `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe`
on that machine, started with `--remote-debugging-port=9222 --user-data-dir=%USERPROFILE%\brave-capture-profile`).
