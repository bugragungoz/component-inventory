//! App settings, one row per key in the `settings` table (JSON values). Unknown keys are kept in the
//! table but ignored; missing keys take their default.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::db::now;
use crate::error::{invalid, Result};

pub const DEFAULT_DRIVE_BASE_NAME: &str = "croxz";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ColumnPref {
    pub key: String,
    pub visible: bool,
}

impl Default for ColumnPref {
    fn default() -> Self {
        ColumnPref { key: String::new(), visible: true }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct SortPref {
    pub column: String,
    pub direction: String,
}

impl Default for SortPref {
    fn default() -> Self {
        SortPref { column: "part_code".into(), direction: "asc".into() }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    /// UI language (`en`, `tr`, ...); None follows the system.
    pub language: Option<String>,
    /// "system", "dark" or "light".
    pub theme: String,
    pub default_quantity: i64,
    /// "detailed" or "simple".
    pub form_mode: String,
    pub low_stock_threshold: i64,
    /// "auto" (shown once any part has one), "show" or "hide".
    pub show_storage_place: String,
    pub backup_interval_minutes: i64,
    /// How many automatic backups to keep; 0 keeps all.
    pub backup_retention: i64,
    pub export_folder: Option<String>,
    pub drive_enabled: bool,
    pub drive_folder: Option<String>,
    pub drive_base_name: String,
    pub update_check: bool,
    pub table_columns: Vec<ColumnPref>,
    pub table_sort: SortPref,
    /// The old app's WebView settings were read once.
    pub legacy_imported: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            language: None,
            theme: "system".into(),
            default_quantity: 1,
            form_mode: "detailed".into(),
            low_stock_threshold: 1,
            show_storage_place: "auto".into(),
            backup_interval_minutes: 15,
            backup_retention: 30,
            export_folder: None,
            drive_enabled: false,
            drive_folder: None,
            drive_base_name: DEFAULT_DRIVE_BASE_NAME.into(),
            update_check: true,
            table_columns: Vec::new(),
            table_sort: SortPref::default(),
            legacy_imported: false,
        }
    }
}

const LANGUAGES: &[&str] = &["en", "tr", "zh-CN", "ru", "de", "ar", "en-XA"];

impl AppSettings {
    fn validate(&self) -> Result<()> {
        if let Some(l) = &self.language {
            if !LANGUAGES.contains(&l.as_str()) {
                return Err(invalid(format!("unknown language {l}")));
            }
        }
        if !["system", "dark", "light"].contains(&self.theme.as_str()) {
            return Err(invalid("theme must be system, dark or light"));
        }
        if !["detailed", "simple"].contains(&self.form_mode.as_str()) {
            return Err(invalid("form_mode must be detailed or simple"));
        }
        if !["auto", "show", "hide"].contains(&self.show_storage_place.as_str()) {
            return Err(invalid("show_storage_place must be auto, show or hide"));
        }
        if !(0..=1_000_000).contains(&self.default_quantity) {
            return Err(invalid("default_quantity is out of range"));
        }
        if !(0..=1_000_000).contains(&self.low_stock_threshold) {
            return Err(invalid("low_stock_threshold is out of range"));
        }
        // 0 turns the automatic backup off; backups before risky steps are always taken.
        if !(0..=24 * 60).contains(&self.backup_interval_minutes) {
            return Err(invalid("backup_interval_minutes must be 0 to 1440"));
        }
        if !(0..=10_000).contains(&self.backup_retention) {
            return Err(invalid("backup_retention is out of range"));
        }
        if !["asc", "desc"].contains(&self.table_sort.direction.as_str()) {
            return Err(invalid("sort direction must be asc or desc"));
        }
        Ok(())
    }
}

/// Removes characters that are not allowed in a Windows file name; empty falls back to the default.
pub fn sanitize_base_name(name: &str) -> String {
    let cleaned: String =
        name.chars().map(|c| if "\\/:*?\"<>|".contains(c) || c.is_whitespace() || c.is_control() { '_' } else { c }).collect();
    let cleaned = cleaned.trim_start_matches('.').chars().take(64).collect::<String>();
    if cleaned.is_empty() {
        DEFAULT_DRIVE_BASE_NAME.to_string()
    } else {
        cleaned
    }
}

fn stored(conn: &Connection) -> Result<Map<String, Value>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let mut map = Map::new();
    for row in stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))? {
        let (k, v) = row?;
        if let Ok(value) = serde_json::from_str::<Value>(&v) {
            map.insert(k, value);
        }
    }
    Ok(map)
}

pub fn get(conn: &Connection) -> Result<AppSettings> {
    let mut base = serde_json::to_value(AppSettings::default())?;
    let stored = stored(conn)?;
    if let Value::Object(obj) = &mut base {
        for (k, v) in stored {
            if obj.contains_key(&k) {
                obj.insert(k, v);
            }
        }
    }
    // A stored value of the wrong shape falls back to the defaults instead of failing the app.
    Ok(serde_json::from_value(base).unwrap_or_default())
}

