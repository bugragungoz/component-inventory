mod backup;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use backup::{BackupEntry, create_backup_file, get_db_path, list_backups, restore_backup_file};

pub struct AppDataDir(pub Arc<Mutex<PathBuf>>);

// ============================================================
// Backup commands — lock is released before any file I/O
// ============================================================
#[tauri::command]
fn create_backup(retention: Option<usize>, state: State<AppDataDir>) -> Result<BackupEntry, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?.clone();
    create_backup_file(&dir, retention.unwrap_or(30))
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


// Use std::thread to avoid requiring a Tokio runtime context during setup.
fn start_backup_scheduler(data_dir: Arc<Mutex<PathBuf>>) {
    std::thread::Builder::new()
        .name("backup-scheduler".into())
        .spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(900)); // 15 minutes
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
            write_external_file,
            copy_db_to_external,
            read_external_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
