# Feedback ledger

Everything the owner has reported or asked for, with what was done and what is still unproven.
Add new feedback at the top of its section. Never delete an entry; change its status.

Status words: **open** (nothing done), **fixed in code** (changed and unit-tested), **verified in harness**
(driven in Chromium against the real Rust core, `npm run test:ui`), **verified in CI on Windows** (the
built app in WebView2, `tests/real-app/run.mjs`), **needs owner check** (only the owner's machine, real
shops or real Brave can prove it), **closed** (owner confirmed).

The 1.0.0-beta rebuild (2026-10-03) replaced the old app; statuses below say where each item stands in it.

## Bugs the owner reported

| # | Report | Status | Notes |
|---|---|---|---|
| B17 | PDF import does not work (owner, 2026-10-03) | **open**, left for later at the owner's request | Reproduced on Windows in the UI harness: choosing `test-fixtures/orders/pdf/motorobit-order.pdf` on the Import screen shows nothing (no review, no message, no page error) for 6 s, while the same file passes the Node unit tests. Suspect the pdf.js worker in the WebView (worker loading or CSP); start there. A failure must also be shown, not hang. |
| B16 | "Storage places editable? I want to place parts in boxes like the real ones" | fixed in code, verified in harness and `cargo test` | Selection bar: Move to storage place; sidebar: rename a place (all its parts). One bulk patch with a backup. |
| B15 | Icons: tag icons on Connectors & Sockets, Crystals, Electromechanical, Legacy Parts, Protection Devices; odd consumables, solder, PCB, relay, bridge, LED | fixed in code; gallery checked by eye; **needs owner check** | The old app's category names were not in the taxonomy; they map by name now. Redrawn as the owner asked. |
| B14 | Text cut with "..." ("bişey biş...") | fixed in code, verified on a copy of the owner's database in the harness | Columns fit their longest value; elsewhere text wraps. |
| B13 | Extension says sent, nothing in the app | not reproduced (running app, closed app, Brave in front all worked on the laptop); three silent failure paths fixed and tested; **needs owner check** | See the beta.2 changelog. |
| B12 | Brand is "Özdisan", not "Özdişan"; no shop names on GitHub | fixed | Public README, extension README, changelog. Code and internal notes keep the names they need. |
| B11 | Pack size read from names like "8'li DIP Switch" or "16'lı Entegre Soketi" | fixed in code, verified in harness and extension e2e | Pack rules are per shop (`packages/cinv/src/shops.ts`); only Motorobit's "- N Adet" is a pack. Tests: Robocombo order (30 lines, 114 pieces, "8'li" stays 1), a Robotistan cart with "10'lu Paket" stays 1. |
| B10 | "Locations neden var, neye yarıyor?" | fixed in code, verified in harness; **needs owner check** | Renamed Storage place / Saklama yeri with a one-line hint; hidden from the table and sidebar until a part has one (Settings can force it on or off). Existing values are kept. |
| B9 | The app icon looks strange in the Windows taskbar | redesigned; **needs owner check** | New mark with margin and hand-drawn 16, 20, 24 and 32 px versions; `docs/brand/taskbar-preview.png` shows it on light and dark taskbars. Windows may keep the old icon in its cache until sign-out. |
| B8 | Restoring a backup ran even when Cancel was pressed | fixed in code, verified in harness, verified in CI on Windows | Restore asks in the app and waits; Cancel and Escape keep the data, and a restore can itself be undone. The built app in WebView2: Cancel kept the count, Restore brought the backup back, Undo the newer data. |
| B7 | Deleting a project deletes at once, before the confirmation appears | fixed in code, verified in harness, verified in CI on Windows | Every question is an in-app dialog that returns a Promise; `window.confirm` is a lint error and the UI checks record any call. In the built app in WebView2, Cancel in the delete question kept the part. |
| B6 | An unreadable version announced every release; Settings opened by itself | fixed in code, verified in harness | The check is skipped when the version cannot be read and only shows a toast; it never opens Settings. A manual check works even when the automatic one is off. |
| B1 | Extension sends 1 piece, whatever the quantity | fixed in code (view-only events ignored), unit-tested; **needs owner check** | Carried into the TypeScript extension; product pages have a quantity box. |
| B2 | Edit button does nothing | rebuilt; verified in harness | The edit dialog is new; undeclared names are type errors now. |
| B3 | Add / save gives no reaction | rebuilt; verified in harness | Add, the duplicate-code path and save are covered by `npm run test:ui`. |
| B4 | Robocombo, 30-line order: "sent" toast, nothing in the app | fixed in code, verified in extension e2e; **needs owner check** | Links over 1800 characters go as a file; "Dosya olarak kaydet" stays offered after every send. The 30-line Robocombo order is now read from its order page. |
| B5 | MSI build failed on mismatched Tauri packages | fixed, verified in CI on Windows | `@tauri-apps/*` pinned to the crates' minor; CI builds MSI and NSIS on every push. |

## Requests

| # | Request | Status | Notes |
|---|---|---|---|
| R1 | Quantity must be exactly right on import | done for the three shops, verified | Review screen with confidence, pack size and "why this number"; PDF import matches expected.json on all three printed orders; unreadable counts are flagged. |
| R2 | Shops: Özdisan, Direnç.net, Motorobit, Robocombo, Robiz, Robotistan | partly | Order pages: Özdisan, Motorobit, Robocombo (new). Robotistan, Direnç.net, Robiz: structured data only, no order page seen yet. |
| R3 | Inputs: extension, print-to-PDF, Excel/CSV | done except OCR | Scanned PDFs (no text layer) are refused with a clear message; OCR is not built. |
| R4 | Table without pages, fast on thousands of rows | verified in harness and in CI on Windows to 100,000 rows | Scroll, search and sort measured in `npm run test:ui`; a 2,000-line import takes about 1.8 s. In the built app on Windows, 100,000 parts are on screen 2.0 s after starting and a search takes 141 ms. |
| R5 | Bugra theme everywhere | done in the rebuild | Interface, extension panel, icons, installer images, README. |
| R6 | More languages and development standards | done, unreviewed | tr, en, de, ru, zh-CN, ar; each non-English file says `reviewed: false` until a native speaker reads it. |
| R7 | A professional, rebuilt app | done (1.0.0-beta.1, not tagged) | See CHANGELOG.md. |
| R8 | Tooling to capture shop HTML and test the app | done | `tests/ui`, `tests/real-app`, `tools/fixtures`. |

## Things the owner said that shape decisions

- Electrical and electronics engineering student; speaks Turkish; uses the app every day.
- "Quantity must be certain." A wrong count is worse than a missing row.
- The category taxonomy stays English (stored values); labels are localized.
- No telemetry. Optional Drive sync and the GitHub update check are the only network use.
- Nothing is written to the inventory before the review screen is confirmed.
- No AI features (Ollama removed).
