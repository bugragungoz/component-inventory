//! Data layer of Component Inventory. Pure Rust (rusqlite with bundled SQLite), no Tauri: the
//! desktop shell (`src-tauri`) and the test bridge (`crates/inventory-bridge`) both call `api`.

pub mod api;
pub mod backup;
pub mod components;
pub mod core;
pub mod custom_columns;
pub mod db;
pub mod diff;
pub mod error;
pub mod export;
pub mod imports;
pub mod library;
pub mod model;
pub mod movements;
pub mod projects;
pub mod schema;
pub mod settings;
pub mod sync;
pub mod taxonomy;

pub use crate::core::Core;
pub use crate::error::{ApiError, CoreError};
