//! Commands only the desktop app has. Native dialogs run here, so the frontend never hands Rust a
//! path to write; reads are limited to the app data folder and files the owner picked
//! (docs/adr/0003).

use std::path::{Path, PathBuf};

use inventory_core::model::Project;
use inventory_core::settings::{self, AppSettings, FolderKind};
use inventory_core::{export, ApiError};
use serde::{Deserialize, Serialize};
use tauri::ipc::{Request, Response};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::AppState;

const MAX_READ_BYTES: u64 = 50 * 1024 * 1024;

fn io(e: impl std::fmt::Display) -> ApiError {
    ApiError::new("file", e.to_string())
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, ApiError> + Send + 'static) -> Result<T, ApiError> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| ApiError::new("internal", e.to_string()))?
}

fn file_path(fp: tauri_plugin_dialog::FilePath) -> Result<PathBuf, ApiError> {
    fp.into_path().map_err(|e| ApiError::new("file", e.to_string()))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FolderArg {
    Export,
    Drive,
}

/// Opens a folder picker and stores the choice. `None` when the owner cancelled.
#[tauri::command]
pub async fn pick_folder(app: AppHandle, state: State<'_, AppState>, kind: FolderArg) -> Result<Option<AppSettings>, ApiError> {
    let core = state.core()?;
    blocking(move || {
        let Some(dir) = app.dialog().file().blocking_pick_folder() else { return Ok(None) };
        let path = file_path(dir)?;
        let kind = match kind {
            FolderArg::Export => FolderKind::Export,
            FolderArg::Drive => FolderKind::Drive,
        };
        let s = core.read(|c| settings::set_folder(c, kind, Some(path.to_string_lossy().into_owned())))?;
        Ok(Some(s))
    })
    .await
}

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp"];

/// Picks an image and copies it into `<data>/images`. Returns the path to store on the part
/// (relative: `images/<file>`).
#[tauri::command]
pub async fn pick_component_image(app: AppHandle, state: State<'_, AppState>, part_code: String) -> Result<Option<String>, ApiError> {
    let core = state.core()?;
    blocking(move || {
        let Some(file) = app.dialog().file().add_filter("Images", IMAGE_EXTENSIONS).blocking_pick_file() else { return Ok(None) };
        let src = file_path(file)?;
        let ext = src.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
        if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            return Err(ApiError::new("invalid_input", "not an image file"));
        }
        if std::fs::metadata(&src).map_err(io)?.len() > MAX_READ_BYTES {
            return Err(ApiError::new("invalid_input", "the image is larger than 50 MB"));
        }
        let safe: String =
            part_code.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).take(60).collect();
        let name = format!("{}_{}.{ext}", if safe.is_empty() { "image".into() } else { safe }, chrono::Local::now().format("%Y%m%d%H%M%S"));
        std::fs::create_dir_all(&core.paths.images_dir).map_err(io)?;
        std::fs::copy(&src, core.paths.images_dir.join(&name)).map_err(io)?;
        Ok(Some(format!("images/{name}")))
    })
    .await
}

/// Resolves a stored image path. Relative paths are inside the data folder; absolute ones (written
/// by the old app) are accepted only when they point into the data folder too.
fn image_location(data_dir: &Path, stored: &str) -> Result<PathBuf, ApiError> {
    let p = Path::new(stored);
    let full = if p.is_absolute() { p.to_path_buf() } else { data_dir.join(p) };
    let canon = full.canonicalize().map_err(io)?;
    let root = data_dir.canonicalize().map_err(io)?;
    if !canon.starts_with(&root) {
        return Err(ApiError::new("invalid_input", "images are read from the app's own folder only"));
    }
    Ok(canon)
}

#[tauri::command]
pub async fn read_image(state: State<'_, AppState>, path: String) -> Result<Response, ApiError> {
    let core = state.core()?;
    blocking(move || {
        let p = image_location(&core.paths.data_dir, &path)?;
        if std::fs::metadata(&p).map_err(io)?.len() > MAX_READ_BYTES {
            return Err(ApiError::new("invalid_input", "the image is larger than 50 MB"));
        }
        Ok(Response::new(std::fs::read(p).map_err(io)?))
    })
    .await
}

