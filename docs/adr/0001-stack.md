# 0001. Stack for the rebuilt app

- Status: accepted
- Date: 2026-10-03

## Context

The old app is about 17 000 lines of untyped JavaScript. Every dialog is static HTML wired by element id,
SQL is spread over many modules and runs through `tauri-plugin-sql`, whose connection pool makes a real
transaction impossible. A missing import once killed edit and add silently. The owner asked for a rebuild
(`docs/REBUILD_BRIEF.md`, section 2) and recommended Tauri v2, TypeScript strict, Preact with signals and
Vite, with Rust owning all data.

## Decision

- **Desktop shell: Tauri v2**, kept on the crate versions the owner's laptop already built
  (tauri 2.10, deep-link 2.4.10, single-instance 2.4, dialog 2.6, opener 2.5). The npm packages
  `@tauri-apps/api` and `@tauri-apps/cli` stay on the same minor, pinned exactly.
- **Data: Rust.** A pure library crate, `crates/inventory-core` (rusqlite with bundled SQLite, no Tauri
  dependency), owns the schema, migrations, queries, import batches, backups, exports and the Drive
  snapshot. `cargo test -p inventory-core` runs on Linux. See ADR 0002.
- **Frontend: TypeScript (strict) + Preact 10 + `@preact/signals` + Vite.** Preact is about 4 KB, fast to
  start in WebView2, and its JSX is close enough to the Bugra React components that they were ported by
  hand (the Bugra bundle reads `window.React` and loads Google Fonts, which the app's CSP forbids).
  Component class names follow `docs/design/bugra/components/bundle.css`.
- **Only `src/api/` calls `invoke`.** Every command is coarse and typed; argument and result types live in
  `src/api/types.ts` and mirror the Rust structs.
- **Shared extension format: `packages/cinv`** (TypeScript types, validator, deep-link codec) is imported
  by both the app and the extension.
- **Extension: Manifest V3 in TypeScript**, bundled with Vite into `extension/dist`.
- **Tests:** Vitest (unit and component, jsdom), `cargo test`, a Playwright UI harness that drives the
  built frontend against the real Rust core through a small stdio bridge (ADR 0004), the extension e2e,
  and a real-app run on Windows in CI over the WebView2 debugging port.
- **Lint:** ESLint with typescript-eslint (TypeScript 6.0, the newest version typescript-eslint supports),
  `no-undef`, `eqeqeq`, no unused variables, plus a script that rejects hard-coded colors outside the
  token file.

## Consequences

- Building needs Rust and Node; the Windows truth comes from GitHub Actions on `windows-latest`.
- The old app stays buildable on `rebuild-prep` / `ccr-dc6c3362-vvd4fw` until the owner accepts this one.
- Moving SQL to Rust makes imports atomic and undoable, at the cost of writing the data layer twice
  (old app, new app) during the transition.
