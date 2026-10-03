# Changelog

Versions follow `1.0.0-beta.N` until 1.0.0 (docs/adr/0006-versions-and-releases.md). Dates are when a
version was tagged.

## 1.0.0-beta.4 (2026-10-03)

### Fixed

- The table sort chosen last time is restored at start (it was saved but never read back).

## 1.0.0-beta.3 (not released)

### Fixed

- After the column order was saved, the part code and the count moved to the far end of the table, off
  screen once columns fit their text. Fixed columns keep their place, and the description is the one
  flexible column, so nothing important needs sideways scrolling.
- Sidebar names break only between words; the sidebar is a little wider.
- One send from the extension could reach the app two or three times and then open the same review
  again after Cancel; repeats within 15 seconds are ignored.

## 1.0.0-beta.2 (not released)

The first round of the owner's checks on their laptop.

### Fixed

- A list sent from the extension could vanish without a word: an error while opening it was
  swallowed, and a second list replaced the open review. Errors now show with the file fallback, lists
  wait their turn, and the window comes to the front.
- The status bar said "Drive synced -" before anything was written; the Drive copy is now written once
  at start, so the phone's sheet matches the database.
- Names are no longer cut with "...": table columns fit their header and longest value, and the
  sidebar, review notes and paths wrap. Notices sit at the start so they do not cover the main buttons.
- The owner's own categories (kept from the old app) had a tag icon; they and their subcategories now
  have fitting icons, several redrawn (soldering iron, toroid core, pliers, screwdriver, PCB, solder
  spool, jar, gear, ASIC, shield, fuses, a four-diode bridge, LED arrows, relay).
- The shop is spelled Özdisan. The public README and changelog no longer name the shops.
- `npm run verify` and `clippy -D warnings` failed on a Windows checkout; the extension e2e failed on
  Windows paths; the real-app test deleted the data folder wherever it ran (now CI only).

### Added

- Move chosen parts to a storage place, and rename a place for all its parts (both with a backup).

### Changed

- No wand icons on the guess buttons and on auto-categorize; the schematic tab shows a page icon.
- Turkish is no longer marked "not reviewed" (the owner reads it).

## 1.0.0-beta.1 (not released)

A rebuild from scratch on the owner's brief (docs/REBUILD_BRIEF.md). Your database is opened, copied to
`backups/pre-migration-v0-*.db` and moved to the new format on the first start.

### Added

- A Rust core (`crates/inventory-core`) that owns all data: schema migrations with a copy kept before
  each one, atomic imports, Undo for imports, deletes, bulk changes and restores, backups with a diff
  against the current inventory, Excel/CSV/JSON export, and the Drive copy written atomically.
- Import review for every source: per-line confidence, editable count and pack size, "why this number",
  column mapping, exclusion, add / set / replace, and an import history with Undo.
- PDF import that reads printed order and cart pages by their quantities (verified on real order
  pages of three supported shops printed to PDF).
- A third order page extractor in the extension (30 lines, 114 pieces on the real page), with cancelled
  lines left out and count x unit price checked against the line total.
- A part library lookup in the add dialog and the import, mapped into the app's own categories.
- Projects with a KiCad, PDF or image schematic, and a parts list built from a KiCad schematic.
- Label sheets with QR codes and a PDF inventory list, both correct in every language.
- Storage place (TR "Saklama yeri"): optional, hidden until a part has one (B10).
- German, Russian, Simplified Chinese and Arabic (right to left), marked unreviewed.
- An icon for every category and subcategory; a new app icon that reads on light and dark taskbars (B9);
  installer images.
- UI checks on the real core (`npm run test:ui`), the extension in Chromium (`npm run test:ext`), and the
  built app in WebView2 on Windows CI.

### Changed

- The interface is rebuilt in TypeScript with Preact on the Bugra design system; the table renders only
  the rows in view.
- Quantities typed by hand are read in the interface language; shop numbers keep the shop rule
  (`1.000` is a thousand).
- A product without a part number from a shop that sells packs is kept under its name without "- N Adet", so packs of
  10 and of 50 of the same resistor end up on one part.
- A long file (an old inventory sheet) opens in the review at once; its lines are drawn as the list
  is scrolled.
- The update check only shows a notice; it never opens Settings (B6).

### Removed

- The Ollama / AI features, as the owner decided.

### Fixed

- B6: an unreadable app version announced every release as an update.
- B7, B8: deleting a project and restoring a backup ran before the question was answered. Every question
  is now an in-app dialog that waits for the answer; `window.confirm` is a lint error.
- B11: "8'li DIP Switch" and "16'lı Entegre Soketi" were read as packs of 8 and 16. Only "- N Adet" names at
  the shop that sells packs are packs.
