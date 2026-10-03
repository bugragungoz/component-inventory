//! Schema and migrations, keyed by `PRAGMA user_version`.
//!
//! Version 0 is the old app's database (created by `src/app.js` with columns added later by
//! `ALTER TABLE` in try/catch, so an old file may lack some of them). Version 1 is the rebuilt app.
//! The caller backs the file up before `migrate` runs; every migration runs in one transaction.

use rusqlite::{params, Connection, Transaction};

use crate::db::{has_column, table_exists, user_version};
use crate::error::{CoreError, Result};
use crate::model::{MigrationReport, UNCATEGORIZED};
use crate::taxonomy::normalize_category;

pub const CURRENT_VERSION: i64 = 1;

const V1_TABLES: &str = r#"
CREATE TABLE components (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  part_code          TEXT UNIQUE NOT NULL,
  category           TEXT DEFAULT '',
  subcategory        TEXT DEFAULT '',
  quantity           INTEGER DEFAULT 0,
  package            TEXT DEFAULT '',
  manufacturer       TEXT DEFAULT '',
  mpn                TEXT DEFAULT '',
  location           TEXT DEFAULT '',
  voltage_max        REAL,
  current_max        REAL,
  description        TEXT DEFAULT '',
  datasheet_url      TEXT DEFAULT '',
  unit_price         REAL,
  notes              TEXT DEFAULT '',
  image_path         TEXT DEFAULT '',
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now')),
  resistance         TEXT DEFAULT '',
  tolerance          TEXT DEFAULT '',
  power_rating       REAL,
  attributes         TEXT DEFAULT '{}',
  preferred_supplier TEXT DEFAULT '',
  custom_fields      TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE stock_movements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id    INTEGER NOT NULL,
  part_code       TEXT NOT NULL,
  delta           INTEGER NOT NULL,
  quantity_after  INTEGER NOT NULL,
  reason          TEXT DEFAULT '',
  created_at      TEXT DEFAULT (datetime('now')),
  import_batch_id INTEGER
);

CREATE TABLE projects (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  description    TEXT DEFAULT '',
  schematic_path TEXT DEFAULT '',
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now')),
  notes          TEXT DEFAULT '',
  order_index    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE project_components (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   INTEGER NOT NULL,
  component_id INTEGER NOT NULL,
  required_qty INTEGER NOT NULL DEFAULT 1,
  note         TEXT DEFAULT '',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, component_id)
);

CREATE TABLE custom_columns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  col_key      TEXT NOT NULL UNIQUE,
  col_label    TEXT NOT NULL,
  col_type     TEXT DEFAULT 'text',
  is_visible   INTEGER DEFAULT 1,
  order_index  INTEGER DEFAULT 0
);
"#;

