//! Backups: consistent copies made with `VACUUM INTO`, listed newest first, pruned by retention,
//! restored in place with SQLite's online backup API.
//!
//! File names: `backup_YYYYMMDD_HHMMSS-<kind>.db` (local time). The old app wrote
//! `backup_YYYYMMDD_HHMMSS.db`; those are listed as kind "legacy". Migration backups are
//! `pre-migration-v<from>-YYYYMMDD_HHMMSS.db` and are never pruned, nor are manual ones.

use rusqlite::{backup::Backup, Connection};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::components::from_row;
use crate::db::{column_names, open_read_only, table_exists};
use crate::error::{invalid, CoreError, Result};
use crate::model::{BackupEntry, Component};

pub const KINDS: &[&str] = &["auto", "manual", "pre-import", "pre-undo", "pre-bulk", "pre-restore", "pre-delete"];
const NEVER_PRUNED: &[&str] = &["manual", "pre-migration"];

fn stamp() -> String {
    chrono::Local::now().format("%Y%m%d_%H%M%S").to_string()
}

fn unique_path(dir: &Path, base: &str) -> PathBuf {
    let mut p = dir.join(format!("{base}.db"));
    let mut i = 2;
    while p.exists() {
        p = dir.join(format!("{base}_{i}.db"));
        i += 1;
    }
    p
}

/// `VACUUM INTO` writes a complete, consistent copy while the connection stays open.
pub fn vacuum_into(conn: &Connection, target: &Path) -> Result<()> {
    if target.exists() {
        std::fs::remove_file(target)?;
    }
    let p = target.to_str().ok_or_else(|| invalid("the backup path is not valid text"))?;
    conn.execute("VACUUM INTO ?1", [p])?;
    Ok(())
}

pub fn create(conn: &Connection, dir: &Path, kind: &str) -> Result<BackupEntry> {
    if !KINDS.contains(&kind) {
        return Err(invalid(format!("unknown backup kind {kind}")));
    }
    std::fs::create_dir_all(dir)?;
    let path = unique_path(dir, &format!("backup_{}-{kind}", stamp()));
    vacuum_into(conn, &path)?;
    entry_for(&path).ok_or_else(|| CoreError::Io(std::io::Error::other("backup was not written")))
}

/// Copies the database file itself (used before a migration, when the schema may be old).
pub fn copy_before_migration(db_path: &Path, dir: &Path, from_version: i64) -> Result<BackupEntry> {
    std::fs::create_dir_all(dir)?;
    let path = unique_path(dir, &format!("pre-migration-v{from_version}-{}", stamp()));
    std::fs::copy(db_path, &path)?;
    entry_for(&path).ok_or_else(|| CoreError::Io(std::io::Error::other("backup was not written")))
}

fn parse_name(name: &str) -> Option<(String, String)> {
    // Returns (created_at, kind).
    let stem = name.strip_suffix(".db")?;
    let ts_to_text = |ts: &str| -> Option<String> {
        if ts.len() < 15 || !ts.as_bytes()[..8].iter().all(u8::is_ascii_digit) || &ts[8..9] != "_" {
            return None;
        }
        Some(format!("{}-{}-{} {}:{}:{}", &ts[0..4], &ts[4..6], &ts[6..8], &ts[9..11], &ts[11..13], &ts[13..15]))
    };
    if let Some(rest) = stem.strip_prefix("pre-migration-v") {
        let ts = rest.split_once('-').map(|(_, t)| t)?;
        return Some((ts_to_text(ts)?, "pre-migration".into()));
    }
    let rest = stem.strip_prefix("backup_")?;
    let created = ts_to_text(rest)?;
    let tail = &rest[15..];
    if tail.is_empty() || tail.starts_with('_') && tail[1..].chars().all(|c| c.is_ascii_digit()) {
        return Some((created, "legacy".into()));
    }
    let kind = tail.strip_prefix('-')?;
    let kind = kind.split('_').next().unwrap_or(kind);
    if KINDS.contains(&kind) {
        Some((created, kind.to_string()))
    } else {
        None
    }
}

