//! `Core` owns the database connection and the app's folders. All access goes through `read` and
//! `write`; `write` bumps a generation counter that the backup scheduler and the Drive snapshot
//! watch.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use rusqlite::Connection;

use crate::backup;
use crate::db;
use crate::error::{invalid, Result};
use crate::library::Library;
use crate::model::{BackupEntry, MigrationReport};
use crate::schema;
use crate::sync::SyncStatus;

pub const DB_FILE_NAME: &str = "component_inventory.db";

#[derive(Debug, Clone)]
pub struct Paths {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub backups_dir: PathBuf,
    pub images_dir: PathBuf,
}

impl Paths {
    pub fn new(data_dir: &Path) -> Paths {
        Paths {
            data_dir: data_dir.to_path_buf(),
            db_path: data_dir.join(DB_FILE_NAME),
            backups_dir: data_dir.join("backups"),
            images_dir: data_dir.join("images"),
        }
    }
}

pub struct Core {
    conn: Mutex<Connection>,
    pub paths: Paths,
    pub library: Library,
    generation: AtomicU64,
    synced_generation: AtomicU64,
    backed_up_generation: AtomicU64,
    pub(crate) sync: Mutex<SyncStatus>,
    pub migration: Option<MigrationReport>,
}

impl Core {
    /// Opens (or creates) the database in `data_dir`. An old database is copied to
    /// `backups/pre-migration-v<n>-<time>.db` before it is migrated.
    pub fn open(data_dir: &Path, library_path: Option<PathBuf>) -> Result<Core> {
        let paths = Paths::new(data_dir);
        std::fs::create_dir_all(&paths.data_dir)?;
        std::fs::create_dir_all(&paths.backups_dir)?;
        std::fs::create_dir_all(&paths.images_dir)?;
        let existed = paths.db_path.is_file();
        let mut conn = db::open(&paths.db_path)?;
        let mut pre_backup: Option<BackupEntry> = None;
        if existed && schema::needs_migration(&conn)? {
            let from = db::user_version(&conn)?;
            pre_backup = Some(backup::copy_before_migration(&paths.db_path, &paths.backups_dir, from)?);
        }
        let mut report = schema::migrate(&mut conn)?;
        report.backup_path = pre_backup.map(|b| b.path);
        let migration = (report.from_version != report.to_version || !existed).then_some(report);
        Ok(Core {
            conn: Mutex::new(conn),
            paths,
            library: Library::new(library_path.unwrap_or_default()),
            generation: AtomicU64::new(0),
            synced_generation: AtomicU64::new(0),
            backed_up_generation: AtomicU64::new(0),
            sync: Mutex::new(SyncStatus { state: "off".into(), ..Default::default() }),
            migration,
        })
    }

    pub fn read<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let guard = self.conn.lock().map_err(|_| invalid("database lock poisoned"))?;
        f(&guard)
    }

    pub fn write<T>(&self, f: impl FnOnce(&mut Connection) -> Result<T>) -> Result<T> {
        let mut guard = self.conn.lock().map_err(|_| invalid("database lock poisoned"))?;
        let out = f(&mut guard)?;
        self.generation.fetch_add(1, Ordering::SeqCst);
        Ok(out)
    }

    pub fn generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }

    pub fn needs_sync(&self) -> bool {
        self.generation() != self.synced_generation.load(Ordering::SeqCst)
    }

    pub(crate) fn mark_synced(&self, generation: u64) {
        self.synced_generation.store(generation, Ordering::SeqCst);
    }

    pub fn needs_auto_backup(&self) -> bool {
        self.generation() != self.backed_up_generation.load(Ordering::SeqCst)
    }

    pub(crate) fn mark_backed_up(&self, generation: u64) {
        self.backed_up_generation.store(generation, Ordering::SeqCst);
    }

    /// A consistent copy of the database into the backup folder, then pruning by retention.
    pub fn backup(&self, kind: &str) -> Result<BackupEntry> {
        let generation = self.generation();
        let entry = self.read(|c| backup::create(c, &self.paths.backups_dir, kind))?;
        let retention = self.read(|c| crate::settings::get(c).map(|s| s.backup_retention))?;
        backup::prune(&self.paths.backups_dir, retention)?;
        if kind == "auto" {
            self.mark_backed_up(generation);
        }
        Ok(entry)
    }
}
