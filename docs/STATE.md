# State of the work

Updated 2026-10-03, after the rebuild session (cloud). Short on purpose: what was proven, what is only
unit-tested, what is unproven. History is in git; owner reports are in `FEEDBACK.md`.

## The 1.0.0-beta.1 rebuild

Branch `claude/modest-wozniak-tv5ybb`, made from `rebuild-prep`. Not merged, not tagged.

### Verified (ran, with the result)

| Check | Result |
|---|---|
| `npm run verify` | versions, tokens, 6 locale files of 818 messages, lint, colors, types, 117 unit tests |
| Rust | `cargo test --workspace`, `clippy -D warnings`, `rustfmt` on Linux; the core's tests on Windows paths in CI |
| UI checks on the real core (`npm run test:ui`) | 110 checks: parts, keyboard, projects, backups (B8), CSV import and undo, deep link, update toast (B6), old database migration, newer-schema startup screen, Drive copy, label sheet PDF, CSV / JSON / Excel / PDF export, a KiCad schematic building a parts list, auto-categorize, axe in both themes, 100,000 parts, a 2,000-line import |
| Layout (`npm run test:visual`) | no overflow, no cut labels and a review that fits without sideways scrolling, in the pseudo-locale, German, Arabic (right to left), Chinese and Russian at 960 x 640 |
| Extension in Chromium (`npm run test:ext`) | Özdisan 14 lines / 70 pieces, Motorobit 13 / 635, Robocombo 30 / 114, a cart, the file fallback |
| PDF import | the three printed orders match their `expected.json` |
| Windows build in CI | `tauri build`: MSI (en-US, tr-TR) and NSIS installers as artifacts |
| The built app on Linux (WebKitGTK under Xvfb, by hand) | opens; over a schema-0 database it migrates, keeps `backups/pre-migration-v0-*.db` and lists all 10 parts; started from a `component-inventory://` link it opens the review |
| Performance (harness, Chromium) | 100,000 parts: a scroll jump 33 ms median, search 92 ms, sort 201 ms; 2,000 lines from file to inventory about 1.8 s |

| The built app in WebView2 on Windows (`tests/real-app/run.mjs`, CI runs 5 and 7) | first start on an empty profile (3 to 10 s to the first screen while WebView2 sets up its profile), the schema-0 database migrated with its copy (1.1 s), Cancel in the delete question (B7), a second copy exiting (single instance), backup restore with Cancel, Restore and Undo (B8), a link while running (10 x 10 = 100) imported and undone, a link starting the closed app; 100,000 parts on screen 2.0 s after starting, 28 rows drawn, a search in 141 ms |

### Only unit-tested, or checked as files

- The label sheet and the PDF list are checked as files (a PDF with the right number of pages); nobody
  has printed them on label paper yet.
- The PDF import of the three printed orders and the KiCad schematic reader: unit tests on real files.

### On the owner's laptop, second round (2026-10-03, beta.2 to beta.4)

Verified on Windows 11 (Brave as the test browser): `npm run verify` (123 unit tests), `cargo test
--workspace`, `clippy -D warnings`, `npm run test:ui` (132 of 132), `npm run test:ext`, `npm run build`;
the tr-TR MSI installed over the previous one three times (beta.2, beta.3, beta.4; one entry, version
1.0.0.4), data kept every time (635 parts, 8,221 pieces), a copy of the data folder before each install.

On the installed beta.4, live: the saved sort comes back at start, the Drive copy is written at start
("Drive synced 7:29 PM"), and a real order page in the capture Brave (13 lines, 635 pieces) opened one
review in the app, which came to the front; one Cancel closed it.

Found on the installed app and fixed: a saved column order put the part code and the count off screen;
one send reached the app two or three times; the saved sort was never restored. Each has a UI check that
fails on the old code. Not reproduced: the owner's "sent but nothing in the app" (fixed the three
silent paths it could be).

