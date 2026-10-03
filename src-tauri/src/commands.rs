//! Tauri commands generated from `inventory_core::for_each_command!`, so the shell exposes exactly
//! the shared command list (the test bridge uses the same list). Each one runs on a blocking
//! thread, never on the UI thread.

#![allow(clippy::unused_unit)]

use inventory_core::api::*;
use inventory_core::imports::{ImportBatch, ImportBatchDetail, ImportResult, UndoResult};
use inventory_core::model::*;
use inventory_core::settings::AppSettings;
use inventory_core::sync::SyncStatus;
use inventory_core::ApiError;

use crate::AppState;

macro_rules! tauri_commands {
    ($($name:ident($args:ty) -> $ret:ty),* $(,)?) => {
        $(
            #[tauri::command]
            pub async fn $name(state: tauri::State<'_, AppState>, args: $args) -> Result<$ret, ApiError> {
                let core = state.core()?;
                tauri::async_runtime::spawn_blocking(move || inventory_core::api::$name(&core, args).map_err(ApiError::from))
                    .await
                    .map_err(|e| ApiError::new("internal", e.to_string()))?
            }
        )*
    };
}

inventory_core::for_each_command!(tauri_commands);

macro_rules! make_handler {
    ($($name:ident($args:ty) -> $ret:ty),* $(,)?) => {
        tauri::generate_handler![
            $(crate::commands::$name,)*
            crate::desktop::pick_folder,
            crate::desktop::pick_component_image,
            crate::desktop::read_image,
            crate::desktop::pick_schematic,
            crate::desktop::read_schematic,
            crate::desktop::export_inventory,
            crate::desktop::save_generated_file,
            crate::desktop::open_url,
            crate::desktop::open_folder,
            crate::desktop::take_deep_links,
            crate::desktop::check_update,
            crate::desktop::fetch_shop_page,
            crate::desktop::startup_status
        ]
    };
}

pub fn handler() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    inventory_core::for_each_command!(make_handler)
}
