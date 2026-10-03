//! Connection setup and tolerant row readers. Old databases hold NULLs, REAL quantities and
//! malformed JSON in places; readers here never fail on those, they fall back to a default.

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{Connection, OpenFlags, Row};
use serde_json::{Map, Value};
use std::path::Path;

use crate::error::Result;

pub fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    configure(&conn)?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    Ok(conn)
}

pub fn open_read_only(path: &Path) -> Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> Result<()> {
    // The default rollback journal keeps the database a single file, which the Drive snapshot and
    // the owner's own copies rely on.
    conn.execute_batch(
        "PRAGMA synchronous = FULL;
         PRAGMA busy_timeout = 5000;
         PRAGMA temp_store = MEMORY;",
    )?;
    Ok(())
}

pub fn user_version(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("PRAGMA user_version", [], |r| r.get(0))?)
}

pub fn table_exists(conn: &Connection, name: &str) -> Result<bool> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1", [name], |r| r.get(0))?;
    Ok(n > 0)
}

pub fn column_names(conn: &Connection, table: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info(\"{}\")", table.replace('"', "")))?;
    let names = stmt.query_map([], |r| r.get::<_, String>(1))?.collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(names)
}

pub fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    Ok(column_names(conn, table)?.iter().any(|c| c == column))
}

pub fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Text column: NULL and non-text become "".
pub fn text(row: &Row, idx: usize) -> String {
    match row.get_ref(idx) {
        Ok(ValueRef::Text(t)) => String::from_utf8_lossy(t).into_owned(),
        Ok(ValueRef::Integer(i)) => i.to_string(),
        Ok(ValueRef::Real(f)) => f.to_string(),
        _ => String::new(),
    }
}

/// Optional number: NULL, empty text and garbage become None.
pub fn opt_f64(row: &Row, idx: usize) -> Option<f64> {
    match row.get_ref(idx) {
        Ok(ValueRef::Integer(i)) => Some(i as f64),
        Ok(ValueRef::Real(f)) if f.is_finite() => Some(f),
        Ok(ValueRef::Text(t)) => std::str::from_utf8(t).ok().and_then(|s| s.trim().parse::<f64>().ok()).filter(|f| f.is_finite()),
        _ => None,
    }
}

/// Integer column that old rows may hold as REAL or TEXT. Rounds to the nearest whole number.
pub fn int(row: &Row, idx: usize) -> i64 {
    match row.get_ref(idx) {
        Ok(ValueRef::Integer(i)) => i,
        Ok(ValueRef::Real(f)) if f.is_finite() => f.round() as i64,
        Ok(ValueRef::Text(t)) => {
            std::str::from_utf8(t).ok().and_then(|s| s.trim().parse::<f64>().ok()).map(|f| f.round() as i64).unwrap_or(0)
        }
        _ => 0,
    }
}

pub fn opt_int(row: &Row, idx: usize) -> Option<i64> {
    match row.get_ref(idx) {
        Ok(ValueRef::Integer(i)) => Some(i),
        Ok(ValueRef::Real(f)) if f.is_finite() => Some(f.round() as i64),
        _ => None,
    }
}

/// JSON object column. Anything that is not an object becomes `{}`.
pub fn json_object(row: &Row, idx: usize) -> Map<String, Value> {
    let raw = text(row, idx);
    parse_object(&raw)
}

pub fn parse_object(raw: &str) -> Map<String, Value> {
    match serde_json::from_str::<Value>(raw) {
        Ok(Value::Object(m)) => m,
        _ => Map::new(),
    }
}

pub fn sql_opt_f64(v: Option<f64>) -> SqlValue {
    match v {
        Some(f) if f.is_finite() => SqlValue::Real(f),
        _ => SqlValue::Null,
    }
}
