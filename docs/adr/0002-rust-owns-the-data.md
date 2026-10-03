# 0002. Rust owns the data

- Status: accepted
- Date: 2026-10-03

## Context

The owner's real database (`%APPDATA%\com.bugragungoz.component-inventory\component_inventory.db`,
`user_version = 0`, 635 components, 2942 stock movements) must open in the new app without loss. The old
app wrote through `tauri-plugin-sql`; a failure halfway through an import left half a file written.

## Decision

- One `rusqlite::Connection` behind a mutex in `inventory-core::Core`. All SQL lives in that crate.
- **Migrations are keyed by `PRAGMA user_version`.** Before the first migration runs, the database file is
  copied to `backups/pre-migration-v<from>-<timestamp>.db`. Each migration runs in one transaction and
  writes what it did to `migration_log` (legacy category names folded, columns moved).
- **Schema v1** keeps every old column and adds: `stock_movements.import_batch_id`, the `import_batches`
  and `import_batch_items` tables, a `settings` table (key, JSON value), `components.custom_fields` (JSON,
  values of the user's custom columns) and `migration_log`. `project_components.missing_qty` is dropped:
  nothing reads it, the shortage is always `max(0, required - stock)`.
- **Imports are atomic and undoable.** One transaction per import; every row it creates, changes or
  removes is recorded in `import_batch_items` with its state before; every stock movement it writes
  carries the batch id. "Undo this import" reverses only that batch and refuses fields that were edited
  later.
- **Settings move into the database.** On the first start the frontend reads the old WebView
  `localStorage` keys once and hands them to `import_legacy_settings`.
- Backups use `VACUUM INTO` (a consistent copy while the connection is open); restore copies a backup
  back with SQLite's online backup API after taking a safety backup.
- The Drive snapshot (`<base>.xlsx`, `<base>.json`, `<base>.db`) is written in Rust with
  `rust_xlsxwriter`, each file to a temporary name first and then renamed.

## Consequences

- The frontend never builds SQL and cannot reach the database file directly; `tauri-plugin-sql` and
  `tauri-plugin-fs` are gone.
- A test loads `test-fixtures/db/v0-schema.sql`, migrates it and checks every row survives.
