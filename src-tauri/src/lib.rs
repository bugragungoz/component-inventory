mod backup;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use backup::{BackupEntry, create_backup_file, list_backups, restore_backup_file};

pub struct AppDataDir(pub Mutex<PathBuf>);

#[tauri::command]
fn create_backup(state: State<AppDataDir>) -> Result<BackupEntry, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?;
    create_backup_file(&dir)
}

#[tauri::command]
fn list_backups_cmd(state: State<AppDataDir>) -> Result<Vec<BackupEntry>, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?;
    list_backups(&dir)
}

#[tauri::command]
fn restore_backup_cmd(backup_path: String, state: State<AppDataDir>) -> Result<(), String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?;
    restore_backup_file(&dir, &backup_path)
}

#[tauri::command]
fn get_app_data_dir(state: State<AppDataDir>) -> Result<String, String> {
    let dir = state.0.lock().map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

fn start_backup_scheduler(app_handle: AppHandle) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(900)); // 15 minutes
        interval.tick().await; // skip the first immediate tick
        loop {
            interval.tick().await;
            let state = app_handle.state::<AppDataDir>();
            if let Ok(dir) = state.0.lock() {
                let _ = create_backup_file(&dir);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
            backup::ensure_backup_dir(&data_dir).expect("failed to create backup dir");

            app.manage(AppDataDir(Mutex::new(data_dir)));

            let handle = app.handle().clone();
            start_backup_scheduler(handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_backup,
            list_backups_cmd,
            restore_backup_cmd,
            get_app_data_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