const SCHEMATIC_EXTENSIONS: &[&str] = &["pdf", "kicad_sch", "sch", "png", "jpg", "jpeg", "svg", "webp"];

#[tauri::command]
pub async fn pick_schematic(app: AppHandle, state: State<'_, AppState>, project_id: i64) -> Result<Option<Project>, ApiError> {
    let core = state.core()?;
    blocking(move || {
        let Some(file) = app.dialog().file().add_filter("Schematic", SCHEMATIC_EXTENSIONS).blocking_pick_file() else { return Ok(None) };
        let p = file_path(file)?;
        let project = core.write(|c| inventory_core::projects::set_schematic(c, project_id, &p.to_string_lossy()))?;
        Ok(Some(project))
    })
    .await
}

/// Reads the schematic file the owner picked for a project (its path is stored on the project).
#[tauri::command]
pub async fn read_schematic(state: State<'_, AppState>, project_id: i64) -> Result<Response, ApiError> {
    let core = state.core()?;
    blocking(move || {
        let project = core.read(|c| inventory_core::projects::get(c, project_id))?;
        if project.schematic_path.is_empty() {
            return Err(ApiError::new("not_found", "the project has no schematic"));
        }
        let p = PathBuf::from(&project.schematic_path);
        let len = std::fs::metadata(&p).map_err(io)?.len();
        if len > MAX_READ_BYTES {
            return Err(ApiError::new("invalid_input", "the schematic is larger than 50 MB"));
        }
        Ok(Response::new(std::fs::read(p).map_err(io)?))
    })
    .await
}

fn timestamped(ext: &str) -> String {
    format!("ComponentInventory_{}.{ext}", chrono::Local::now().format("%Y-%m-%d_%H-%M"))
}

/// Exports the inventory as csv, json or xlsx to a file the owner picks.
#[tauri::command]
pub async fn export_inventory(app: AppHandle, state: State<'_, AppState>, format: String) -> Result<Option<String>, ApiError> {
    let core = state.core()?;
    blocking(move || {
        let (label, ext) = match format.as_str() {
            "csv" => ("CSV", "csv"),
            "json" => ("JSON", "json"),
            "xlsx" => ("Excel", "xlsx"),
            _ => return Err(ApiError::new("invalid_input", "unknown export format")),
        };
        let s = core.read(settings::get)?;
        let mut dialog = app.dialog().file().add_filter(label, &[ext]).set_file_name(timestamped(ext));
        if let Some(dir) = s.export_folder.as_deref().filter(|d| Path::new(d).is_dir()) {
            dialog = dialog.set_directory(dir);
        }
        let Some(target) = dialog.blocking_save_file() else { return Ok(None) };
        let target = file_path(target)?;
        let comps = core.read(inventory_core::components::list)?;
        let custom = core.read(inventory_core::custom_columns::list)?;
        let bytes = match ext {
            "csv" => export::csv(&comps, &custom),
            "json" => export::json(&comps)?,
            _ => export::xlsx(&comps, &custom)?,
        };
        inventory_core::sync::atomic_write(&target, &bytes)?;
        Ok(Some(target.to_string_lossy().into_owned()))
    })
    .await
}

