//! Background work: an automatic backup on the configured interval (only when something changed),
//! and the Drive snapshot once at start and a few seconds after the last change. Both report to the frontend with
//! events so the status bar can show the time of the last backup and sync, or the error.

use std::sync::Arc;
use std::time::{Duration, Instant};

use inventory_core::api::{self, NoArgs};
use inventory_core::Core;
use tauri::{AppHandle, Emitter};

const SYNC_QUIET: Duration = Duration::from_secs(3);

pub fn start(app: AppHandle, core: Arc<Core>) {
    let backup_core = Arc::clone(&core);
    let backup_app = app.clone();
    let _ = std::thread::Builder::new().name("backup-timer".into()).spawn(move || {
        let mut last = Instant::now();
        loop {
            std::thread::sleep(Duration::from_secs(30));
            let minutes = backup_core.read(inventory_core::settings::get).map(|s| s.backup_interval_minutes).unwrap_or(15);
            if minutes == 0 || last.elapsed() < Duration::from_secs(minutes as u64 * 60) {
                continue;
            }
            last = Instant::now();
            match api::auto_backup(&backup_core, NoArgs {}) {
                Ok(Some(entry)) => {
                    let _ = backup_app.emit("backup-created", entry);
                }
                Ok(None) => {}
                Err(e) => {
                    let _ = backup_app.emit("backup-failed", inventory_core::ApiError::from(e));
                }
            }
        }
    });

    let _ = std::thread::Builder::new().name("drive-sync".into()).spawn(move || {
        let enabled = |core: &Core| core.read(inventory_core::settings::get).map(|s| s.drive_enabled && s.drive_folder.is_some()).unwrap_or(false);
        // The Drive copy can be older than the database (another app version wrote it, or the
        // last change was made with Drive off), and the phone reads that copy: write it once at
        // start so it matches and the status bar has a real time.
        std::thread::sleep(Duration::from_secs(2));
        if enabled(&core) {
            if let Ok(status) = api::sync_now(&core, NoArgs {}) {
                let _ = app.emit("sync-status", status);
            }
        }
        let mut seen = core.generation();
        let mut changed_at: Option<Instant> = None;
        loop {
            std::thread::sleep(Duration::from_millis(700));
            let g = core.generation();
            if g != seen {
                seen = g;
                changed_at = Some(Instant::now());
                continue;
            }
            let due = changed_at.map(|t| t.elapsed() >= SYNC_QUIET).unwrap_or(false);
            if !due || !core.needs_sync() {
                continue;
            }
            changed_at = None;
            if !enabled(&core) {
                continue;
            }
            if let Ok(status) = api::sync_now(&core, NoArgs {}) {
                let _ = app.emit("sync-status", status);
            }
        }
    });
}
