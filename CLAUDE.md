# Component Inventory

Windows desktop app: a Rust core that owns the data (`crates/inventory-core`), a Tauri v2 shell
(`src-tauri`), a TypeScript + Preact interface on the Bugra design system (`src`), and a Manifest V3
browser extension (`extension`) that shares the `packages/cinv` format with the app. Read
`docs/REBUILD_BRIEF.md` for the owner's decisions, `docs/STATE.md` for where the work stands,
`docs/FEEDBACK.md` for what the owner reported, `docs/adr/` for why things are as they are, and
`docs/design/bugra/README.md` before touching the interface.

Talk to the owner in Turkish. Write code, comments, commits and docs in English.

## Commands

```bash
npm ci                    # install (ci: the lockfile pins @tauri-apps/* to the Rust crates)
npm run dev               # the app
npm run verify            # versions, tokens, locales, lint, colors, types, unit tests
cargo test --workspace    # the Rust core and shell
npm run test:ui           # the built UI in Chromium against the real core (tests/ui)
npm run test:ext          # the built extension in Chromium on the fixture order pages
npm run shots             # README screenshots (synthetic data)
npm run brand             # app icons, installer images, social images
npm run build             # Windows installers (on Windows)
```

`npm run verify` and the Rust tests before every commit; `test:ui` when the interface changed;
`test:ext` when the extension changed. If you changed Rust and did not compile it, say so.

## Rules

- Evidence over assertion: keep *verified* (you ran it and saw it), *unit-tested* and *not verified*
  apart in every report.
- Counts are exact: `parseQuantity` for shop numbers, `parseUserQuantity` for what the owner types.
  Unreadable values are reported, never guessed.
- Nothing reaches the inventory without the review screen; bulk writes take a backup and can be undone.
- Data goes through Rust commands only (`crates/inventory-core/src/api.rs`, `for_each_command!`).
- Never `window.confirm`, `alert` or `prompt`: use `confirm()` from `src/state/dialogs.ts`.
- Bugra: tokens only for color, no all-caps labels, no emoji, pills, borders instead of shadows except on
  floating layers, a 2 px focus ring; additions are marked "(added)" and listed in `docs/design/ADDED.md`.
- Every visible string goes through `t()` with keys in all six locale files (`npm run check:locales`).
- Real shop pages hold personal data: only scrubbed fixtures go into `test-fixtures/`.
- No model or tool names in code, commits or docs; the only exception is the last line of the READMEs,
  which credits the model at the owner's request.
- One topic per commit, imperative subject, a body that says why. Never force-push, rewrite history,
  delete a branch or merge to `master` without the owner's go-ahead.
- Never place an order, submit a shop form, or read cookies or passwords while testing a shop.