fn write(conn: &Connection, next: &AppSettings, previous: &AppSettings) -> Result<()> {
    let next_v = serde_json::to_value(next)?;
    let prev_v = serde_json::to_value(previous)?;
    if let (Value::Object(n), Value::Object(p)) = (next_v, prev_v) {
        for (k, v) in n {
            if p.get(&k) != Some(&v) {
                conn.execute(
                    "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    params![k, v.to_string(), now()],
                )?;
            }
        }
    }
    Ok(())
}

/// Applies a partial update from the frontend. Folder paths cannot be set this way; they come only
/// from a folder the user picked in a native dialog (`set_folder`). Clearing them is allowed.
pub fn update(conn: &Connection, patch: &Value) -> Result<AppSettings> {
    let current = get(conn)?;
    let Value::Object(patch) = patch else { return Err(invalid("settings patch must be an object")) };
    let mut merged = serde_json::to_value(&current)?;
    if let Value::Object(obj) = &mut merged {
        for (k, v) in patch {
            if !obj.contains_key(k) {
                return Err(invalid(format!("unknown setting {k}")));
            }
            if (k == "export_folder" || k == "drive_folder") && !v.is_null() {
                return Err(invalid(format!("{k} can only be chosen with the folder dialog")));
            }
            obj.insert(k.clone(), v.clone());
        }
    }
    let mut next: AppSettings = serde_json::from_value(merged).map_err(|e| invalid(e.to_string()))?;
    next.drive_base_name = sanitize_base_name(&next.drive_base_name);
    next.validate()?;
    write(conn, &next, &current)?;
    Ok(next)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FolderKind {
    Export,
    Drive,
}

pub fn set_folder(conn: &Connection, kind: FolderKind, path: Option<String>) -> Result<AppSettings> {
    let current = get(conn)?;
    let mut next = current.clone();
    match kind {
        FolderKind::Export => next.export_folder = path,
        FolderKind::Drive => next.drive_folder = path,
    }
    write(conn, &next, &current)?;
    Ok(next)
}

/// Reads the old app's WebView `localStorage` values once (keys as the old app wrote them).
pub fn import_legacy(conn: &Connection, values: &Map<String, Value>) -> Result<AppSettings> {
    let current = get(conn)?;
    if current.legacy_imported {
        return Ok(current);
    }
    let mut next = current.clone();
    let s = |k: &str| values.get(k).and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let n = |k: &str| s(k).and_then(|v| v.parse::<i64>().ok());
    if let Some(l) = s("locale") {
        if LANGUAGES.contains(&l.as_str()) {
            next.language = Some(l);
        }
    }
    if let Some(t) = s("theme") {
        if t == "dark" || t == "light" {
            next.theme = t;
        }
    }
    if let Some(v) = n("defaultQty") {
        if (0..=1_000_000).contains(&v) {
            next.default_quantity = v;
        }
    }
    if let Some(v) = n("lowStockThreshold") {
        if (0..=1_000_000).contains(&v) {
            next.low_stock_threshold = v;
        }
    }
    if let Some(v) = s("formMode") {
        if v == "simple" || v == "detailed" {
            next.form_mode = v;
        }
    }
    if let Some(v) = s("locationsEnabled") {
        next.show_storage_place = if v == "true" { "show".into() } else { "auto".into() };
    }
    if let Some(v) = n("backupRetention") {
        if (0..=10_000).contains(&v) {
            next.backup_retention = v;
        }
    }
    if let Some(v) = n("backupIntervalMinutes") {
        if (1..=1440).contains(&v) {
            next.backup_interval_minutes = v;
        }
    }
    if let Some(v) = s("exportFolder") {
        next.export_folder = Some(v);
    }
    if let Some(v) = s("driveSyncEnabled") {
        next.drive_enabled = v == "true";
    }
    if let Some(v) = s("driveSyncFolder") {
        next.drive_folder = Some(v);
    }
    if let Some(v) = s("driveSyncBaseName") {
        next.drive_base_name = sanitize_base_name(&v);
    }
    next.legacy_imported = true;
    if next.validate().is_err() {
        // Something odd in the old values: keep the defaults, but never ask again.
        let mut fallback = current.clone();
        fallback.legacy_imported = true;
        write(conn, &fallback, &current)?;
        return Ok(fallback);
    }
    write(conn, &next, &current)?;
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_name_is_a_safe_file_name() {
        assert_eq!(sanitize_base_name("my inventory"), "my_inventory");
        assert_eq!(sanitize_base_name("..\\evil/name"), "_evil_name");
        assert_eq!(sanitize_base_name(""), "croxz");
        assert_eq!(sanitize_base_name("..."), "croxz");
    }
}
