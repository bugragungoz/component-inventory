//! Errors. `CoreError` is what the library returns; `ApiError` is what crosses the boundary to the
//! frontend: a stable machine code the UI translates, plus an English detail for logs.

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("file error: {0}")]
    Io(#[from] std::io::Error),
    #[error("data error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("a part with code {0} already exists")]
    DuplicatePartCode(String),
    #[error("the database was written by a newer version of the app (schema {0})")]
    NewerSchema(i64),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("export error: {0}")]
    Export(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;

/// Error shape sent to the frontend. `code` selects a translated message; `detail` is English and
/// never contains personal data beyond what the user typed (part codes, file names).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ApiError {
    pub code: String,
    pub detail: String,
}

impl ApiError {
    pub fn new(code: &str, detail: impl Into<String>) -> Self {
        Self { code: code.to_string(), detail: detail.into() }
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.detail)
    }
}

impl std::error::Error for ApiError {}

impl From<CoreError> for ApiError {
    fn from(e: CoreError) -> Self {
        let code = match &e {
            CoreError::Db(_) => "database",
            CoreError::Io(_) => "file",
            CoreError::Json(_) => "data",
            CoreError::NotFound(_) => "not_found",
            CoreError::Invalid(_) => "invalid_input",
            CoreError::DuplicatePartCode(_) => "duplicate_part_code",
            CoreError::NewerSchema(_) => "newer_schema",
            CoreError::Conflict(_) => "conflict",
            CoreError::Export(_) => "export",
        };
        ApiError::new(code, e.to_string())
    }
}

pub fn invalid(msg: impl Into<String>) -> CoreError {
    CoreError::Invalid(msg.into())
}
