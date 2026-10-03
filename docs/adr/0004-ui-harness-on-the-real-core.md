# 0004. The UI harness drives the real Rust core

- Status: accepted
- Date: 2026-10-03

## Context

The cloud machine has no Windows and no WebView2. The old harness mocked the SQL plugin with
`node:sqlite`, which tested the old JavaScript SQL. With the data in Rust, a JavaScript mock would test a
copy of the logic instead of the logic.

## Decision

- `crates/inventory-bridge` is a small binary that reads JSON lines (`{"id","cmd","args"}`) on stdin,
  calls the same `inventory_core::api` functions the Tauri commands call, and answers on stdout.
- `tests/ui/harness.mjs` builds the frontend with Vite, serves it, starts the bridge on a temporary data
  folder and installs `window.__TAURI_INTERNALS__` so that `invoke` reaches the bridge. Desktop-only
  commands (native dialogs, opening links, deep links, the update check) are mocked in the harness and
  listed there.
- Every external request from the page is aborted and counted; a check fails if any was made.
- The same command list is generated for Tauri and for the bridge from one macro
  (`inventory_core::for_each_command!`), so the two cannot drift.

## Consequences

- The harness proves UI behaviour and data behaviour together on Linux. Only the Tauri shell itself
  (dialogs, deep-link registration, single instance, WebView2) needs the Windows real-app run in CI.
