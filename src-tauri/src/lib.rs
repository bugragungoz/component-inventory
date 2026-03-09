mod backup;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use backup::{BackupEntry, create_backup_file, list_backups, restore_backup_file};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

pub struct AppDataDir(pub Arc<Mutex<PathBuf>>);

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
fn create_backup(state: State<AppDataDir>) -> Result<BackupEntry, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    create_backup_file(&dir)
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
fn get_app_data_dir(state: State<AppDataDir>) -> Result<String, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    Ok(dir.to_string_lossy().to_string())
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
        .query_map([&pattern], |row| {
            Ok(BuiltinComponent {
                id: row.get(0)?,
                part_code: row.get::<_, String>(1).unwrap_or_default(),
                category: row.get::<_, String>(2).unwrap_or_default(),
                subcategory: row.get::<_, String>(3).unwrap_or_default(),
                package: row.get::<_, String>(4).unwrap_or_default(),
                manufacturer: row.get::<_, String>(5).unwrap_or_default(),
                description: row.get::<_, String>(6).unwrap_or_default(),
                datasheet_url: row.get::<_, String>(7).unwrap_or_default(),
                voltage_max: row.get::<_, Option<f64>>(8).unwrap_or(None),
                current_max: row.get::<_, Option<f64>>(9).unwrap_or(None),
                resistance: row.get::<_, String>(10).unwrap_or_default(),
                tolerance: row.get::<_, String>(11).unwrap_or_default(),
                power_rating: row.get::<_, Option<f64>>(12).unwrap_or(None),
                attributes: row.get::<_, String>(13).unwrap_or_default(),
            })
        })
        .map_err(|e| format!("Query error: {e}"))?;

    let mut results = Vec::new();
    for row in rows {
        if let Ok(comp) = row {
            results.push(comp);
        }
    }

    Ok(results)
}

/// Helper to build a BuiltinComponent from a row with the standard column order.
fn builtin_from_row(row: &rusqlite::Row) -> rusqlite::Result<BuiltinComponent> {
    Ok(BuiltinComponent {
        id: row.get(0)?,
        part_code: row.get::<_, String>(1).unwrap_or_default(),
        category: row.get::<_, String>(2).unwrap_or_default(),
        subcategory: row.get::<_, String>(3).unwrap_or_default(),
        package: row.get::<_, String>(4).unwrap_or_default(),
        manufacturer: row.get::<_, String>(5).unwrap_or_default(),
        description: row.get::<_, String>(6).unwrap_or_default(),
        datasheet_url: row.get::<_, String>(7).unwrap_or_default(),
        voltage_max: row.get::<_, Option<f64>>(8).unwrap_or(None),
        current_max: row.get::<_, Option<f64>>(9).unwrap_or(None),
        resistance: row.get::<_, String>(10).unwrap_or_default(),
        tolerance: row.get::<_, String>(11).unwrap_or_default(),
        power_rating: row.get::<_, Option<f64>>(12).unwrap_or(None),
        attributes: row.get::<_, String>(13).unwrap_or_default(),
    })
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

    let mut results = Vec::new();

    // Normalize a part code: uppercase, strip dashes/spaces/dots
    fn normalise(s: &str) -> String {
        s.to_uppercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect()
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

    for code in &part_codes {
        let norm = normalise(code.trim());
        if norm.is_empty() {
            continue;
        }

        // 1. Exact normalised match
        if let Ok(Some(comp)) = exact_stmt.query_row([&norm], |row| Ok(Some(builtin_from_row(row)?)))
        {
            results.push(comp);
            continue;
        }

        // 2. LIKE prefix match
        let pattern = format!("{}%", code.trim());
        if let Ok(Some(comp)) = like_stmt.query_row([&pattern], |row| Ok(Some(builtin_from_row(row)?)))
        {
            results.push(comp);
        }
    }

    Ok(results)
}

// Use std::thread to avoid requiring a Tokio runtime context during setup.
fn start_backup_scheduler(data_dir: Arc<Mutex<PathBuf>>) {
    std::thread::Builder::new()
        .name("backup-scheduler".into())
        .spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(900)); // 15 minutes
                if let Ok(dir) = data_dir.lock() {
                    let _ = create_backup_file(&dir);
                }
            }
        })
        .ok();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            app.manage(AppDataDir(Arc::clone(&data_arc)));
            start_backup_scheduler(data_arc);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_backup,
            list_backups_cmd,
            restore_backup_cmd,
            get_app_data_dir,
            search_builtin_library,
            batch_lookup_builtin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
