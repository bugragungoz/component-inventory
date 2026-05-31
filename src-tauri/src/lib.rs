mod backup;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use backup::{BackupEntry, create_backup_file, get_db_path, list_backups, restore_backup_file};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

pub struct AppDataDir(pub Arc<Mutex<PathBuf>>);
pub struct BackupIntervalMinutes(pub Arc<Mutex<u64>>);

/// Path to the bundled patched.db reference library
pub struct BuiltinDbPath(pub PathBuf);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BuiltinComponent {
    pub id: i64,
    pub part_code: String,
    pub category: String,
    pub subcategory: String,
    pub package: String,
    pub manufacturer: String,
    pub description: String,
    pub datasheet_url: String,
    pub voltage_max: Option<f64>,
    pub current_max: Option<f64>,
    pub resistance: String,
    pub tolerance: String,
    pub power_rating: Option<f64>,
    pub attributes: String,
}

// ============================================================
// Backup commands — lock is released before any file I/O
// ============================================================
#[tauri::command]
fn create_backup(retention: Option<usize>, state: State<AppDataDir>) -> Result<BackupEntry, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    create_backup_file(&dir, retention.unwrap_or(30))
}

#[tauri::command]
fn set_backup_interval_minutes(minutes: u64, state: State<BackupIntervalMinutes>) -> Result<(), String> {
    if minutes == 0 {
        return Err("Backup interval must be greater than 0 minutes".into());
    }
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = minutes;
    Ok(())
}

#[tauri::command]
fn list_backups_cmd(state: State<AppDataDir>) -> Result<Vec<BackupEntry>, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    list_backups(&dir)
}

#[tauri::command]
fn restore_backup_cmd(backup_path: String, state: State<AppDataDir>) -> Result<(), String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    restore_backup_file(&dir, &backup_path)
}

#[tauri::command]
fn fetch_url(url: String) -> Result<String, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("URL is empty".into());
    }
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Only http(s) URLs are allowed".into());
    }
    let host = url
        .split('/')
        .nth(2)
        .unwrap_or("")
        .to_ascii_lowercase();
    let allowed = ["www.ozdisan.com", "ozdisan.com"];
    if !allowed.iter().any(|h| host == *h) {
        return Err("URL host is not allowed".into());
    }

    let client = reqwest::blocking::Client::builder()
        .user_agent("ComponentInventory/0.3 (inventory lookup)")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.text().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_data_dir(state: State<AppDataDir>) -> Result<String, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    Ok(dir.to_string_lossy().to_string())
}

// ============================================================
// External (cloud sync) write commands
// Bypass the JS-side fs scope so the user can pick ANY folder
// (Drive for Desktop, OneDrive, Dropbox, ...) without manifest tweaks.
// Atomic via tmp-then-rename so cloud agents never observe partial writes.
// ============================================================

fn ensure_external_dir(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder);
    if !path.is_absolute() {
        return Err("Path must be absolute".into());
    }
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create folder: {e}"))?;
    Ok(path)
}

fn atomic_write(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = target.with_extension(
        format!("{}.tmp", target.extension().and_then(|s| s.to_str()).unwrap_or("part"))
    );
    fs::write(&tmp, bytes).map_err(|e| format!("Write failed: {e}"))?;
    if target.exists() {
        let _ = fs::remove_file(target);
    }
    fs::rename(&tmp, target).map_err(|e| format!("Rename failed: {e}"))?;
    Ok(())
}

