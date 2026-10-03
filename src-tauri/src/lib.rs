//! The desktop shell: thin typed commands over `inventory_core`, plus what only a desktop app does
//! (native dialogs, deep links, single instance, the backup and Drive timers, the update check).

mod commands;
mod deeplink;
mod desktop;
mod timers;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use inventory_core::{ApiError, Core};
use tauri::Manager;

pub struct AppState {
    core: Option<Arc<Core>>,
    startup_error: Option<ApiError>,
    pub(crate) deep_links: Mutex<Vec<String>>,
}

impl AppState {
    pub fn core(&self) -> Result<Arc<Core>, ApiError> {
        match (&self.core, &self.startup_error) {
            (Some(c), _) => Ok(Arc::clone(c)),
            (None, Some(e)) => Err(e.clone()),
            (None, None) => Err(ApiError::new("startup", "the database is not open")),
        }
    }
}

/// Where the bundled reference library ends up: next to the resources in an installed app, in
/// `target/` during `tauri dev`, or at the repository root.
fn library_path(app: &tauri::App) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(res) = app.path().resource_dir() {
        candidates.push(res.join("patched.db"));
        candidates.push(res.join("_up_").join("patched.db"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("patched.db"));
    candidates.into_iter().find(|p| p.is_file())
}

/// wry's own WebView2 arguments, which it drops when the app passes any.
const WEBVIEW2_DEFAULT_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

/// Opens the main window from `tauri.conf.json` (where it has `create: false`). WebView2 documents
/// `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, but it ignores the variable once the app passes
/// arguments of its own, and wry always does. The variable is added here so it works as
/// documented; the Windows CI run uses it to reach the built app over its DevTools port.
fn open_main_window(app: &tauri::App) -> tauri::Result<()> {
    let Some(mut config) = app.config().app.windows.iter().find(|w| w.label == "main").cloned() else {
        return Ok(());
    };
    if let Ok(extra) = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
        if !extra.trim().is_empty() {
            config.additional_browser_args = Some(format!("{WEBVIEW2_DEFAULT_ARGS} {}", extra.trim()));
        }
    }
    tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?.build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin: a second launch (or a deep link while running) focuses the
        // first window; the deep-link feature forwards the URL to the deep-link plugin.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                deeplink::bring_to_front(&w);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let library = library_path(app);
            let (core, startup_error) = match Core::open(&data_dir, library) {
                Ok(c) => (Some(Arc::new(c)), None),
                Err(e) => (None, Some(ApiError::from(e))),
            };
            app.manage(AppState { core: core.clone(), startup_error, deep_links: Mutex::new(Vec::new()) });
            deeplink::setup(app);
            if let Some(core) = core {
                timers::start(app.handle().clone(), core);
            }
            // After the state is managed: the page calls commands as soon as it loads.
            open_main_window(app)?;
            Ok(())
        })
        .invoke_handler(commands::handler())
        .run(tauri::generate_context!())
        .expect("error while running Component Inventory");
}
