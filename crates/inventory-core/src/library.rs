//! The bundled, read-only reference library (`patched.db`, about 60 000 parts). Opened on first
//! use; an index of normalized part numbers makes a 2 000-code look-up instant.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use rusqlite::{params, Connection, OpenFlags};

use crate::db::{json_object, opt_f64, text};
use crate::error::{invalid, Result};
use crate::model::LibraryPart;

const COLUMNS: &str = "part_code, mpn, category, subcategory, package, manufacturer, description, datasheet_url, \
    voltage_max, current_max, resistance, tolerance, power_rating, attributes";

pub struct Library {
    path: PathBuf,
    conn: Mutex<Option<Connection>>,
    index: OnceLock<Index>,
}

struct Index {
    exact: HashMap<String, i64>,
    sorted: Vec<(String, i64)>,
}

/// `file:` URI for a path, read-only and immutable. Windows drive paths become `file:///C:/...`.
pub fn sqlite_uri(path: &Path) -> String {
    let raw = path.to_string_lossy().replace('\\', "/");
    let mut enc = String::with_capacity(raw.len() + 16);
    for ch in raw.chars() {
        match ch {
            ' ' => enc.push_str("%20"),
            '%' => enc.push_str("%25"),
            '?' => enc.push_str("%3F"),
            '#' => enc.push_str("%23"),
            c => enc.push(c),
        }
    }
    let prefix = if enc.starts_with('/') { "file://" } else { "file:///" };
    format!("{prefix}{enc}?mode=ro&immutable=1")
}

/// Upper case, letters and digits only: "LM-7805 CT" -> "LM7805CT".
pub fn normalize(code: &str) -> String {
    code.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_uppercase).collect()
}

fn from_row(r: &rusqlite::Row) -> rusqlite::Result<LibraryPart> {
    Ok(LibraryPart {
        part_code: text(r, 0),
        mpn: text(r, 1),
        category: text(r, 2),
        subcategory: text(r, 3),
        package: text(r, 4),
        manufacturer: text(r, 5),
        description: text(r, 6),
        datasheet_url: text(r, 7),
        voltage_max: opt_f64(r, 8),
        current_max: opt_f64(r, 9),
        resistance: text(r, 10),
        tolerance: text(r, 11),
        power_rating: opt_f64(r, 12),
        attributes: json_object(r, 13),
    })
}

impl Library {
    pub fn new(path: PathBuf) -> Self {
        Library { path, conn: Mutex::new(None), index: OnceLock::new() }
    }

    pub fn available(&self) -> bool {
        self.path.is_file()
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let mut guard = self.conn.lock().map_err(|_| invalid("library lock poisoned"))?;
        if guard.is_none() {
            if !self.available() {
                return Err(crate::error::CoreError::NotFound("the built-in library is not installed".into()));
            }
            // The bundled file is in WAL mode; `immutable=1` reads it without creating -shm/-wal
            // files, which an install folder under Program Files would not allow.
            let c = Connection::open_with_flags(
                sqlite_uri(&self.path),
                OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )?;
            *guard = Some(c);
        }
        f(guard.as_ref().expect("opened above"))
    }

    fn index(&self) -> Result<&Index> {
        if let Some(i) = self.index.get() {
            return Ok(i);
        }
        let built = self.with_conn(|c| {
            let mut stmt = c.prepare("SELECT id, part_code, mpn FROM components")?;
            let mut exact = HashMap::new();
            let mut sorted = Vec::new();
            for row in stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, text(r, 1), text(r, 2))))? {
                let (id, code, mpn) = row?;
                for key in [normalize(&code), normalize(&mpn)] {
                    if key.is_empty() {
                        continue;
                    }
                    exact.entry(key.clone()).or_insert(id);
                    sorted.push((key, id));
                }
            }
            sorted.sort();
            sorted.dedup_by(|a, b| a.0 == b.0);
            Ok(Index { exact, sorted })
        })?;
        Ok(self.index.get_or_init(|| built))
    }

    fn by_id(&self, id: i64) -> Result<Option<LibraryPart>> {
        self.with_conn(|c| {
            let mut stmt = c.prepare_cached(&format!("SELECT {COLUMNS} FROM components WHERE id = ?1"))?;
            let mut rows = stmt.query_map([id], from_row)?;
            Ok(rows.next().transpose()?)
        })
    }

    /// Free-text search over part number, MPN and description.
    pub fn search(&self, term: &str, limit: i64) -> Result<Vec<LibraryPart>> {
        let term = term.trim();
        if term.chars().count() < 2 {
            return Ok(Vec::new());
        }
        let escaped = term.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
        let like = format!("%{escaped}%");
        let prefix = format!("{escaped}%");
        self.with_conn(|c| {
            let mut stmt = c.prepare_cached(&format!(
                "SELECT {COLUMNS} FROM components
                  WHERE part_code LIKE ?1 ESCAPE '\\' OR mpn LIKE ?1 ESCAPE '\\' OR description LIKE ?1 ESCAPE '\\'
                  ORDER BY CASE WHEN part_code LIKE ?2 ESCAPE '\\' THEN 0 ELSE 1 END, length(part_code)
                  LIMIT ?3"
            ))?;
            let rows = stmt.query_map(params![like, prefix, limit.clamp(1, 100)], from_row)?.collect::<std::result::Result<Vec<_>, _>>()?;
            Ok(rows)
        })
    }

    /// One answer per code: an exact match on the normalized part number or MPN, else the shortest
    /// library number that starts with it. None when nothing matches.
    pub fn lookup(&self, codes: &[String]) -> Result<Vec<Option<LibraryPart>>> {
        let index = self.index()?;
        let mut out = Vec::with_capacity(codes.len());
        for code in codes.iter().take(20_000) {
            let key = normalize(code);
            if key.len() < 3 {
                out.push(None);
                continue;
            }
            let id = index.exact.get(&key).copied().or_else(|| {
                let start = index.sorted.partition_point(|(k, _)| k.as_str() < key.as_str());
                index.sorted[start..].iter().take_while(|(k, _)| k.starts_with(&key)).min_by_key(|(k, _)| k.len()).map(|(_, id)| *id)
            });
            out.push(match id {
                Some(id) => self.by_id(id)?,
                None => None,
            });
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::normalize;

    #[test]
    fn uris() {
        assert_eq!(super::sqlite_uri(std::path::Path::new("/opt/app/patched.db")), "file:///opt/app/patched.db?mode=ro&immutable=1");
        assert_eq!(
            super::sqlite_uri(std::path::Path::new("C:\\Program Files\\Component Inventory\\patched.db")),
            "file:///C:/Program%20Files/Component%20Inventory/patched.db?mode=ro&immutable=1"
        );
    }

    #[test]
    fn normalizes_codes() {
        assert_eq!(normalize("lm-7805 ct"), "LM7805CT");
        assert_eq!(normalize("PIC18F25K22-I/SS"), "PIC18F25K22ISS");
    }
}
