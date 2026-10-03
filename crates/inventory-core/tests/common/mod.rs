#![allow(dead_code)]

use std::path::{Path, PathBuf};

use inventory_core::Core;
use tempfile::TempDir;

pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

/// A data folder holding the owner's old-schema database built from `test-fixtures/db/v0-schema.sql`.
pub fn v0_data_dir() -> TempDir {
    let dir = tempfile::tempdir().unwrap();
    let sql = std::fs::read_to_string(repo_root().join("test-fixtures/db/v0-schema.sql")).unwrap();
    let conn = rusqlite::Connection::open(dir.path().join("component_inventory.db")).unwrap();
    conn.execute_batch(&sql).unwrap();
    drop(conn);
    dir
}

pub fn fresh() -> (TempDir, Core) {
    let dir = tempfile::tempdir().unwrap();
    let core = Core::open(dir.path(), None).unwrap();
    (dir, core)
}
