//! Google Drive (or any synced folder) snapshot. Not an API integration: the app writes
//! `<base>.xlsx`, `<base>.json` and `<base>.db` into a folder the owner picked inside their Drive for
//! Desktop folder; Drive uploads them. Each file is written to a temporary name and then renamed, so
//! the sync client never sees half a file.

use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::backup::vacuum_into;
use crate::error::{invalid, Result};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SyncStatus {
    /// "off", "ok", "error", "pending"
    pub state: String,
    pub folder: Option<String>,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub files: Vec<String>,
}

fn tmp_name(target: &Path) -> PathBuf {
    let name = target.file_name().and_then(|n| n.to_str()).unwrap_or("snapshot");
    target.with_file_name(format!(".{name}.tmp"))
}

pub fn atomic_write(target: &Path, bytes: &[u8]) -> Result<()> {
    let tmp = tmp_name(target);
    std::fs::write(&tmp, bytes)?;
    // rename over an existing file is atomic on NTFS when the target is not open elsewhere; when it
    // is (Drive holding it), remove first and retry once.
    if std::fs::rename(&tmp, target).is_err() {
        let _ = std::fs::remove_file(target);
        std::fs::rename(&tmp, target)?;
    }
    Ok(())
}

pub fn check_folder(folder: &str) -> Result<PathBuf> {
    let p = PathBuf::from(folder);
    if !p.is_absolute() {
        return Err(invalid("the sync folder must be an absolute path"));
    }
    std::fs::create_dir_all(&p)?;
    Ok(p)
}

pub fn write_snapshot(conn: &Connection, folder: &str, base: &str) -> Result<Vec<String>> {
    let dir = check_folder(folder)?;
    let base = crate::settings::sanitize_base_name(base);
    let components = crate::components::list(conn)?;
    let custom = crate::custom_columns::list(conn)?;

    let xlsx_path = dir.join(format!("{base}.xlsx"));
    atomic_write(&xlsx_path, &crate::export::xlsx(&components, &custom)?)?;

    let json_path = dir.join(format!("{base}.json"));
    atomic_write(&json_path, &crate::export::json(&components)?)?;

    let db_path = dir.join(format!("{base}.db"));
    let tmp = tmp_name(&db_path);
    vacuum_into(conn, &tmp)?;
    if std::fs::rename(&tmp, &db_path).is_err() {
        let _ = std::fs::remove_file(&db_path);
        std::fs::rename(&tmp, &db_path)?;
    }

    Ok(vec![xlsx_path.to_string_lossy().into_owned(), json_path.to_string_lossy().into_owned(), db_path.to_string_lossy().into_owned()])
}