/// Saves bytes the frontend generated (a PDF export, labels) to a file the owner picks. The body is
/// the file; headers carry the suggested name and the filter.
#[tauri::command]
pub async fn save_generated_file(app: AppHandle, state: State<'_, AppState>, request: Request<'_>) -> Result<Option<String>, ApiError> {
    let core = state.core()?;
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err(ApiError::new("invalid_input", "expected the file as the request body"));
    };
    let bytes = bytes.clone();
    let header = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).unwrap_or_default().to_string();
    let name: String = header("x-file-name").chars().filter(|c| !"\\/:*?\"<>|".contains(*c)).take(120).collect();
    let ext = header("x-extension").to_ascii_lowercase();
    if !["pdf", "png", "svg", "csv", "json", "txt"].contains(&ext.as_str()) {
        return Err(ApiError::new("invalid_input", "this file type cannot be saved"));
    }
    blocking(move || {
        let s = core.read(settings::get)?;
        let mut dialog = app.dialog().file().add_filter(ext.to_uppercase(), &[ext.as_str()]).set_file_name(if name.is_empty() {
            timestamped(&ext)
        } else {
            name
        });
        if let Some(dir) = s.export_folder.as_deref().filter(|d| Path::new(d).is_dir()) {
            dialog = dialog.set_directory(dir);
        }
        let Some(target) = dialog.blocking_save_file() else { return Ok(None) };
        let target = file_path(target)?;
        inventory_core::sync::atomic_write(&target, &bytes)?;
        Ok(Some(target.to_string_lossy().into_owned()))
    })
    .await
}

/// Opens a web link in the default browser. Only http and https.
#[tauri::command]
pub fn open_url(app: AppHandle, url: String) -> Result<(), ApiError> {
    let u = url.trim();
    if !(u.starts_with("https://") || u.starts_with("http://")) || u.len() > 4000 {
        return Err(ApiError::new("invalid_input", "only web links can be opened"));
    }
    app.opener().open_url(u, None::<&str>).map_err(io)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FolderTarget {
    Data,
    Backups,
    Drive,
}

#[tauri::command]
pub fn open_folder(app: AppHandle, state: State<'_, AppState>, target: FolderTarget) -> Result<(), ApiError> {
    let core = state.core()?;
    let path = match target {
        FolderTarget::Data => core.paths.data_dir.clone(),
        FolderTarget::Backups => core.paths.backups_dir.clone(),
        FolderTarget::Drive => match core.read(settings::get)?.drive_folder {
            Some(p) => PathBuf::from(p),
            None => return Err(ApiError::new("not_found", "no Drive folder chosen")),
        },
    };
    app.opener().open_path(path.to_string_lossy(), None::<&str>).map_err(io)
}

#[tauri::command]
pub fn take_deep_links(state: State<'_, AppState>) -> Vec<String> {
    state.deep_links.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default()
}

#[derive(Debug, Serialize)]
pub struct StartupStatus {
    pub ok: bool,
    pub error: Option<ApiError>,
    pub data_dir: String,
}

/// Lets the frontend show a clear screen when the database could not be opened (for example a
/// database from a newer version of the app).
#[tauri::command]
pub fn startup_status(app: AppHandle, state: State<'_, AppState>) -> StartupStatus {
    let data_dir = app.path().app_data_dir().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    match state.core() {
        Ok(_) => StartupStatus { ok: true, error: None, data_dir },
        Err(e) => StartupStatus { ok: false, error: Some(e), data_dir },
    }
}

#[derive(Debug, Serialize)]
pub struct UpdateCheck {
    /// "skipped" (version unknown or check off), "current", "available", "error"
    pub status: String,
    pub current: Option<String>,
    pub latest: Option<String>,
    pub url: Option<String>,
}

const RELEASES_API: &str = "https://api.github.com/repos/bugragungoz/component-inventory/releases?per_page=20";

/// Compares the running version with GitHub Releases. Never runs when the version cannot be read
/// (B6); pre-releases count only while the running version is one.
#[tauri::command]
pub async fn check_update(app: AppHandle, state: State<'_, AppState>, manual: Option<bool>) -> Result<UpdateCheck, ApiError> {
    let core = state.core()?;
    let current_raw = app.package_info().version.to_string();
    blocking(move || {
        let s = core.read(settings::get)?;
        let Ok(current) = semver::Version::parse(&current_raw) else {
            return Ok(UpdateCheck { status: "skipped".into(), current: None, latest: None, url: None });
        };
        if !s.update_check && !manual.unwrap_or(false) {
            return Ok(UpdateCheck { status: "skipped".into(), current: Some(current.to_string()), latest: None, url: None });
        }
        let client = reqwest::blocking::Client::builder()
            .user_agent(format!("ComponentInventory/{current}"))
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| ApiError::new("network", e.to_string()))?;
        let res = client
            .get(RELEASES_API)
            .header("Accept", "application/vnd.github+json")
            .send()
            .and_then(|r| r.error_for_status())
            .and_then(|r| r.json::<Vec<serde_json::Value>>());
        let releases = match res {
            Ok(r) => r,
            Err(e) => {
                return Ok(UpdateCheck {
                    status: "error".into(),
                    current: Some(current.to_string()),
                    latest: None,
                    url: Some(e.to_string()),
                })
            }
        };
        Ok(pick_update(&current, &releases))
    })
    .await
}

