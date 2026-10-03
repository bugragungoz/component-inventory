//! Atomic imports with an exact undo.
//!
//! One transaction per import. Every part the import creates, changes or removes is recorded in
//! `import_batch_items` with its state before and after, and every stock movement it writes carries
//! the batch id. Undo reverses only that batch: it gives back the quantity the import added (or
//! set), restores fields only where nobody changed them since, and reports what it left alone.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::components::{self, delete_in, find_by_code, get, insert, restore_in, sanitize, update};
use crate::db::{int, now, text};
use crate::error::{invalid, CoreError, Result};
use crate::model::{BomLink, Component, ComponentInput, DeletedSnapshot, MAX_IMPORT_QUANTITY, MAX_QUANTITY, UNCATEGORIZED};
use crate::movements::record_movement;

pub const MAX_IMPORT_ROWS: usize = 20_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportMode {
    /// Quantities are added to the stock; new parts are created; empty fields are filled.
    Add,
    /// Quantities are set to the file's; non-empty fields from the file overwrite.
    Sync,
    /// Every part is removed first; BOM lines are re-linked by part code.
    Replace,
}

impl ImportMode {
    fn as_str(self) -> &'static str {
        match self {
            ImportMode::Add => "add",
            ImportMode::Sync => "sync",
            ImportMode::Replace => "replace",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ImportRow {
    pub part_code: String,
    pub quantity: i64,
    pub category: String,
    pub subcategory: String,
    pub package: String,
    pub manufacturer: String,
    pub mpn: String,
    pub location: String,
    pub preferred_supplier: String,
    pub description: String,
    pub datasheet_url: String,
    pub notes: String,
    pub resistance: String,
    pub tolerance: String,
    pub voltage_max: Option<f64>,
    pub current_max: Option<f64>,
    pub power_rating: Option<f64>,
    pub unit_price: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportRequest {
    #[serde(default)]
    pub source_label: String,
    /// "file", "extension", "pdf", "kicad" ...
    #[serde(default)]
    pub source_kind: String,
    pub mode: ImportMode,
    pub rows: Vec<ImportRow>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ImportResult {
    pub batch_id: i64,
    pub created: i64,
    pub updated: i64,
    pub unchanged: i64,
    pub removed: i64,
    /// Sum of the quantities that went into stock.
    pub pieces: i64,
    pub backup_file: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportBatch {
    pub id: i64,
    pub created_at: String,
    pub source_label: String,
    pub source_kind: String,
    pub mode: String,
    pub row_count: i64,
    pub created: i64,
    pub updated: i64,
    pub removed: i64,
    pub pieces: i64,
    pub status: String,
    pub undone_at: Option<String>,
    pub backup_file: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportBatchItem {
    pub part_code: String,
    pub component_id: i64,
    pub action: String,
    pub qty_before: i64,
    pub qty_after: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportBatchDetail {
    pub batch: ImportBatch,
    pub items: Vec<ImportBatchItem>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UndoNote {
    pub part_code: String,
    /// "deleted_since", "edited_since", "used_in_project", "stock_below", "code_taken"
    pub reason: String,
    pub field: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct UndoResult {
    pub batch_id: i64,
    pub reverted: i64,
    pub deleted: i64,
    pub restored: i64,
    pub notes: Vec<UndoNote>,
    pub backup_file: String,
}

/// Same code on several lines counts once, quantities summed; other fields keep the first
/// non-empty value. Lines are cleaned and checked; an invalid line fails the whole import.
pub fn consolidate(rows: &[ImportRow]) -> Result<Vec<ImportRow>> {
    if rows.len() > MAX_IMPORT_ROWS {
        return Err(invalid(format!("an import holds at most {MAX_IMPORT_ROWS} lines")));
    }
    let mut out: Vec<ImportRow> = Vec::new();
    let mut index = std::collections::HashMap::<String, usize>::new();
    for (i, raw) in rows.iter().enumerate() {
        let code = raw.part_code.trim();
        if code.is_empty() {
            return Err(invalid(format!("line {} has no part code", i + 1)));
        }
        if code.chars().count() > 128 {
            return Err(invalid(format!("line {}: the part code is longer than 128 characters", i + 1)));
        }
        if raw.quantity < 0 || raw.quantity > MAX_IMPORT_QUANTITY {
            return Err(invalid(format!("line {}: quantity must be between 0 and {MAX_IMPORT_QUANTITY}", i + 1)));
        }
        match index.get(code) {
            Some(&at) => {
                let seen = &mut out[at];
                seen.quantity = (seen.quantity + raw.quantity).min(MAX_QUANTITY);
                macro_rules! keep_first {
                    ($($f:ident),*) => {$( if seen.$f.trim().is_empty() && !raw.$f.trim().is_empty() { seen.$f = raw.$f.clone(); } )*};
                }
                keep_first!(
                    category,
                    subcategory,
                    package,
                    manufacturer,
                    mpn,
                    location,
                    preferred_supplier,
                    description,
                    datasheet_url,
                    notes,
                    resistance,
                    tolerance
                );
                seen.voltage_max = seen.voltage_max.or(raw.voltage_max);
                seen.current_max = seen.current_max.or(raw.current_max);
                seen.power_rating = seen.power_rating.or(raw.power_rating);
                seen.unit_price = seen.unit_price.or(raw.unit_price);
            }
            None => {
                let mut r = raw.clone();
                r.part_code = code.to_string();
                index.insert(code.to_string(), out.len());
                out.push(r);
            }
        }
    }
    Ok(out)
}

fn row_to_input(r: &ImportRow) -> ComponentInput {
    ComponentInput {
        id: None,
        part_code: r.part_code.clone(),
        category: r.category.clone(),
        subcategory: r.subcategory.clone(),
        quantity: r.quantity,
        package: r.package.clone(),
        manufacturer: r.manufacturer.clone(),
        mpn: r.mpn.clone(),
        location: r.location.clone(),
        preferred_supplier: r.preferred_supplier.clone(),
        voltage_max: r.voltage_max,
        current_max: r.current_max,
        resistance: r.resistance.clone(),
        tolerance: r.tolerance.clone(),
        power_rating: r.power_rating,
        description: r.description.clone(),
        datasheet_url: if r.datasheet_url.starts_with("http://") || r.datasheet_url.starts_with("https://") {
            r.datasheet_url.clone()
        } else {
            String::new()
        },
        unit_price: r.unit_price,
        notes: r.notes.clone(),
        image_path: String::new(),
        attributes: Default::default(),
        custom_fields: Default::default(),
    }
}

fn is_empty_category(c: &str) -> bool {
    c.trim().is_empty() || c == UNCATEGORIZED
}

/// The next state of an existing part under `mode`.
fn merge_into(existing: &Component, row: &ImportRow, mode: ImportMode) -> ComponentInput {
    let mut next = ComponentInput::from(existing);
    let overwrite = mode == ImportMode::Sync;
    next.quantity = match mode {
        ImportMode::Add => (existing.quantity + row.quantity).min(MAX_QUANTITY),
        _ => row.quantity,
    };
    let incoming = row_to_input(row);
    if !is_empty_category(&incoming.category) && (overwrite || is_empty_category(&next.category)) {
        next.category = incoming.category.clone();
    }
    macro_rules! take_text {
        ($($f:ident),*) => {$(
            if !incoming.$f.trim().is_empty() && (overwrite || next.$f.trim().is_empty()) { next.$f = incoming.$f.clone(); }
        )*};
    }
    take_text!(
        subcategory,
        package,
        manufacturer,
        mpn,
        location,
        preferred_supplier,
        description,
        datasheet_url,
        notes,
        resistance,
        tolerance
    );
    macro_rules! take_num {
        ($($f:ident),*) => {$(
            if incoming.$f.is_some() && (overwrite || next.$f.is_none()) { next.$f = incoming.$f; }
        )*};
    }
    take_num!(voltage_max, current_max, power_rating, unit_price);
    next
}

fn same_fields(a: &ComponentInput, b: &ComponentInput) -> bool {
    let mut a = a.clone();
    let mut b = b.clone();
    a.id = None;
    b.id = None;
    a == b
}

#[allow(clippy::too_many_arguments)]
fn add_item(
    tx: &Transaction,
    batch: i64,
    seq: i64,
    c_id: i64,
    code: &str,
    action: &str,
    before: i64,
    after: i64,
    before_json: Option<String>,
    after_json: Option<String>,
) -> Result<()> {
    tx.execute(
        "INSERT INTO import_batch_items (batch_id, seq, component_id, part_code, action, qty_before, qty_after, before_json, after_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![batch, seq, c_id, code, action, before, after, before_json, after_json],
    )?;
    Ok(())
}

/// Applies an import in one transaction. `backup_file` is the backup taken just before.
pub fn apply(conn: &mut Connection, req: &ImportRequest, backup_file: &str) -> Result<ImportResult> {
    let rows = consolidate(&req.rows)?;
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO import_batches (created_at, source_label, source_kind, mode, row_count, backup_file)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            now(),
            req.source_label.chars().take(200).collect::<String>(),
            req.source_kind.chars().take(40).collect::<String>(),
            req.mode.as_str(),
            rows.len() as i64,
            backup_file
        ],
    )?;
    let batch = tx.last_insert_rowid();
    let mut res = ImportResult { batch_id: batch, backup_file: backup_file.to_string(), ..Default::default() };
    let mut seq = 0i64;

    let mut relink: Vec<(String, BomLink)> = Vec::new();
    if req.mode == ImportMode::Replace {
        let all = components::list(&tx)?;
        for c in &all {
            let links = components::bom_links_for(&tx, &[c.id])?;
            for l in &links {
                relink.push((c.part_code.clone(), l.clone()));
            }
            let snap = DeletedSnapshot { components: vec![c.clone()], bom_rows: links };
            seq += 1;
            add_item(&tx, batch, seq, c.id, &c.part_code, "removed", c.quantity, 0, Some(serde_json::to_string(&snap)?), None)?;
        }
        let ids: Vec<i64> = all.iter().map(|c| c.id).collect();
        delete_in(&tx, &ids, "import-replace", Some(batch))?;
        res.removed = ids.len() as i64;
    }

    for row in &rows {
        let existing = if req.mode == ImportMode::Replace { None } else { find_by_code(&tx, &row.part_code)? };
        match existing {
            None => {
                let input = sanitize(&row_to_input(row))?;
                let created = insert(&tx, &input, "import", Some(batch))?;
                seq += 1;
                add_item(
                    &tx,
                    batch,
                    seq,
                    created.id,
                    &created.part_code,
                    "created",
                    0,
                    created.quantity,
                    None,
                    Some(serde_json::to_string(&created)?),
                )?;
                res.created += 1;
                res.pieces += created.quantity;
            }
            Some(c) => {
                let next = sanitize(&merge_into(&c, row, req.mode))?;
                if same_fields(&next, &ComponentInput::from(&c)) {
                    seq += 1;
                    add_item(&tx, batch, seq, c.id, &c.part_code, "unchanged", c.quantity, c.quantity, None, None)?;
                    res.unchanged += 1;
                    continue;
                }
                let after = update(&tx, c.id, &next, "import", Some(batch))?;
                seq += 1;
                add_item(
                    &tx,
                    batch,
                    seq,
                    c.id,
                    &c.part_code,
                    "updated",
                    c.quantity,
                    after.quantity,
                    Some(serde_json::to_string(&c)?),
                    Some(serde_json::to_string(&after)?),
                )?;
                res.updated += 1;
                res.pieces += (after.quantity - c.quantity).max(0);
            }
        }
    }

    // Replace gave every part a new id; BOM lines follow by part code.
    for (code, link) in relink {
        if let Some(c) = find_by_code(&tx, &code)? {
            tx.execute(
                "INSERT OR IGNORE INTO project_components (project_id, component_id, required_qty, note, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![link.project_id, c.id, link.required_qty, link.note, link.created_at, now()],
            )?;
        }
    }

    tx.execute(
        "UPDATE import_batches SET created = ?1, updated = ?2, removed = ?3, pieces = ?4 WHERE id = ?5",
        params![res.created, res.updated, res.removed, res.pieces, batch],
    )?;
    tx.commit()?;
    Ok(res)
}

fn batch_from_row(r: &rusqlite::Row) -> rusqlite::Result<ImportBatch> {
    Ok(ImportBatch {
        id: r.get(0)?,
        created_at: text(r, 1),
        source_label: text(r, 2),
        source_kind: text(r, 3),
        mode: text(r, 4),
        row_count: int(r, 5),
        created: int(r, 6),
        updated: int(r, 7),
        removed: int(r, 8),
        pieces: int(r, 9),
        status: text(r, 10),
        undone_at: r.get::<_, Option<String>>(11)?,
        backup_file: text(r, 12),
    })
}

const BATCH_COLUMNS: &str =
    "id, created_at, source_label, source_kind, mode, row_count, created, updated, removed, pieces, status, undone_at, backup_file";

pub fn list(conn: &Connection, limit: i64) -> Result<Vec<ImportBatch>> {
    let mut stmt = conn.prepare(&format!("SELECT {BATCH_COLUMNS} FROM import_batches ORDER BY id DESC LIMIT ?1"))?;
    let rows = stmt.query_map([limit.clamp(1, 1000)], batch_from_row)?.collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_batch(conn: &Connection, id: i64) -> Result<ImportBatchDetail> {
    let batch = conn
        .query_row(&format!("SELECT {BATCH_COLUMNS} FROM import_batches WHERE id = ?1"), [id], batch_from_row)
        .optional()?
        .ok_or_else(|| CoreError::NotFound(format!("import {id}")))?;
    let mut stmt = conn.prepare(
        "SELECT part_code, component_id, action, qty_before, qty_after FROM import_batch_items WHERE batch_id = ?1 ORDER BY seq",
    )?;
    let items = stmt
        .query_map([id], |r| {
            Ok(ImportBatchItem {
                part_code: text(r, 0),
                component_id: r.get(1)?,
                action: text(r, 2),
                qty_before: int(r, 3),
                qty_after: int(r, 4),
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(ImportBatchDetail { batch, items })
}

struct Item {
    component_id: i64,
    part_code: String,
    action: String,
    qty_before: i64,
    qty_after: i64,
    before_json: Option<String>,
    after_json: Option<String>,
}

/// Field-by-field comparison helpers for undo. Values are compared as JSON so numbers and text
/// work the same way.
const UNDO_FIELDS: &[&str] = &[
    "part_code",
    "category",
    "subcategory",
    "package",
    "manufacturer",
    "mpn",
    "location",
    "preferred_supplier",
    "description",
    "datasheet_url",
    "notes",
    "resistance",
    "tolerance",
    "voltage_max",
    "current_max",
    "power_rating",
    "unit_price",
];

fn field(c: &Value, f: &str) -> Value {
    c.get(f).cloned().unwrap_or(Value::Null)
}

pub fn undo(conn: &mut Connection, batch_id: i64, backup_file: &str) -> Result<UndoResult> {
    let tx = conn.transaction()?;
    let status: Option<String> = tx.query_row("SELECT status FROM import_batches WHERE id = ?1", [batch_id], |r| r.get(0)).optional()?;
    match status.as_deref() {
        None => return Err(CoreError::NotFound(format!("import {batch_id}"))),
        Some("applied") => {}
        Some(_) => return Err(CoreError::Conflict("this import was already undone".into())),
    }
    let items: Vec<Item> = {
        let mut stmt = tx.prepare(
            "SELECT component_id, part_code, action, qty_before, qty_after, before_json, after_json
               FROM import_batch_items WHERE batch_id = ?1 ORDER BY seq DESC",
        )?;
        let rows = stmt.query_map([batch_id], |r| {
            Ok(Item {
                component_id: r.get(0)?,
                part_code: text(r, 1),
                action: text(r, 2),
                qty_before: int(r, 3),
                qty_after: int(r, 4),
                before_json: r.get(5)?,
                after_json: r.get(6)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    let mode: String = tx.query_row("SELECT mode FROM import_batches WHERE id = ?1", [batch_id], |r| r.get(0))?;
    let replace = mode == "replace";
    let mut res = UndoResult { batch_id, backup_file: backup_file.to_string(), ..Default::default() };
    let note = |res: &mut UndoResult, code: &str, reason: &str, field: Option<&str>| {
        res.notes.push(UndoNote { part_code: code.to_string(), reason: reason.to_string(), field: field.map(str::to_string) });
    };

    for it in &items {
        match it.action.as_str() {
            "created" => {
                let Some(current) = tx
                    .query_row(
                        &format!("SELECT {} FROM components WHERE id = ?1", components::COLUMNS),
                        [it.component_id],
                        components::from_row,
                    )
                    .optional()?
                else {
                    note(&mut res, &it.part_code, "deleted_since", None);
                    continue;
                };
                let added = it.qty_after - it.qty_before;
                let left = current.quantity - added;
                let after: Value = it.after_json.as_deref().map(serde_json::from_str).transpose()?.unwrap_or(Value::Null);
                let now_v = serde_json::to_value(&current)?;
                let edited: Vec<&str> = UNDO_FIELDS.iter().copied().filter(|f| field(&now_v, f) != field(&after, f)).collect();
                let in_project: i64 =
                    tx.query_row("SELECT COUNT(*) FROM project_components WHERE component_id = ?1", [current.id], |r| r.get(0))?;
                if replace || (left <= 0 && edited.is_empty() && in_project == 0) {
                    delete_in(&tx, &[current.id], "import-undo", Some(batch_id))?;
                    res.deleted += 1;
                    if left < 0 {
                        note(&mut res, &it.part_code, "stock_below", None);
                    }
                } else {
                    let qty = left.max(0);
                    if left < 0 {
                        note(&mut res, &it.part_code, "stock_below", None);
                    }
                    if !edited.is_empty() {
                        note(&mut res, &it.part_code, "edited_since", None);
                    } else if in_project > 0 {
                        note(&mut res, &it.part_code, "used_in_project", None);
                    }
                    if qty != current.quantity {
                        tx.execute("UPDATE components SET quantity = ?1, updated_at = ?2 WHERE id = ?3", params![qty, now(), current.id])?;
                        record_movement(&tx, current.id, &current.part_code, qty - current.quantity, qty, "import-undo", Some(batch_id))?;
                    }
                    res.reverted += 1;
                }
            }
            "updated" => {
                let current = match get(&tx, it.component_id) {
                    Ok(c) => c,
                    Err(CoreError::NotFound(_)) => {
                        note(&mut res, &it.part_code, "deleted_since", None);
                        continue;
                    }
                    Err(e) => return Err(e),
                };
                let before: Value = it.before_json.as_deref().map(serde_json::from_str).transpose()?.unwrap_or(Value::Null);
                let after: Value = it.after_json.as_deref().map(serde_json::from_str).transpose()?.unwrap_or(Value::Null);
                let now_v = serde_json::to_value(&current)?;
                let mut next_v = now_v.clone();
                for f in UNDO_FIELDS {
                    let (b, a, n) = (field(&before, f), field(&after, f), field(&now_v, f));
                    if b == a {
                        continue;
                    }
                    if n == a {
                        next_v[*f] = b;
                    } else {
                        note(&mut res, &it.part_code, "edited_since", Some(f));
                    }
                }
                let delta = it.qty_after - it.qty_before;
                let left = current.quantity - delta;
                if left < 0 {
                    note(&mut res, &it.part_code, "stock_below", None);
                }
                // A part an earlier, already undone import created, that this undo empties, goes
                // away too (unless it is on a BOM).
                if left <= 0 {
                    let created_by_undone: i64 = tx.query_row(
                        "SELECT COUNT(*) FROM import_batch_items i JOIN import_batches b ON b.id = i.batch_id
                          WHERE i.component_id = ?1 AND i.action = 'created' AND b.status = 'undone'",
                        [current.id],
                        |r| r.get(0),
                    )?;
                    let in_project: i64 =
                        tx.query_row("SELECT COUNT(*) FROM project_components WHERE component_id = ?1", [current.id], |r| r.get(0))?;
                    if created_by_undone > 0 && in_project == 0 {
                        delete_in(&tx, &[current.id], "import-undo", Some(batch_id))?;
                        res.deleted += 1;
                        continue;
                    }
                }
                next_v["quantity"] = Value::from(left.clamp(0, MAX_QUANTITY));
                let next_c: Component = serde_json::from_value(next_v)?;
                let mut input = ComponentInput::from(&next_c);
                if input.part_code != current.part_code && find_by_code(&tx, &input.part_code)?.is_some() {
                    note(&mut res, &it.part_code, "code_taken", Some("part_code"));
                    input.part_code = current.part_code.clone();
                }
                let input = sanitize(&input)?;
                update(&tx, current.id, &input, "import-undo", Some(batch_id))?;
                res.reverted += 1;
            }
            "removed" => {
                let snap: DeletedSnapshot = it.before_json.as_deref().map(serde_json::from_str).transpose()?.unwrap_or_default();
                let skipped = restore_in(&tx, &snap, "import-undo", Some(batch_id))?;
                res.restored += (snap.components.len() - skipped.len()) as i64;
                for code in skipped {
                    note(&mut res, &code, "code_taken", None);
                }
            }
            _ => {}
        }
    }
    tx.execute("UPDATE import_batches SET status = 'undone', undone_at = ?1 WHERE id = ?2", params![now(), batch_id])?;
    tx.commit()?;
    Ok(res)
}
