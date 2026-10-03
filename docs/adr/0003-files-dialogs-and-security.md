# 0003. Files, dialogs and security

- Status: accepted
- Date: 2026-10-03

## Context

The old app gave the frontend broad `fs` permissions, a `shell` plugin and no content security policy.
`tauri-plugin-dialog` replaced `window.confirm` with an async function, and code that did not await it
deleted a project and restored a backup the moment the dialog appeared (B7, B8).

## Decision

- **No `window.confirm`, `alert` or `prompt`.** Questions use the in-app Bugra dialog, which returns a
  Promise; every destructive action has a test for its Cancel path. A lint rule forbids the three names.
- **Native file dialogs run in Rust.** Commands such as `pick_component_image`, `pick_schematic`,
  `pick_folder` and `save_export` open the dialog themselves, so the frontend never hands Rust an
  arbitrary path to write. Rust only writes inside the app data folder or to a path the user just picked;
  it only reads paths the user picked (stored in the database) or files in the app data folder.
- **Plugins:** single-instance (with deep links), deep-link, dialog (Rust side only) and opener (Rust side
  only, `https:` links only). `shell`, `sql` and `fs` are removed. The main window's capability is
  `core:default` plus the app's own commands.
- **CSP:** `default-src 'self'`; scripts only from the app; styles from the app (inline style attributes
  are allowed for the virtual table's geometry); images from the app, `data:` and `blob:`; no remote
  connections from the WebView. Network access (update check, the Özdisan look-up) happens in Rust
  against a fixed host list.
- Deep links (`component-inventory://import?z=...`) reach Rust first (single-instance argv or the
  deep-link plugin), are size-capped, and are handed to the frontend as an event; the frontend decodes and
  validates them with `packages/cinv` and shows the review screen. Nothing is written before the owner
  confirms.
- No personal data in logs.