Open: PDF import does not work for the owner (B17, left for later); the owner reviews tr and en.

### On the owner's laptop (2026-10-03, after the rebuild)

Verified on Windows 11 with Brave as the test browser (`CHROMIUM_PATH`):

- `npm ci`, `npm run verify` (117 unit tests), `cargo test --workspace` (43), `npm run test:ui` (111 of
  111, 100,000 parts: scroll jump median 21.8 ms, search 111 ms, sort 219 ms), `npm run test:ext` (13 of
  13, after the Windows path fix), `npm run build`: no Rust warnings; MSI en-US and tr-TR, NSIS.
- A dry run first: a copy of the owner's real database migrated through `inventory-bridge`: 635 parts,
  8,221 pieces, 2,942 movements, 72 storage places before and after, every part code and every count
  identical; legacy category names folded as planned.
- The tr-TR MSI installed (v0.3.1 had been uninstalled by the owner; it was an NSIS per-user install, the
  MSI is per-machine in `C:\Program Files\Component Inventory`). First start about 1 s to a DevTools
  port; the real database migrated to version 1 with `backups/pre-migration-v0-*.db`, the same totals as
  the dry run, no page errors; the second start did not migrate again.
- The old app's settings carried over (its language was English, dark theme, Drive on with the same
  folder and the default base name `croxz`, so the phone's sheet keeps its source).
- The `component-inventory://` handler now points to the installed exe; a link sent while the app ran
  opened the review in the same window (one process): 3 units x 10-piece pack = 30 pieces; Cancel wrote
  nothing.
- Taskbar icon (B9): the new outline chip sits like the other icons at taskbar size.

Found and fixed here: `tests/real-app/run.mjs` deleted the app's data folder wherever it ran (now CI
only, or with `--delete-my-app-data`); the extension e2e failed on Windows paths.

Seen and left: the status bar says "Drive synced -" before the first write of a session, which reads as
if something was synced.

### Not verified