/// Tables that version 1 adds to an old database (and creates in a new one).
const V1_ADDITIONS: &str = r#"
CREATE TABLE IF NOT EXISTS import_batches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  source_label TEXT NOT NULL DEFAULT '',
  source_kind  TEXT NOT NULL DEFAULT '',
  mode         TEXT NOT NULL,
  row_count    INTEGER NOT NULL DEFAULT 0,
  created      INTEGER NOT NULL DEFAULT 0,
  updated      INTEGER NOT NULL DEFAULT 0,
  removed      INTEGER NOT NULL DEFAULT 0,
  pieces       INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'applied',
  undone_at    TEXT,
  backup_file  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS import_batch_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id     INTEGER NOT NULL,
  seq          INTEGER NOT NULL,
  component_id INTEGER NOT NULL,
  part_code    TEXT NOT NULL,
  action       TEXT NOT NULL,
  qty_before   INTEGER NOT NULL DEFAULT 0,
  qty_after    INTEGER NOT NULL DEFAULT 0,
  before_json  TEXT,
  after_json   TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS migration_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  version    INTEGER NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  message    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_components_category ON components(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_movements_component ON stock_movements(component_id);
CREATE INDEX IF NOT EXISTS idx_movements_batch ON stock_movements(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_bom_project ON project_components(project_id);
CREATE INDEX IF NOT EXISTS idx_bom_component ON project_components(component_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON import_batch_items(batch_id);
"#;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DbState {
    Empty,
    Version(i64),
}

pub fn detect(conn: &Connection) -> Result<DbState> {
    let v = user_version(conn)?;
    if v == 0 && !table_exists(conn, "components")? {
        return Ok(DbState::Empty);
    }
    Ok(DbState::Version(v))
}

/// True when `migrate` would change the file (the caller backs it up first).
pub fn needs_migration(conn: &Connection) -> Result<bool> {
    match detect(conn)? {
        DbState::Empty => Ok(false),
        DbState::Version(v) if v > CURRENT_VERSION => Err(CoreError::NewerSchema(v)),
        DbState::Version(v) => Ok(v < CURRENT_VERSION),
    }
}

/// Creates a fresh database or brings an old one to `CURRENT_VERSION`.
pub fn migrate(conn: &mut Connection) -> Result<MigrationReport> {
    let state = detect(conn)?;
    let mut report = MigrationReport { to_version: CURRENT_VERSION, ..Default::default() };
    match state {
        DbState::Empty => {
            let tx = conn.transaction()?;
            tx.execute_batch(V1_TABLES)?;
            tx.execute_batch(V1_ADDITIONS)?;
            log(&tx, 1, "created a new database (schema 1)")?;
            tx.pragma_update(None, "user_version", CURRENT_VERSION)?;
            tx.commit()?;
            report.from_version = CURRENT_VERSION;
            report.messages.push("created a new database".into());
        }
        DbState::Version(v) if v > CURRENT_VERSION => return Err(CoreError::NewerSchema(v)),
        DbState::Version(v) => {
            report.from_version = v;
            let mut version = v;
            while version < CURRENT_VERSION {
                let tx = conn.transaction()?;
                let msgs = match version {
                    0 => migrate_0_to_1(&tx)?,
                    other => return Err(CoreError::Invalid(format!("no migration from schema {other}"))),
                };
                version += 1;
                for m in &msgs {
                    log(&tx, version, m)?;
                }
                tx.pragma_update(None, "user_version", version)?;
                tx.commit()?;
                report.messages.extend(msgs);
            }
        }
    }
    Ok(report)
}

fn log(tx: &Transaction, version: i64, message: &str) -> Result<()> {
    tx.execute("INSERT INTO migration_log (version, message) VALUES (?1, ?2)", params![version, message])?;
    Ok(())
}

fn add_column_if_missing(tx: &Transaction, table: &str, column: &str, decl: &str, msgs: &mut Vec<String>) -> Result<()> {
    if !has_column(tx, table, column)? {
        tx.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"))?;
        msgs.push(format!("added missing column {table}.{column}"));
    }
    Ok(())
}

fn migrate_0_to_1(tx: &Transaction) -> Result<Vec<String>> {
    let mut msgs = Vec::new();

    // The migration log itself first, so every step below can be recorded.
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS migration_log (
           id INTEGER PRIMARY KEY AUTOINCREMENT, version INTEGER NOT NULL,
           applied_at TEXT NOT NULL DEFAULT (datetime('now')), message TEXT NOT NULL);",
    )?;

    // 1. Tables and columns the old app created lazily.
    for (table, ddl) in [
        ("stock_movements", "CREATE TABLE stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, component_id INTEGER NOT NULL, part_code TEXT NOT NULL, delta INTEGER NOT NULL, quantity_after INTEGER NOT NULL, reason TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))"),
        ("projects", "CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', schematic_path TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"),
        ("project_components", "CREATE TABLE project_components (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, component_id INTEGER NOT NULL, required_qty INTEGER NOT NULL DEFAULT 1, note TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(project_id, component_id))"),
        ("custom_columns", "CREATE TABLE custom_columns (id INTEGER PRIMARY KEY AUTOINCREMENT, col_key TEXT NOT NULL UNIQUE, col_label TEXT NOT NULL, col_type TEXT DEFAULT 'text', is_visible INTEGER DEFAULT 1, order_index INTEGER DEFAULT 0)"),
    ] {
        if !table_exists(tx, table)? {
            tx.execute_batch(ddl)?;
            msgs.push(format!("created missing table {table}"));
        }
    }
    for (column, decl) in [
        ("image_path", "TEXT DEFAULT ''"),
        ("resistance", "TEXT DEFAULT ''"),
        ("tolerance", "TEXT DEFAULT ''"),
        ("power_rating", "REAL"),
        ("attributes", "TEXT DEFAULT '{}'"),
        ("preferred_supplier", "TEXT DEFAULT ''"),
    ] {
        add_column_if_missing(tx, "components", column, decl, &mut msgs)?;
    }
    add_column_if_missing(tx, "projects", "notes", "TEXT DEFAULT ''", &mut msgs)?;
    add_column_if_missing(tx, "projects", "order_index", "INTEGER NOT NULL DEFAULT 0", &mut msgs)?;

    // 2. New columns.
    tx.execute_batch("ALTER TABLE components ADD COLUMN custom_fields TEXT NOT NULL DEFAULT '{}'")?;
    tx.execute_batch("ALTER TABLE stock_movements ADD COLUMN import_batch_id INTEGER")?;
    msgs.push("added components.custom_fields and stock_movements.import_batch_id".into());

    // 3. NULL text becomes empty text, so every reader sees the same shape.
    let mut nulls = 0usize;
    for column in [
        "category",
        "subcategory",
        "package",
        "manufacturer",
        "mpn",
        "location",
        "description",
        "datasheet_url",
        "notes",
        "image_path",
        "resistance",
        "tolerance",
        "preferred_supplier",
    ] {
        nulls += tx.execute(&format!("UPDATE components SET {column} = '' WHERE {column} IS NULL"), [])?;
    }
    if nulls > 0 {
        msgs.push(format!("replaced {nulls} empty (NULL) text values with empty text"));
    }

    // 4. Attributes must be a JSON object. Anything else is kept under "_legacy", never dropped.
    {
        let mut stmt = tx.prepare("SELECT id, part_code, attributes FROM components")?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, crate::db::text(r, 2))))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        drop(stmt);
        for (id, code, raw) in rows {
            let trimmed = raw.trim();
            let fixed = if trimmed.is_empty() {
                Some("{}".to_string())
            } else {
                match serde_json::from_str::<serde_json::Value>(trimmed) {
                    Ok(serde_json::Value::Object(_)) => None,
                    _ => {
                        let mut m = serde_json::Map::new();
                        m.insert("_legacy".into(), serde_json::Value::String(raw.clone()));
                        msgs.push(format!("{code}: attributes were not a JSON object, kept under \"_legacy\""));
                        Some(serde_json::Value::Object(m).to_string())
                    }
                }
            };
            if let Some(v) = fixed {
                tx.execute("UPDATE components SET attributes = ?1 WHERE id = ?2", params![v, id])?;
            }
        }
    }

    // 5. Quantities: whole numbers stored as REAL or TEXT become INTEGER; a fractional one is
    //    rounded and the original value is written into the part's notes.
    {
        let mut stmt = tx.prepare("SELECT id, part_code, quantity, notes FROM components WHERE typeof(quantity) <> 'integer'")?;
        let rows = stmt
            .query_map([], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, rusqlite::types::Value>(2)?, crate::db::text(r, 3)))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        drop(stmt);
        for (id, code, value, notes) in rows {
            let (n, original) = match value {
                rusqlite::types::Value::Real(f) => (f, f.to_string()),
                rusqlite::types::Value::Text(t) => (t.trim().replace(',', ".").parse::<f64>().unwrap_or(0.0), t),
                _ => (0.0, String::from("empty")),
            };
            let rounded = if n.is_finite() && n > 0.0 { n.round() as i64 } else { 0 };
            if (rounded as f64 - n).abs() > f64::EPSILON {
                let note = format!("[migration] quantity was {original}, set to {rounded}");
                let notes = if notes.is_empty() { note.clone() } else { format!("{notes}\n{note}") };
                tx.execute("UPDATE components SET quantity = ?1, notes = ?2 WHERE id = ?3", params![rounded, notes, id])?;
                msgs.push(format!("{code}: quantity {original} rounded to {rounded} (noted on the part)"));
            } else {
                tx.execute("UPDATE components SET quantity = ?1 WHERE id = ?2", params![rounded, id])?;
            }
        }
        let negatives = tx.execute("UPDATE components SET quantity = 0, notes = CASE WHEN notes = '' THEN '[migration] quantity was negative, set to 0' ELSE notes || char(10) || '[migration] quantity was negative, set to 0' END WHERE quantity < 0", [])?;
        if negatives > 0 {
            msgs.push(format!("{negatives} negative quantities set to 0 (noted on each part)"));
        }
    }

    // 6. Legacy category names fold into the taxonomy; user-made categories stay.
    {
        let mut stmt = tx.prepare("SELECT category, COUNT(*) FROM components GROUP BY category")?;
        let cats = stmt.query_map([], |r| Ok((crate::db::text(r, 0), r.get::<_, i64>(1)?)))?.collect::<std::result::Result<Vec<_>, _>>()?;
        drop(stmt);
        for (cat, count) in cats {
            let canon = normalize_category(&cat);
            if canon != cat {
                tx.execute("UPDATE components SET category = ?1 WHERE category = ?2", params![canon, cat])?;
                let shown = if cat.is_empty() { "(empty)".to_string() } else { format!("\"{cat}\"") };
                msgs.push(format!("category {shown} -> \"{canon}\" ({count} parts)"));
            } else if !crate::taxonomy::CANONICAL_CATEGORIES.contains(&canon.as_str()) && canon != UNCATEGORIZED {
                msgs.push(format!("category \"{canon}\" kept as a custom category ({count} parts)"));
            }
        }
    }

    // 7. The shortage is derived from stock; the old typed-in column goes. Nothing reads it.
    if has_column(tx, "project_components", "missing_qty")? {
        tx.execute_batch("ALTER TABLE project_components DROP COLUMN missing_qty")?;
        msgs.push("dropped project_components.missing_qty (shortage is now always max(0, required - stock))".into());
    }

    // 8. BOM lines and movements of parts that no longer exist (the old app could orphan them).
    let orphans = tx.execute(
        "DELETE FROM project_components WHERE component_id NOT IN (SELECT id FROM components) OR project_id NOT IN (SELECT id FROM projects)",
        [],
    )?;
    if orphans > 0 {
        msgs.push(format!("removed {orphans} BOM lines that pointed at deleted parts or projects"));
    }

    // 9. New tables and indexes.
    tx.execute_batch(V1_ADDITIONS)?;

    let counts: (i64, i64, i64, i64) = tx.query_row(
        "SELECT (SELECT COUNT(*) FROM components), (SELECT COUNT(*) FROM stock_movements),
                (SELECT COUNT(*) FROM projects), (SELECT COUNT(*) FROM project_components)",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )?;
    msgs.push(format!(
        "schema 0 -> 1 done: {} parts, {} stock movements, {} projects, {} BOM lines",
        counts.0, counts.1, counts.2, counts.3
    ));
    Ok(msgs)
}