fn entry_for(path: &Path) -> Option<BackupEntry> {
    let name = path.file_name()?.to_str()?.to_string();
    let meta = std::fs::metadata(path).ok()?;
    let (created_at, kind) = parse_name(&name).unwrap_or_else(|| {
        let t: chrono::DateTime<chrono::Local> = meta.modified().map(Into::into).unwrap_or_else(|_| chrono::Local::now());
        (t.format("%Y-%m-%d %H:%M:%S").to_string(), "legacy".into())
    });
    Some(BackupEntry { file_name: name, path: path.to_string_lossy().into_owned(), created_at, size_bytes: meta.len(), kind })
}

pub fn list(dir: &Path) -> Result<Vec<BackupEntry>> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<BackupEntry> = std::fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("db"))
        .filter_map(|p| entry_for(&p))
        .collect();
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at).then(b.file_name.cmp(&a.file_name)));
    Ok(out)
}

/// Keeps the newest `retention` prunable backups (0 keeps all). Manual and migration backups stay.
pub fn prune(dir: &Path, retention: i64) -> Result<usize> {
    if retention <= 0 {
        return Ok(0);
    }
    let prunable: Vec<BackupEntry> = list(dir)?.into_iter().filter(|e| !NEVER_PRUNED.contains(&e.kind.as_str())).collect();
    let mut removed = 0;
    for e in prunable.iter().skip(retention as usize) {
        if std::fs::remove_file(&e.path).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

/// Resolves a backup file name to its path, refusing anything outside the backup folder.
pub fn resolve(dir: &Path, file_name: &str) -> Result<PathBuf> {
    if file_name.is_empty() || file_name.contains(['/', '\\', ':']) || file_name.starts_with('.') || !file_name.ends_with(".db") {
        return Err(invalid("not a backup file name"));
    }
    let p = dir.join(file_name);
    if !p.is_file() {
        return Err(CoreError::NotFound(format!("backup {file_name}")));
    }
    Ok(p)
}

pub fn check_is_inventory(path: &Path) -> Result<()> {
    let conn = open_read_only(path).map_err(|_| invalid("the file is not a database"))?;
    let ok = table_exists(&conn, "components").map_err(|_| invalid("the file is not a database"))?;
    if !ok {
        return Err(invalid("the file is not a Component Inventory database"));
    }
    Ok(())
}

/// Replaces the content of `conn` with the backup at `path` (the caller migrates afterwards).
pub fn restore_into(conn: &mut Connection, path: &Path) -> Result<()> {
    check_is_inventory(path)?;
    let src = open_read_only(path)?;
    let backup = Backup::new(&src, conn)?;
    backup.run_to_completion(256, Duration::from_millis(0), None)?;
    Ok(())
}

/// Reads parts from a backup of any schema version (missing columns read as empty).
pub fn read_components(path: &Path) -> Result<Vec<Component>> {
    let conn = open_read_only(path)?;
    if !table_exists(&conn, "components")? {
        return Err(invalid("the file is not a Component Inventory database"));
    }
    let have = column_names(&conn, "components")?;
    let cols: Vec<String> = crate::components::COLUMNS
        .split(',')
        .map(|c| c.trim())
        .map(|c| if have.iter().any(|h| h == c) { c.to_string() } else { format!("NULL AS {c}") })
        .collect();
    let mut stmt = conn.prepare(&format!("SELECT {} FROM components", cols.join(", ")))?;
    let rows = stmt.query_map([], from_row)?.collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::parse_name;

    #[test]
    fn names() {
        assert_eq!(parse_name("backup_20261003_104200.db"), Some(("2026-10-03 10:42:00".into(), "legacy".into())));
        assert_eq!(parse_name("backup_20261003_104200-pre-import.db"), Some(("2026-10-03 10:42:00".into(), "pre-import".into())));
        assert_eq!(parse_name("backup_20261003_104200-auto_2.db"), Some(("2026-10-03 10:42:00".into(), "auto".into())));
        assert_eq!(parse_name("pre-migration-v0-20261003_104200.db"), Some(("2026-10-03 10:42:00".into(), "pre-migration".into())));
        assert_eq!(parse_name("notes.db"), None);
    }
}
