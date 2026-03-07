mod backup;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use backup::{BackupEntry, create_backup_file, list_backups, restore_backup_file};

pub struct AppDataDir(pub Arc<Mutex<PathBuf>>);

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

// ============================================================
// Generic HTTP GET — used by the price lookup module to bypass WebView CORS
// ============================================================
#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    res.text().await.map_err(|e| e.to_string())
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
            fetch_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
