//! Data shapes shared by the queries, the API and the frontend (mirrored in `src/api/types.ts`).

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub type JsonObject = Map<String, Value>;

/// Category used when a part has none. Stored values are English; labels are localized.
pub const UNCATEGORIZED: &str = "Uncategorized";

/// Largest stock count the app accepts for one part.
pub const MAX_QUANTITY: i64 = 999_999_999;

/// Largest count one import line may carry (as in the old app and the extension).
pub const MAX_IMPORT_QUANTITY: i64 = 999_999;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Component {
    pub id: i64,
    pub part_code: String,
    pub category: String,
    pub subcategory: String,
    pub quantity: i64,
    pub package: String,
    pub manufacturer: String,
    pub mpn: String,
    /// Where the part is kept (drawer, box, shelf). Shown as "Storage place".
    pub location: String,
    pub preferred_supplier: String,
    pub voltage_max: Option<f64>,
    pub current_max: Option<f64>,
    pub resistance: String,
    pub tolerance: String,
    pub power_rating: Option<f64>,
    pub description: String,
    pub datasheet_url: String,
    pub unit_price: Option<f64>,
    pub notes: String,
    pub image_path: String,
    /// Category-specific parameters (`attribute_schemas`), for example `rds_on` for a MOSFET.
    pub attributes: JsonObject,
    /// Values of the user's custom columns, keyed by `custom_columns.col_key`.
    pub custom_fields: JsonObject,
    pub created_at: String,
    pub updated_at: String,
}

/// What the edit form sends. `id: None` creates a part.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ComponentInput {
    pub id: Option<i64>,
    pub part_code: String,
    pub category: String,
    pub subcategory: String,
    pub quantity: i64,
    pub package: String,
    pub manufacturer: String,
    pub mpn: String,
    pub location: String,
    pub preferred_supplier: String,
    pub voltage_max: Option<f64>,
    pub current_max: Option<f64>,
    pub resistance: String,
    pub tolerance: String,
    pub power_rating: Option<f64>,
    pub description: String,
    pub datasheet_url: String,
    pub unit_price: Option<f64>,
    pub notes: String,
    pub image_path: String,
    pub attributes: JsonObject,
    pub custom_fields: JsonObject,
}

impl From<&Component> for ComponentInput {
    fn from(c: &Component) -> Self {
        ComponentInput {
            id: Some(c.id),
            part_code: c.part_code.clone(),
            category: c.category.clone(),
            subcategory: c.subcategory.clone(),
            quantity: c.quantity,
            package: c.package.clone(),
            manufacturer: c.manufacturer.clone(),
            mpn: c.mpn.clone(),
            location: c.location.clone(),
            preferred_supplier: c.preferred_supplier.clone(),
            voltage_max: c.voltage_max,
            current_max: c.current_max,
            resistance: c.resistance.clone(),
            tolerance: c.tolerance.clone(),
            power_rating: c.power_rating,
            description: c.description.clone(),
            datasheet_url: c.datasheet_url.clone(),
            unit_price: c.unit_price,
            notes: c.notes.clone(),
            image_path: c.image_path.clone(),
            attributes: c.attributes.clone(),
            custom_fields: c.custom_fields.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Movement {
    pub id: i64,
    pub component_id: i64,
    pub part_code: String,
    pub delta: i64,
    pub quantity_after: i64,
    pub reason: String,
    pub import_batch_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProjectUse {
    pub project_id: i64,
    pub project_name: String,
    pub required_qty: i64,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComponentDetail {
    pub component: Component,
    pub movements: Vec<Movement>,
    pub projects: Vec<ProjectUse>,
}

/// Everything needed to put deleted parts back exactly (same id, same BOM lines).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct DeletedSnapshot {
    pub components: Vec<Component>,
    pub bom_rows: Vec<BomLink>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct BomLink {
    pub id: i64,
    pub project_id: i64,
    pub component_id: i64,
    pub required_qty: i64,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CustomColumn {
    pub id: i64,
    pub col_key: String,
    pub col_label: String,
    pub col_type: String,
    pub is_visible: bool,
    pub order_index: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub notes: String,
    pub schematic_path: String,
    pub order_index: i64,
    pub created_at: String,
    pub updated_at: String,
    /// Number of BOM lines.
    pub line_count: i64,
    /// Sum over lines of max(0, required - stock).
    pub shortage: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BomRow {
    pub id: i64,
    pub project_id: i64,
    pub component_id: i64,
    pub part_code: String,
    pub description: String,
    pub category: String,
    pub subcategory: String,
    pub stock: i64,
    pub required_qty: i64,
    pub note: String,
    /// Always derived: max(0, required - stock).
    pub shortage: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ProjectSnapshot {
    pub project: Option<ProjectRow>,
    pub bom_rows: Vec<BomLink>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ProjectRow {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub notes: String,
    pub schematic_path: String,
    pub order_index: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UsageSummary {
    pub component_id: i64,
    pub project_count: i64,
    pub total_required: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BackupEntry {
    pub file_name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
    /// "auto", "manual", "pre-import", "pre-migration", "pre-restore", "pre-undo", "pre-bulk", "legacy"
    pub kind: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FieldChange {
    pub field: String,
    pub before: Value,
    pub after: Value,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ChangedPart {
    pub part_code: String,
    pub fields: Vec<FieldChange>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct BackupDiff {
    /// In the current database but not in the backup.
    pub added: Vec<Component>,
    /// In the backup but not in the current database.
    pub removed: Vec<Component>,
    pub changed: Vec<ChangedPart>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MigrationReport {
    pub from_version: i64,
    pub to_version: i64,
    pub backup_path: Option<String>,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LibraryPart {
    pub part_code: String,
    pub mpn: String,
    pub category: String,
    pub subcategory: String,
    pub package: String,
    pub manufacturer: String,
    pub description: String,
    pub datasheet_url: String,
    pub voltage_max: Option<f64>,
    pub current_max: Option<f64>,
    pub resistance: String,
    pub tolerance: String,
    pub power_rating: Option<f64>,
    pub attributes: JsonObject,
}