fn pick_update(current: &semver::Version, releases: &[serde_json::Value]) -> UpdateCheck {
    let allow_pre = !current.pre.is_empty();
    let best = releases
        .iter()
        .filter(|r| !r.get("draft").and_then(|d| d.as_bool()).unwrap_or(false))
        .filter_map(|r| {
            let tag = r.get("tag_name")?.as_str()?;
            let v = semver::Version::parse(tag.trim_start_matches('v')).ok()?;
            if !allow_pre && !v.pre.is_empty() {
                return None;
            }
            Some((v, r.get("html_url").and_then(|u| u.as_str()).unwrap_or_default().to_string()))
        })
        .max_by(|a, b| a.0.cmp(&b.0));
    match best {
        Some((v, url)) if &v > current => {
            UpdateCheck { status: "available".into(), current: Some(current.to_string()), latest: Some(v.to_string()), url: Some(url) }
        }
        Some((v, _)) => {
            UpdateCheck { status: "current".into(), current: Some(current.to_string()), latest: Some(v.to_string()), url: None }
        }
        None => UpdateCheck { status: "current".into(), current: Some(current.to_string()), latest: None, url: None },
    }
}

const SHOP_HOSTS: &[&str] = &["www.ozdisan.com", "ozdisan.com"];

/// Fetches a public shop page for the part look-up (Özdisan only). Returns HTML, at most 2 MB.
#[tauri::command]
pub async fn fetch_shop_page(url: String) -> Result<String, ApiError> {
    blocking(move || {
        let u = url.trim();
        let host = u.strip_prefix("https://").and_then(|r| r.split(['/', '?']).next()).unwrap_or_default().to_ascii_lowercase();
        if !SHOP_HOSTS.contains(&host.as_str()) {
            return Err(ApiError::new("invalid_input", "this host is not allowed"));
        }
        let client = reqwest::blocking::Client::builder()
            .user_agent("ComponentInventory (part look-up)")
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .map_err(|e| ApiError::new("network", e.to_string()))?;
        let resp = client.get(u).send().map_err(|e| ApiError::new("network", e.to_string()))?;
        if !resp.status().is_success() {
            return Err(ApiError::new("network", format!("HTTP {}", resp.status())));
        }
        let text = resp.text().map_err(|e| ApiError::new("network", e.to_string()))?;
        Ok(text.chars().take(2 * 1024 * 1024).collect())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn v(s: &str) -> semver::Version {
        semver::Version::parse(s).unwrap()
    }

    #[test]
    fn update_picks_the_newest_allowed_release() {
        let rel = vec![
            json!({"tag_name": "v0.3.1", "html_url": "a"}),
            json!({"tag_name": "v1.0.0-beta.2", "html_url": "b"}),
            json!({"tag_name": "nonsense"}),
        ];
        assert_eq!(pick_update(&v("1.0.0-beta.1"), &rel).status, "available");
        assert_eq!(pick_update(&v("1.0.0-beta.2"), &rel).status, "current");
        // A stable build is not told about betas.
        assert_eq!(pick_update(&v("0.3.1"), &rel).status, "current");
        let rel = vec![json!({"tag_name": "v1.0.0", "html_url": "c"})];
        let u = pick_update(&v("1.0.0-beta.9"), &rel);
        assert_eq!((u.status.as_str(), u.latest.as_deref()), ("available", Some("1.0.0")));
    }
}
