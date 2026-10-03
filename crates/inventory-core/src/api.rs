//! The command surface shared by the Tauri shell and the test bridge. Every command takes one
//! argument struct (sent from JavaScript as `{ args: {...} }`) and returns a serializable value.
//! `for_each_command!` lists them once so the shell and the bridge cannot drift.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::components::{self, ComponentPatch};
use crate::core::Core;
use crate::custom_columns::{self, CustomColumnInput};
use crate::error::Result;
use crate::imports::{self, ImportBatch, ImportBatchDetail, ImportRequest, ImportResult, UndoResult};
use crate::model::*;
use crate::projects::{self, BomLineInput, BomLinePatch, ProjectPatch};
use crate::settings::{self, AppSettings};
use crate::sync::SyncStatus;
use crate::{backup, diff, movements, schema};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct NoArgs {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdArgs {
    pub id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdsArgs {
    pub ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveComponentArgs {
    pub component: ComponentInput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreComponentsArgs {
    pub snapshot: DeletedSnapshot,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RestoreReport {
    /// Part codes that could not come back because the code is in use again.
    pub skipped: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdjustArgs {
    pub id: i64,
    pub delta: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameCategoryArgs {
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub parent: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CountResult {
    pub count: i64,
    #[serde(default)]
    pub backup_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchArgs {
    pub patches: Vec<ComponentPatch>,
    #[serde(default)]
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeArgs {
    pub keep_id: i64,
    pub merge_ids: Vec<i64>,
    #[serde(default)]
    pub part_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovementArgs {
    pub component_id: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveCustomColumnArgs {
    pub column: CustomColumnInput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettingsArgs {
    pub patch: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacySettingsArgs {
    pub values: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyImportArgs {
    pub request: ImportRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectArgs {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProjectArgs {
    pub patch: ProjectPatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreProjectArgs {
    pub snapshot: ProjectSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertBomArgs {
    pub line: BomLineInput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddBomLinesArgs {
    pub lines: Vec<BomLineInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBomArgs {
    pub patch: BomLinePatch,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct CreateBackupArgs {
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileArgs {
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreBackupResult {
    pub safety_backup: BackupEntry,
    pub migration: MigrationReport,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchArgs {
    pub term: String,
    #[serde(default = "default_search_limit")]
    pub limit: i64,
}

fn default_search_limit() -> i64 {
    15
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodesArgs {
    pub codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub data_dir: String,
    pub db_path: String,
    pub backups_dir: String,
    pub schema_version: i64,
    pub migration: Option<MigrationReport>,
    pub library_available: bool,
    pub component_count: i64,
}

/// Lists every shared command once: `name(ArgsType) -> ReturnType`. The callback macro receives
/// the whole list.
#[macro_export]
macro_rules! for_each_command {
    ($callback:ident) => {
        $callback! {
            app_info(NoArgs) -> AppInfo,
            list_components(NoArgs) -> Vec<Component>,
            get_component(IdArgs) -> ComponentDetail,
            save_component(SaveComponentArgs) -> Component,
            delete_components(IdsArgs) -> DeletedSnapshot,
            restore_components(RestoreComponentsArgs) -> RestoreReport,
            adjust_quantity(AdjustArgs) -> Component,
            rename_category(RenameCategoryArgs) -> CountResult,
            apply_patches(PatchArgs) -> CountResult,
            merge_components(MergeArgs) -> Component,
            list_movements(MovementArgs) -> Vec<Movement>,
            list_custom_columns(NoArgs) -> Vec<CustomColumn>,
            save_custom_column(SaveCustomColumnArgs) -> CustomColumn,
            delete_custom_column(IdArgs) -> (),
            get_settings(NoArgs) -> AppSettings,
            update_settings(UpdateSettingsArgs) -> AppSettings,
            import_legacy_settings(LegacySettingsArgs) -> AppSettings,
            apply_import(ApplyImportArgs) -> ImportResult,
            list_imports(NoArgs) -> Vec<ImportBatch>,
            get_import(IdArgs) -> ImportBatchDetail,
            undo_import(IdArgs) -> UndoResult,
            list_projects(NoArgs) -> Vec<Project>,
            create_project(CreateProjectArgs) -> Project,
            update_project(UpdateProjectArgs) -> Project,
            delete_project(IdArgs) -> ProjectSnapshot,
            restore_project(RestoreProjectArgs) -> Project,
            reorder_projects(IdsArgs) -> (),
            list_bom(IdArgs) -> Vec<BomRow>,
            upsert_bom_line(UpsertBomArgs) -> BomRow,
            add_bom_lines(AddBomLinesArgs) -> CountResult,
            update_bom_line(UpdateBomArgs) -> BomRow,
            delete_bom_line(IdArgs) -> BomLink,
            project_usage(NoArgs) -> Vec<UsageSummary>,
            create_backup(CreateBackupArgs) -> BackupEntry,
            list_backups(NoArgs) -> Vec<BackupEntry>,
            restore_backup(FileArgs) -> RestoreBackupResult,
            diff_backup(FileArgs) -> BackupDiff,
            auto_backup(NoArgs) -> Option<BackupEntry>,
            search_library(SearchArgs) -> Vec<LibraryPart>,
            lookup_library(CodesArgs) -> Vec<Option<LibraryPart>>,
            sync_status(NoArgs) -> SyncStatus,
            sync_now(NoArgs) -> SyncStatus
        }
    };
}

pub fn app_info(core: &Core, _: NoArgs) -> Result<AppInfo> {
    let (version, count) = core.read(|c| {
        let v = crate::db::user_version(c)?;
        let n: i64 = c.query_row("SELECT COUNT(*) FROM components", [], |r| r.get(0))?;
        Ok((v, n))
    })?;
    Ok(AppInfo {
        data_dir: core.paths.data_dir.to_string_lossy().into_owned(),
        db_path: core.paths.db_path.to_string_lossy().into_owned(),
        backups_dir: core.paths.backups_dir.to_string_lossy().into_owned(),
        schema_version: version,
        migration: core.migration.clone(),
        library_available: core.library.available(),
        component_count: count,
    })
}

pub fn list_components(core: &Core, _: NoArgs) -> Result<Vec<Component>> {
    core.read(components::list)
}

pub fn get_component(core: &Core, a: IdArgs) -> Result<ComponentDetail> {
    core.read(|c| {
        Ok(ComponentDetail {
            component: components::get(c, a.id)?,
            movements: movements::list_for(c, a.id, 50)?,
            projects: projects::for_component(c, a.id)?,
        })
    })
}

pub fn save_component(core: &Core, a: SaveComponentArgs) -> Result<Component> {
    core.write(|c| components::save(c, &a.component))
}

pub fn delete_components(core: &Core, a: IdsArgs) -> Result<DeletedSnapshot> {
    if a.ids.len() > 1 {
        core.backup("pre-delete")?;
    }
    core.write(|c| components::delete(c, &a.ids, if a.ids.len() > 1 { "bulk-delete" } else { "delete" }))
}

pub fn restore_components(core: &Core, a: RestoreComponentsArgs) -> Result<RestoreReport> {
    core.write(|c| Ok(RestoreReport { skipped: components::restore(c, &a.snapshot)? }))
}

pub fn adjust_quantity(core: &Core, a: AdjustArgs) -> Result<Component> {
    core.write(|c| components::adjust_quantity(c, a.id, a.delta))
}

pub fn rename_category(core: &Core, a: RenameCategoryArgs) -> Result<CountResult> {
    let n = core.write(|c| components::rename_category(c, &a.from, &a.to, a.parent.as_deref()))?;
    Ok(CountResult { count: n as i64, backup_file: String::new() })
}

pub fn apply_patches(core: &Core, a: PatchArgs) -> Result<CountResult> {
    let b = core.backup("pre-bulk")?;
    let reason = if a.reason.trim().is_empty() { "bulk".to_string() } else { a.reason.chars().take(40).collect() };
    let n = core.write(|c| components::apply_patches(c, &a.patches, &reason))?;
    Ok(CountResult { count: n as i64, backup_file: b.file_name })
}

pub fn merge_components(core: &Core, a: MergeArgs) -> Result<Component> {
    core.backup("pre-bulk")?;
    core.write(|c| components::merge(c, a.keep_id, &a.merge_ids, a.part_code.as_deref()))
}

pub fn list_movements(core: &Core, a: MovementArgs) -> Result<Vec<Movement>> {
    core.read(|c| movements::list_for(c, a.component_id, a.limit))
}

pub fn list_custom_columns(core: &Core, _: NoArgs) -> Result<Vec<CustomColumn>> {
    core.read(custom_columns::list)
}

pub fn save_custom_column(core: &Core, a: SaveCustomColumnArgs) -> Result<CustomColumn> {
    core.write(|c| custom_columns::save(c, &a.column))
}

pub fn delete_custom_column(core: &Core, a: IdArgs) -> Result<()> {
    core.write(|c| custom_columns::delete(c, a.id))
}

pub fn get_settings(core: &Core, _: NoArgs) -> Result<AppSettings> {
    core.read(settings::get)
}

pub fn update_settings(core: &Core, a: UpdateSettingsArgs) -> Result<AppSettings> {
    // Settings are not inventory data: no generation bump, no snapshot.
    core.read(|c| settings::update(c, &a.patch))
}

pub fn import_legacy_settings(core: &Core, a: LegacySettingsArgs) -> Result<AppSettings> {
    core.read(|c| settings::import_legacy(c, &a.values))
}

pub fn apply_import(core: &Core, a: ApplyImportArgs) -> Result<ImportResult> {
    // Checked before the backup, so a bad request does not leave a backup behind.
    imports::consolidate(&a.request.rows)?;
    let b = core.backup("pre-import")?;
    core.write(|c| imports::apply(c, &a.request, &b.file_name))
}

pub fn list_imports(core: &Core, _: NoArgs) -> Result<Vec<ImportBatch>> {
    core.read(|c| imports::list(c, 200))
}

pub fn get_import(core: &Core, a: IdArgs) -> Result<ImportBatchDetail> {
    core.read(|c| imports::get_batch(c, a.id))
}

pub fn undo_import(core: &Core, a: IdArgs) -> Result<UndoResult> {
    core.read(|c| imports::get_batch(c, a.id))?;
    let b = core.backup("pre-undo")?;
    core.write(|c| imports::undo(c, a.id, &b.file_name))
}

pub fn list_projects(core: &Core, _: NoArgs) -> Result<Vec<Project>> {
    core.read(projects::list)
}

pub fn create_project(core: &Core, a: CreateProjectArgs) -> Result<Project> {
    core.write(|c| projects::create(c, &a.name))
}

pub fn update_project(core: &Core, a: UpdateProjectArgs) -> Result<Project> {
    core.write(|c| projects::update(c, &a.patch))
}

pub fn delete_project(core: &Core, a: IdArgs) -> Result<ProjectSnapshot> {
    core.write(|c| projects::delete(c, a.id))
}

pub fn restore_project(core: &Core, a: RestoreProjectArgs) -> Result<Project> {
    core.write(|c| projects::restore(c, &a.snapshot))
}

pub fn reorder_projects(core: &Core, a: IdsArgs) -> Result<()> {
    core.write(|c| projects::reorder(c, &a.ids))
}

pub fn list_bom(core: &Core, a: IdArgs) -> Result<Vec<BomRow>> {
    core.read(|c| projects::bom(c, a.id))
}

pub fn upsert_bom_line(core: &Core, a: UpsertBomArgs) -> Result<BomRow> {
    core.write(|c| projects::upsert_line(c, &a.line))
}

pub fn add_bom_lines(core: &Core, a: AddBomLinesArgs) -> Result<CountResult> {
    core.write(|c| {
        let tx = c.transaction()?;
        let mut n = 0;
        for line in &a.lines {
            projects::upsert_line(&tx, line)?;
            n += 1;
        }
        tx.commit()?;
        Ok(CountResult { count: n, backup_file: String::new() })
    })
}

pub fn update_bom_line(core: &Core, a: UpdateBomArgs) -> Result<BomRow> {
    core.write(|c| projects::update_line(c, &a.patch))
}

pub fn delete_bom_line(core: &Core, a: IdArgs) -> Result<BomLink> {
    core.write(|c| projects::delete_line(c, a.id))
}

pub fn project_usage(core: &Core, _: NoArgs) -> Result<Vec<UsageSummary>> {
    core.read(projects::usage)
}

pub fn create_backup(core: &Core, a: CreateBackupArgs) -> Result<BackupEntry> {
    let kind = if a.kind.is_empty() { "manual" } else { a.kind.as_str() };
    core.backup(kind)
}

pub fn list_backups(core: &Core, _: NoArgs) -> Result<Vec<BackupEntry>> {
    backup::list(&core.paths.backups_dir)
}

pub fn restore_backup(core: &Core, a: FileArgs) -> Result<RestoreBackupResult> {
    let path = backup::resolve(&core.paths.backups_dir, &a.file_name)?;
    backup::check_is_inventory(&path)?;
    let safety = core.backup("pre-restore")?;
    let migration = core.write(|c| {
        backup::restore_into(c, &path)?;
        schema::migrate(c)
    })?;
    Ok(RestoreBackupResult { safety_backup: safety, migration })
}

pub fn diff_backup(core: &Core, a: FileArgs) -> Result<BackupDiff> {
    let path = backup::resolve(&core.paths.backups_dir, &a.file_name)?;
    let old = backup::read_components(&path)?;
    let now = core.read(components::list)?;
    Ok(diff::diff(&old, &now))
}

/// Called by the scheduler: a backup only when something changed since the last automatic one.
pub fn auto_backup(core: &Core, _: NoArgs) -> Result<Option<BackupEntry>> {
    if !core.needs_auto_backup() {
        return Ok(None);
    }
    core.backup("auto").map(Some)
}

pub fn search_library(core: &Core, a: SearchArgs) -> Result<Vec<LibraryPart>> {
    core.library.search(&a.term, a.limit)
}

pub fn lookup_library(core: &Core, a: CodesArgs) -> Result<Vec<Option<LibraryPart>>> {
    core.library.lookup(&a.codes)
}

pub fn sync_status(core: &Core, _: NoArgs) -> Result<SyncStatus> {
    let s = core.read(settings::get)?;
    let mut status = core.sync.lock().map_err(|_| crate::error::invalid("sync lock poisoned"))?.clone();
    if !s.drive_enabled || s.drive_folder.is_none() {
        status.state = "off".into();
    } else if status.state == "off" {
        status.state = if core.needs_sync() { "pending".into() } else { "ok".into() };
    }
    status.folder = s.drive_folder.clone();
    Ok(status)
}

/// Writes the Drive snapshot now (when Drive sync is on). Errors are reported in the status,
/// not thrown, so a missing Drive folder never blocks a save.
pub fn sync_now(core: &Core, _: NoArgs) -> Result<SyncStatus> {
    let s = core.read(settings::get)?;
    let (Some(folder), true) = (s.drive_folder.clone(), s.drive_enabled) else {
        let mut st = core.sync.lock().map_err(|_| crate::error::invalid("sync lock poisoned"))?;
        *st = SyncStatus { state: "off".into(), ..Default::default() };
        return Ok(st.clone());
    };
    let generation = core.generation();
    let result = core.read(|c| crate::sync::write_snapshot(c, &folder, &s.drive_base_name));
    let mut st = core.sync.lock().map_err(|_| crate::error::invalid("sync lock poisoned"))?;
    match result {
        Ok(files) => {
            core.mark_synced(generation);
            *st = SyncStatus { state: "ok".into(), folder: Some(folder), last_sync_at: Some(crate::db::now()), last_error: None, files };
        }
        Err(e) => {
            st.state = "error".into();
            st.folder = Some(folder);
            st.last_error = Some(e.to_string());
        }
    }
    Ok(st.clone())
}

/// For the shell and the bridge: runs a shared command by name with JSON arguments
/// (`{"args": {...}}`, as `invoke` sends them).
pub fn dispatch(core: &Core, cmd: &str, payload: Value) -> std::result::Result<Value, crate::error::ApiError> {
    use crate::error::ApiError;
    let args = match payload {
        Value::Object(mut m) => m.remove("args").unwrap_or(Value::Object(Map::new())),
        _ => Value::Object(Map::new()),
    };
    macro_rules! dispatch_table {
        ($($name:ident($args:ty) -> $ret:ty),* $(,)?) => {
            match cmd {
                $(stringify!($name) => {
                    let parsed: $args = serde_json::from_value(args)
                        .map_err(|e| ApiError::new("invalid_input", format!("{}: {e}", stringify!($name))))?;
                    let out: $ret = $name(core, parsed).map_err(ApiError::from)?;
                    serde_json::to_value(out).map_err(|e| ApiError::new("data", e.to_string()))
                })*
                other => Err(ApiError::new("unknown_command", other.to_string())),
            }
        };
    }
    for_each_command!(dispatch_table)
}

/// Names of every shared command, for tests and the shell's sanity check.
pub fn command_names() -> Vec<&'static str> {
    macro_rules! names {
        ($($name:ident($args:ty) -> $ret:ty),* $(,)?) => { vec![$(stringify!($name)),*] };
    }
    for_each_command!(names)
}