#[tauri::command]
fn write_external_file(folder: String, name: String, contents: Vec<u8>) -> Result<String, String> {
    let dir = ensure_external_dir(&folder)?;
    let target = dir.join(&name);
    atomic_write(&target, &contents)?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn copy_db_to_external(folder: String, name: Option<String>, state: State<AppDataDir>) -> Result<String, String> {
    let dir = ensure_external_dir(&folder)?;
    let app_dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    let src = get_db_path(&app_dir);
    if !src.exists() {
        return Err("Database file not found".into());
    }
    let bytes = fs::read(&src).map_err(|e| format!("Read failed: {e}"))?;
    let target = dir.join(name.unwrap_or_else(|| "component_inventory.db".to_string()));
    atomic_write(&target, &bytes)?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn read_external_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(PathBuf::from(path)).map_err(|e| format!("Read failed: {e}"))
}

// ============================================================
// Built-in reference library (patched.db) lookup commands
// ============================================================

/// Helper to build a BuiltinComponent from a row with the standard column order.
fn builtin_from_row(row: &rusqlite::Row) -> rusqlite::Result<BuiltinComponent> {
    Ok(BuiltinComponent {
        id: row.get(0)?,
        part_code:     row.get::<_, String>(1).unwrap_or_default(),
        category:      row.get::<_, String>(2).unwrap_or_default(),
        subcategory:   row.get::<_, String>(3).unwrap_or_default(),
        package:       row.get::<_, String>(4).unwrap_or_default(),
        manufacturer:  row.get::<_, String>(5).unwrap_or_default(),
        description:   row.get::<_, String>(6).unwrap_or_default(),
        datasheet_url: row.get::<_, String>(7).unwrap_or_default(),
        voltage_max:   row.get::<_, Option<f64>>(8).unwrap_or(None),
        current_max:   row.get::<_, Option<f64>>(9).unwrap_or(None),
        resistance:    row.get::<_, String>(10).unwrap_or_default(),
        tolerance:     row.get::<_, String>(11).unwrap_or_default(),
        power_rating:  row.get::<_, Option<f64>>(12).unwrap_or(None),
        attributes:    row.get::<_, String>(13).unwrap_or_default(),
    })
}

#[tauri::command]
fn search_builtin_library(
    search_term: String,
    db_path: State<BuiltinDbPath>,
) -> Result<Vec<BuiltinComponent>, String> {
    if search_term.trim().is_empty() {
        return Ok(vec![]);
    }
    let conn = Connection::open_with_flags(
        &db_path.0,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open builtin DB: {e}"))?;

    let pattern = format!("%{}%", search_term.trim());
    let mut stmt = conn
        .prepare(
            "SELECT id, part_code, category, subcategory, package,
                    manufacturer, description, datasheet_url,
                    voltage_max, current_max, resistance, tolerance,
                    power_rating, attributes
             FROM components
             WHERE part_code LIKE ?1 OR description LIKE ?1 OR category LIKE ?1
             LIMIT 15",
        )
        .map_err(|e| format!("Query prepare error: {e}"))?;

    let rows = stmt
        .query_map([&pattern], builtin_from_row)
        .map_err(|e| format!("Query error: {e}"))?;

    let mut results = Vec::new();
    for row in rows {
        if let Ok(comp) = row { results.push(comp); }
    }
    Ok(results)
}

#[tauri::command]
fn batch_lookup_builtin(
    part_codes: Vec<String>,
    db_path: State<BuiltinDbPath>,
) -> Result<Vec<BuiltinComponent>, String> {
    if part_codes.is_empty() {
        return Ok(vec![]);
    }
    let conn = Connection::open_with_flags(
        &db_path.0,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open builtin DB: {e}"))?;

    fn normalise(s: &str) -> String {
        s.to_uppercase().chars().filter(|c| c.is_alphanumeric()).collect()
    }

    let mut exact_stmt = conn
        .prepare(
            "SELECT id, part_code, category, subcategory, package,
                    manufacturer, description, datasheet_url,
                    voltage_max, current_max, resistance, tolerance,
                    power_rating, attributes
             FROM components
             WHERE UPPER(REPLACE(REPLACE(REPLACE(part_code, '-', ''), ' ', ''), '.', '')) = ?1
             LIMIT 1",
        )
        .map_err(|e| format!("Prepare error: {e}"))?;

    let mut like_stmt = conn
        .prepare(
            "SELECT id, part_code, category, subcategory, package,
                    manufacturer, description, datasheet_url,
                    voltage_max, current_max, resistance, tolerance,
                    power_rating, attributes
             FROM components
             WHERE part_code LIKE ?1
             LIMIT 1",
        )
        .map_err(|e| format!("Prepare error: {e}"))?;

    let mut results = Vec::new();
    for code in &part_codes {
        let norm = normalise(code.trim());
        if norm.is_empty() { continue; }

        if let Ok(Some(comp)) = exact_stmt.query_row([&norm], |row| Ok(Some(builtin_from_row(row)?))) {
            results.push(comp);
            continue;
        }
        let pattern = format!("{}%", code.trim());
        if let Ok(Some(comp)) = like_stmt.query_row([&pattern], |row| Ok(Some(builtin_from_row(row)?))) {
            results.push(comp);
        }
    }
    Ok(results)
}


// Use std::thread to avoid requiring a Tokio runtime context during setup.
fn start_backup_scheduler(data_dir: Arc<Mutex<PathBuf>>, interval_minutes: Arc<Mutex<u64>>) {
    std::thread::Builder::new()
        .name("backup-scheduler".into())
        .spawn(move || {
            loop {
                let mins = interval_minutes
                    .lock()
                    .map(|m| *m)
                    .unwrap_or(15);
                let safe_mins = if mins == 0 { 15 } else { mins };
                std::thread::sleep(std::time::Duration::from_secs(safe_mins * 60));
                if let Ok(dir) = data_dir.lock() {
                    // Scheduler uses default retention (30). Front-end overrides on
                    // explicit user-triggered backups via the `retention` param.
                    let _ = create_backup_file(&dir, 30);
                }
            }
        })
        .ok();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("failed to get app data dir: {e}"))?;

            std::fs::create_dir_all(&data_dir)
                .map_err(|e| format!("failed to create app data dir: {e}"))?;

            backup::ensure_backup_dir(&data_dir)
                .map_err(|e| format!("failed to create backup dir: {e}"))?;

            // Resolve the bundled patched.db from resources.
            // Tauri 2 maps "../patched.db" → "_up_/patched.db" inside the
            // resource directory, so we try several candidate paths.
            let res_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("failed to get resource dir: {e}"))?;

            let candidates = [
                res_dir.join("_up_").join("patched.db"),   // bundled ("../patched.db" → _up_/)
                res_dir.join("patched.db"),                 // flat layout / custom bundle
            ];

            let resource_path = candidates
                .iter()
                .find(|p| p.exists())
                .cloned()
                .unwrap_or_else(|| candidates[0].clone());

            app.manage(BuiltinDbPath(resource_path));

            let data_arc = Arc::new(Mutex::new(data_dir));
            let interval_arc = Arc::new(Mutex::new(15u64));
            app.manage(AppDataDir(Arc::clone(&data_arc)));
            app.manage(BackupIntervalMinutes(Arc::clone(&interval_arc)));
            start_backup_scheduler(data_arc, interval_arc);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_backup,
            set_backup_interval_minutes,
            list_backups_cmd,
            restore_backup_cmd,
            get_app_data_dir,
            write_external_file,
            copy_db_to_external,
            read_external_file,
            search_builtin_library,
            batch_lookup_builtin,
            fetch_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
