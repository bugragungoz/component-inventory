use std::fs;
use std::path::PathBuf;
use chrono::Local;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupEntry {
    pub filename: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

pub fn get_backup_dir(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("backups")
}

pub fn get_db_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("component_inventory.db")
}

pub fn ensure_backup_dir(app_data_dir: &PathBuf) -> Result<PathBuf, String> {
    let backup_dir = get_backup_dir(app_data_dir);
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    Ok(backup_dir)
}

pub fn create_backup_file(app_data_dir: &PathBuf) -> Result<BackupEntry, String> {
    let db_path = get_db_path(app_data_dir);
    if !db_path.exists() {
        return Err("Database file not found".to_string());
    }

    let backup_dir = ensure_backup_dir(app_data_dir)?;
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("backup_{}.db", timestamp);
    let dest_path = backup_dir.join(&filename);

    fs::copy(&db_path, &dest_path).map_err(|e| e.to_string())?;

    let metadata = fs::metadata(&dest_path).map_err(|e| e.to_string())?;

    let entry = BackupEntry {
        filename: filename.clone(),
        path: dest_path.to_string_lossy().to_string(),
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        size_bytes: metadata.len(),
    };

    prune_old_backups(&backup_dir, 30)?;

    Ok(entry)
}

fn prune_old_backups(backup_dir: &PathBuf, max_count: usize) -> Result<(), String> {
    let mut entries: Vec<(PathBuf, std::time::SystemTime)> = fs::read_dir(backup_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x == "db")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?;
            Some((e.path(), modified))
        })
        .collect();

    entries.sort_by_key(|(_, time)| *time);

    if entries.len() > max_count {
        let to_remove = entries.len() - max_count;
        for (path, _) in entries.iter().take(to_remove) {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}

pub fn list_backups(app_data_dir: &PathBuf) -> Result<Vec<BackupEntry>, String> {
    let backup_dir = get_backup_dir(app_data_dir);
    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<BackupEntry> = fs::read_dir(&backup_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x == "db")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let path = e.path();
            let filename = path.file_name()?.to_string_lossy().to_string();
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?;
            let dt: chrono::DateTime<Local> = modified.into();
            Some(BackupEntry {
                filename,
                path: path.to_string_lossy().to_string(),
                created_at: dt.format("%Y-%m-%d %H:%M:%S").to_string(),
                size_bytes: meta.len(),
            })
        })
        .collect();

    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(entries)
}

pub fn restore_backup_file(app_data_dir: &PathBuf, backup_path: &str) -> Result<(), String> {
    let db_path = get_db_path(app_data_dir);
    let src = PathBuf::from(backup_path);
    if !src.exists() {
        return Err("Backup file not found".to_string());
    }
    fs::copy(&src, &db_path).map_err(|e| e.to_string())?;
    Ok(())
}