- SmartScreen (the owner's install ran from a local build), the extension on live shop pages in the
  owner's Brave (it has to be loaded by hand: Brave does not open `brave://` pages from the command line).
- The extension on live, logged-in shop pages; Robotistan, Direnç.net and Robiz order pages were never seen.
- Every translation: `tr` is marked reviewed at the owner's request and **the owner will check it
  (remind them)**; `en` likewise; `de`, `ru`, `zh-CN`, `ar` wait for native speakers.
- Signing (prepared in `docs/RELEASING.md`, not switched on).

### Not built

- OCR for scanned PDFs: they are refused with a clear message.
- Category lookup from an Özdisan product page: the Rust command (`fetch_shop_page`) exists, the UI does
  not use it yet.

### Small things seen and left

- With five-digit counts (100,000 parts) the narrow sidebar shortens category names ("Resi...").
- Several notices at once can cover the review's main button until they close (4 to 12 s).

### How the Windows real-app run got there

Runs 1 to 3 never reached the app: WebView2 started with wry's own arguments and ignored
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, so the DevTools port stayed closed (the process list in run 3
showed it). Since `8feadda` the app opens its window itself and passes the variable on. Its screenshots
at 1024 x 768 then showed the import review scrolling sideways, the wordmark wrapping and the toolbar
on two lines; all three are fixed and covered by `npm run test:visual`.

## Before the rebuild: the laptop session (2026-10-03)

### Baseline on this laptop

| Check | Result |
|---|---|
| Branch | `local/m0-baseline`, made from `ccr-dc6c3362-vvd4fw` (24 commits ahead of `master`) |
| Toolchain | Node 24.20, npm 12.0, cargo 1.95 (stable MSVC) |
| `npm ci` | ok (the known "install-scripts blocked" warnings for esbuild and core-js) |
| `npm run lint` | verified: clean |
| `npm test` | verified: 14 files, 115 tests pass |
| `npm run test:ui` | verified: 21 checks pass, after one fix (below). Needs `BROWSER_PATH`: the only browser here is Brave, at `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe` (the brief's `Program Files` path is wrong for this machine) |
| MSI build | verified: `build-msi.ps1` ran clean (npm ci, lint, unit tests, Rust release build in about 3 min, WiX), no Rust warnings, `release/Component Inventory_0.3.1_x64_en-US.msi` (13.3 MB). Installing it is not verified |
| `npm run test:ext` | verified: 5 checks (new, see below) |

### Found in this session

- **The harness reached the internet.** On a connected machine the app's update check hit the real GitHub
  API, the version was unmocked (`null`), so a "new version" toast covered the edit dialog and the smoke test
  failed. The cloud sandbox had no network, so this never showed. Fixed: the harness mocks the version and
  aborts every external request (and checks that none was made).
- **App bug behind it:** an unreadable version compared as `0`, so every release was announced as an update
  and Settings opened by itself; the fallback version was stale (`0.3.0`). Fixed and covered (B6 in
  `FEEDBACK.md`). The real app reads its version, so owners rarely hit this.
- On launch, when an update exists, the app opens Settings by itself on top of whatever the owner is doing.
  That is intrusive; propose a toast only. Not changed yet (product question).

- The extension now offers "Açılmadı mı? Dosya olarak kaydet" after every send (P0 item 4, file route only).
  The browser's "open this app?" prompt is tab-modal and blocks clicks on the page while shown.

### Real-app run (WebView2): not done yet

The owner's real data lives in `%APPDATA%\com.bugragungoz.component-inventory` (database) and
`%LOCALAPPDATA%\com.bugragungoz.component-inventory` (WebView storage: theme, language). Tauri resolves these
through the Windows known-folder API, so an environment variable cannot redirect them, and the app re-registers
the `component-inventory://` handler (HKCU) to whichever exe runs. Moving the owner's folders aside was refused
by the session's safety check. Two options for the owner:

1. A test build with its own identifier (`tauri build --config` override), so it uses its own data folders;
   the HKCU protocol handler is saved before and restored after the run.
2. The owner closes the app, backs up the two folders themselves, and lets the session run against them.

### Unproven (only the owner or the real app can prove)

- B1 to B4 on the real machine (extension quantity, edit, add, the 30-line Robocombo order).
- Anything Rust: the deep link round trip, single instance, backup and restore in the packaged app.
- Shop extractors against live logged-in pages (Robocombo, Robotistan orders, Robiz, Direnc.net not seen).

### Owner decisions (2026-10-03)

- Architecture: spike first (Preact + TypeScript, table and add/edit) at M3, then decide.
- Extension failure: build the "Not opened? Save as file" fallback now; localhost hand-off only as an ADR.
- Screen control: broad go-ahead; never orders, payments, form submits or account changes.
- Brave capture with a separate profile: approved.
- Still open: fonts for Cyrillic and CJK, category icons, language order and reviewers, signing and store,
  Drive sync and local auto-categorise.

### Later the same day

- The owner chose a rebuild in a cloud session and answered every open question. `docs/REBUILD_BRIEF.md`
  holds those answers and the plan.
- Real order pages from Özdisan, Motorobit and Robocombo were captured on the laptop, cut down to the
  product lists (no personal data) into `test-fixtures/orders/` with ground truth. The current Özdisan and
  Motorobit extractors match them exactly (verified); Robocombo has no extractor yet.
- Fixed (B7, B8): project delete and backup restore did not wait for the confirmation.
- `test-fixtures/db/v0-schema.sql`: the exact schema of the owner's database with synthetic rows.

### Next, in order (superseded by the rebuild brief)

1. Finish M0: MSI build, owner runs B1 to B5, real-app WebView2 run with a temporary data folder.
2. M1: capture order detail pages per shop (owner logs in to the capture Brave), synthetic fixtures, tests.
3. P0 item 4: the "Not opened? Save as file" fallback in the extension.
