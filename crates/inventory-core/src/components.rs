//! Parts: list, read, create, update, delete (with an exact undo), quick stock changes, renames.

use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use serde_json::Value;

use crate::db::{int, json_object, now, opt_f64, sql_opt_f64, text};
use crate::error::{invalid, CoreError, Result};
use crate::model::{BomLink, Component, ComponentInput, DeletedSnapshot, MAX_QUANTITY, UNCATEGORIZED};
use crate::movements::record_movement;

pub const COLUMNS: &str = "id, part_code, category, subcategory, quantity, package, manufacturer, mpn, \
    location, preferred_supplier, voltage_max, current_max, resistance, tolerance, power_rating, \
    description, datasheet_url, unit_price, notes, image_path, attributes, custom_fields, created_at, updated_at";

pub fn from_row(r: &Row) -> rusqlite::Result<Component> {
    Ok(Component {
        id: r.get(0)?,
        part_code: text(r, 1),
        category: text(r, 2),
        subcategory: text(r, 3),
        quantity: int(r, 4),
        package: text(r, 5),
        manufacturer: text(r, 6),
        mpn: text(r, 7),
        location: text(r, 8),
        preferred_supplier: text(r, 9),
        voltage_max: opt_f64(r, 10),
        current_max: opt_f64(r, 11),
        resistance: text(r, 12),
        tolerance: text(r, 13),
        power_rating: opt_f64(r, 14),
        description: text(r, 15),
        datasheet_url: text(r, 16),
        unit_price: opt_f64(r, 17),
        notes: text(r, 18),
        image_path: text(r, 19),
        attributes: json_object(r, 20),
        custom_fields: json_object(r, 21),
        created_at: text(r, 22),
        updated_at: text(r, 23),
    })
}

pub fn list(conn: &Connection) -> Result<Vec<Component>> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM components ORDER BY part_code COLLATE NOCASE"))?;
    let rows = stmt.query_map([], from_row)?.collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get(conn: &Connection, id: i64) -> Result<Component> {
    conn.query_row(&format!("SELECT {COLUMNS} FROM components WHERE id = ?1"), [id], from_row)
        .optional()?
        .ok_or_else(|| CoreError::NotFound(format!("part {id}")))
}

pub fn find_by_code(conn: &Connection, part_code: &str) -> Result<Option<Component>> {
    Ok(conn.query_row(&format!("SELECT {COLUMNS} FROM components WHERE part_code = ?1"), [part_code], from_row).optional()?)
}

fn clean(s: &str, max: usize) -> String {
    let t = s.trim();
    if t.chars().count() > max {
        t.chars().take(max).collect()
    } else {
        t.to_string()
    }
}

fn finite(v: Option<f64>) -> Option<f64> {
    v.filter(|f| f.is_finite())
}

/// Validates and trims what the form sent.
pub fn sanitize(input: &ComponentInput) -> Result<ComponentInput> {
    let part_code = clean(&input.part_code, 128);
    if part_code.is_empty() {
        return Err(invalid("part_code is required"));
    }
    if input.quantity < 0 || input.quantity > MAX_QUANTITY {
        return Err(invalid(format!("quantity must be between 0 and {MAX_QUANTITY}")));
    }
    let url = clean(&input.datasheet_url, 2000);
    if !url.is_empty() && !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(invalid("datasheet_url must start with https:// or http://"));
    }
    let category = clean(&input.category, 80);
    Ok(ComponentInput {
        id: input.id,
        part_code,
        category: if category.is_empty() { UNCATEGORIZED.to_string() } else { category },
        subcategory: clean(&input.subcategory, 120),
        quantity: input.quantity,
        package: clean(&input.package, 120),
        manufacturer: clean(&input.manufacturer, 160),
        mpn: clean(&input.mpn, 128),
        location: clean(&input.location, 160),
        preferred_supplier: clean(&input.preferred_supplier, 160),
        voltage_max: finite(input.voltage_max),
        current_max: finite(input.current_max),
        resistance: clean(&input.resistance, 64),
        tolerance: clean(&input.tolerance, 64),
        power_rating: finite(input.power_rating),
        description: clean(&input.description, 4000),
        datasheet_url: url,
        unit_price: finite(input.unit_price),
        notes: clean(&input.notes, 20000),
        image_path: clean(&input.image_path, 1000),
        attributes: input.attributes.clone(),
        custom_fields: input.custom_fields.clone(),
    })
}

fn code_taken(tx: &Connection, part_code: &str, except_id: Option<i64>) -> Result<bool> {
    let n: i64 = tx.query_row(
        "SELECT COUNT(*) FROM components WHERE part_code = ?1 AND id <> ?2",
        params![part_code, except_id.unwrap_or(-1)],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

/// Inserts a part and records a "create" movement. Used by the form and by imports.
pub fn insert(tx: &Transaction, c: &ComponentInput, reason: &str, batch: Option<i64>) -> Result<Component> {
    if code_taken(tx, &c.part_code, None)? {
        return Err(CoreError::DuplicatePartCode(c.part_code.clone()));
    }
    let ts = now();
    tx.execute(
        "INSERT INTO components (part_code, category, subcategory, quantity, package, manufacturer, mpn,
           location, preferred_supplier, voltage_max, current_max, resistance, tolerance, power_rating,
           description, datasheet_url, unit_price, notes, image_path, attributes, custom_fields, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?22)",
        params![
            c.part_code,
            c.category,
            c.subcategory,
            c.quantity,
            c.package,
            c.manufacturer,
            c.mpn,
            c.location,
            c.preferred_supplier,
            sql_opt_f64(c.voltage_max),
            sql_opt_f64(c.current_max),
            c.resistance,
            c.tolerance,
            sql_opt_f64(c.power_rating),
            c.description,
            c.datasheet_url,
            sql_opt_f64(c.unit_price),
            c.notes,
            c.image_path,
            Value::Object(c.attributes.clone()).to_string(),
            Value::Object(c.custom_fields.clone()).to_string(),
            ts
        ],
    )?;
    let id = tx.last_insert_rowid();
    if c.quantity != 0 {
        record_movement(tx, id, &c.part_code, c.quantity, c.quantity, reason, batch)?;
    }
    get(tx, id)
}

/// Writes every field of an existing part and records the stock change, if any.
pub fn update(tx: &Transaction, id: i64, c: &ComponentInput, reason: &str, batch: Option<i64>) -> Result<Component> {
    let before = get(tx, id)?;
    if c.part_code != before.part_code && code_taken(tx, &c.part_code, Some(id))? {
        return Err(CoreError::DuplicatePartCode(c.part_code.clone()));
    }
    tx.execute(
        "UPDATE components SET part_code = ?1, category = ?2, subcategory = ?3, quantity = ?4, package = ?5,
           manufacturer = ?6, mpn = ?7, location = ?8, preferred_supplier = ?9, voltage_max = ?10,
           current_max = ?11, resistance = ?12, tolerance = ?13, power_rating = ?14, description = ?15,
           datasheet_url = ?16, unit_price = ?17, notes = ?18, image_path = ?19, attributes = ?20,
           custom_fields = ?21, updated_at = ?22
         WHERE id = ?23",
        params![
            c.part_code,
            c.category,
            c.subcategory,
            c.quantity,
            c.package,
            c.manufacturer,
            c.mpn,
            c.location,
            c.preferred_supplier,
            sql_opt_f64(c.voltage_max),
            sql_opt_f64(c.current_max),
            c.resistance,
            c.tolerance,
            sql_opt_f64(c.power_rating),
            c.description,
            c.datasheet_url,
            sql_opt_f64(c.unit_price),
            c.notes,
            c.image_path,
            Value::Object(c.attributes.clone()).to_string(),
            Value::Object(c.custom_fields.clone()).to_string(),
            now(),
            id
        ],
    )?;
    // Movements keep the code they were written with: the history is a record, not a view.
    let delta = c.quantity - before.quantity;
    if delta != 0 {
        record_movement(tx, id, &c.part_code, delta, c.quantity, reason, batch)?;
    }
    get(tx, id)
}

pub fn save(conn: &mut Connection, input: &ComponentInput) -> Result<Component> {
    let c = sanitize(input)?;
    let tx = conn.transaction()?;
    let out = match c.id {
        Some(id) => update(&tx, id, &c, "edit", None)?,
        None => insert(&tx, &c, "create", None)?,
    };
    tx.commit()?;
    Ok(out)
}

pub fn bom_links_for(conn: &Connection, component_ids: &[i64]) -> Result<Vec<BomLink>> {
    let mut out = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT id, project_id, component_id, required_qty, note, created_at, updated_at
           FROM project_components WHERE component_id = ?1 ORDER BY id",
    )?;
    for id in component_ids {
        let rows = stmt.query_map([id], |r| {
            Ok(BomLink {
                id: r.get(0)?,
                project_id: r.get(1)?,
                component_id: r.get(2)?,
                required_qty: int(r, 3),
                note: text(r, 4),
                created_at: text(r, 5),
                updated_at: text(r, 6),
            })
        })?;
        for row in rows {
            out.push(row?);
        }
    }
    Ok(out)
}

/// Deletes parts and their BOM lines in one transaction. The snapshot puts them back exactly.
pub fn delete(conn: &mut Connection, ids: &[i64], reason: &str) -> Result<DeletedSnapshot> {
    let tx = conn.transaction()?;
    let snapshot = delete_in(&tx, ids, reason, None)?;
    tx.commit()?;
    Ok(snapshot)
}

pub fn delete_in(tx: &Transaction, ids: &[i64], reason: &str, batch: Option<i64>) -> Result<DeletedSnapshot> {
    let mut snapshot = DeletedSnapshot::default();
    for &id in ids {
        let Some(c) = tx.query_row(&format!("SELECT {COLUMNS} FROM components WHERE id = ?1"), [id], from_row).optional()? else {
            continue;
        };
        snapshot.bom_rows.extend(bom_links_for(tx, &[id])?);
        if c.quantity != 0 {
            record_movement(tx, id, &c.part_code, -c.quantity, 0, reason, batch)?;
        }
        tx.execute("DELETE FROM project_components WHERE component_id = ?1", [id])?;
        tx.execute("DELETE FROM components WHERE id = ?1", [id])?;
        snapshot.components.push(c);
    }
    Ok(snapshot)
}

/// Puts deleted parts back with their old ids and BOM lines. Parts whose code was taken again in the
/// meantime are skipped and returned.
pub fn restore(conn: &mut Connection, snapshot: &DeletedSnapshot) -> Result<Vec<String>> {
    let tx = conn.transaction()?;
    let skipped = restore_in(&tx, snapshot, "restore", None)?;
    tx.commit()?;
    Ok(skipped)
}

pub fn restore_in(tx: &Transaction, snapshot: &DeletedSnapshot, reason: &str, batch: Option<i64>) -> Result<Vec<String>> {
    let mut skipped = Vec::new();
    let mut restored = Vec::new();
    for c in &snapshot.components {
        if code_taken(tx, &c.part_code, None)? {
            skipped.push(c.part_code.clone());
            continue;
        }
        let id_free: bool = tx.query_row("SELECT id FROM components WHERE id = ?1", [c.id], |r| r.get::<_, i64>(0)).optional()?.is_none();
        let id = if id_free { Some(c.id) } else { None };
        tx.execute(
            "INSERT INTO components (id, part_code, category, subcategory, quantity, package, manufacturer, mpn,
               location, preferred_supplier, voltage_max, current_max, resistance, tolerance, power_rating,
               description, datasheet_url, unit_price, notes, image_path, attributes, custom_fields, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            params![
                id,
                c.part_code,
                c.category,
                c.subcategory,
                c.quantity,
                c.package,
                c.manufacturer,
                c.mpn,
                c.location,
                c.preferred_supplier,
                sql_opt_f64(c.voltage_max),
                sql_opt_f64(c.current_max),
                c.resistance,
                c.tolerance,
                sql_opt_f64(c.power_rating),
                c.description,
                c.datasheet_url,
                sql_opt_f64(c.unit_price),
                c.notes,
                c.image_path,
                Value::Object(c.attributes.clone()).to_string(),
                Value::Object(c.custom_fields.clone()).to_string(),
                c.created_at,
                now()
            ],
        )?;
        let new_id = tx.last_insert_rowid();
        if c.quantity != 0 {
            record_movement(tx, new_id, &c.part_code, c.quantity, c.quantity, reason, batch)?;
        }
        restored.push((c.id, new_id));
    }
    for link in &snapshot.bom_rows {
        let Some((_, new_id)) = restored.iter().find(|(old, _)| *old == link.component_id) else { continue };
        let project_exists: bool =
            tx.query_row("SELECT id FROM projects WHERE id = ?1", [link.project_id], |r| r.get::<_, i64>(0)).optional()?.is_some();
        if !project_exists {
            continue;
        }
        tx.execute(
            "INSERT OR IGNORE INTO project_components (project_id, component_id, required_qty, note, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![link.project_id, new_id, link.required_qty, link.note, link.created_at, now()],
        )?;
    }
    Ok(skipped)
}

/// Quick +/- on the stock count. Never goes below zero.
pub fn adjust_quantity(conn: &mut Connection, id: i64, delta: i64) -> Result<Component> {
    let tx = conn.transaction()?;
    let c = get(&tx, id)?;
    let after = (c.quantity + delta).clamp(0, MAX_QUANTITY);
    if after != c.quantity {
        tx.execute("UPDATE components SET quantity = ?1, updated_at = ?2 WHERE id = ?3", params![after, now(), id])?;
        record_movement(&tx, id, &c.part_code, after - c.quantity, after, "adjust", None)?;
    }
    let out = get(&tx, id)?;
    tx.commit()?;
    Ok(out)
}

/// Renames a category (or a subcategory within one category) on every part. Returns the count.
pub fn rename_category(conn: &mut Connection, from: &str, to: &str, parent: Option<&str>) -> Result<usize> {
    let to = clean(to, if parent.is_some() { 120 } else { 80 });
    if to.is_empty() {
        return Err(invalid("the new name is empty"));
    }
    let tx = conn.transaction()?;
    let n = match parent {
        Some(cat) => tx.execute(
            "UPDATE components SET subcategory = ?1, updated_at = ?2 WHERE subcategory = ?3 AND category = ?4",
            params![to, now(), from, cat],
        )?,
        None => tx.execute("UPDATE components SET category = ?1, updated_at = ?2 WHERE category = ?3", params![to, now(), from])?,
    };
    tx.commit()?;
    Ok(n)
}

/// Merges duplicates into `keep_id`: quantities add up, empty fields are filled from the others,
/// BOM lines move to the kept part (required quantities add up when both were on one BOM).
pub fn merge(conn: &mut Connection, keep_id: i64, merge_ids: &[i64], part_code: Option<&str>) -> Result<Component> {
    let tx = conn.transaction()?;
    let keep = get(&tx, keep_id)?;
    let mut merged = ComponentInput::from(&keep);
    let mut others = Vec::new();
    for &id in merge_ids {
        if id == keep_id {
            continue;
        }
        others.push(get(&tx, id)?);
    }
    for o in &others {
        merged.quantity = (merged.quantity + o.quantity).min(MAX_QUANTITY);
        fill(&mut merged.category, &o.category, true);
        fill(&mut merged.subcategory, &o.subcategory, false);
        fill(&mut merged.package, &o.package, false);
        fill(&mut merged.manufacturer, &o.manufacturer, false);
        fill(&mut merged.mpn, &o.mpn, false);
        fill(&mut merged.location, &o.location, false);
        fill(&mut merged.preferred_supplier, &o.preferred_supplier, false);
        fill(&mut merged.resistance, &o.resistance, false);
        fill(&mut merged.tolerance, &o.tolerance, false);
        fill(&mut merged.description, &o.description, false);
        fill(&mut merged.datasheet_url, &o.datasheet_url, false);
        fill(&mut merged.notes, &o.notes, false);
        fill(&mut merged.image_path, &o.image_path, false);
        merged.voltage_max = merged.voltage_max.or(o.voltage_max);
        merged.current_max = merged.current_max.or(o.current_max);
        merged.power_rating = merged.power_rating.or(o.power_rating);
        merged.unit_price = merged.unit_price.or(o.unit_price);
        for (k, v) in &o.attributes {
            merged.attributes.entry(k.clone()).or_insert_with(|| v.clone());
        }
        for (k, v) in &o.custom_fields {
            merged.custom_fields.entry(k.clone()).or_insert_with(|| v.clone());
        }
    }
    // Move BOM lines before the others are deleted.
    for o in &others {
        for link in bom_links_for(&tx, &[o.id])? {
            let existing: Option<i64> = tx
                .query_row(
                    "SELECT id FROM project_components WHERE project_id = ?1 AND component_id = ?2",
                    params![link.project_id, keep_id],
                    |r| r.get(0),
                )
                .optional()?;
            match existing {
                Some(eid) => {
                    tx.execute(
                        "UPDATE project_components SET required_qty = required_qty + ?1, updated_at = ?2 WHERE id = ?3",
                        params![link.required_qty, now(), eid],
                    )?;
                }
                None => {
                    tx.execute(
                        "UPDATE project_components SET component_id = ?1, updated_at = ?2 WHERE id = ?3",
                        params![keep_id, now(), link.id],
                    )?;
                }
            }
        }
    }
    let other_ids: Vec<i64> = others.iter().map(|o| o.id).collect();
    for o in &others {
        if o.quantity != 0 {
            record_movement(&tx, o.id, &o.part_code, -o.quantity, 0, "merge", None)?;
        }
        tx.execute("DELETE FROM project_components WHERE component_id = ?1", [o.id])?;
        tx.execute("DELETE FROM components WHERE id = ?1", [o.id])?;
    }
    if let Some(code) = part_code {
        let code = clean(code, 128);
        if !code.is_empty() {
            merged.part_code = code;
        }
    }
    let merged = sanitize(&merged)?;
    let out = update(&tx, keep_id, &merged, "merge", None)?;
    let _ = other_ids;
    tx.commit()?;
    Ok(out)
}

fn fill(target: &mut String, source: &str, is_category: bool) {
    let empty = target.trim().is_empty() || (is_category && target == UNCATEGORIZED);
    if empty && !source.trim().is_empty() && !(is_category && source == UNCATEGORIZED) {
        *target = source.to_string();
    }
}

/// A partial change for bulk tools (auto-categorize, datasheet backfill, storage places): only the given fields.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(default)]
pub struct ComponentPatch {
    pub id: i64,
    pub part_code: Option<String>,
    pub category: Option<String>,
    pub subcategory: Option<String>,
    pub package: Option<String>,
    pub manufacturer: Option<String>,
    pub mpn: Option<String>,
    pub description: Option<String>,
    pub datasheet_url: Option<String>,
    pub voltage_max: Option<f64>,
    pub current_max: Option<f64>,
    /// The storage place (moving parts into a box, renaming a box); an empty string clears it.
    pub location: Option<String>,
}

pub fn apply_patches(conn: &mut Connection, patches: &[ComponentPatch], reason: &str) -> Result<usize> {
    let tx = conn.transaction()?;
    let mut n = 0;
    for p in patches {
        let current = match get(&tx, p.id) {
            Ok(c) => c,
            Err(CoreError::NotFound(_)) => continue,
            Err(e) => return Err(e),
        };
        let mut next = ComponentInput::from(&current);
        if let Some(v) = &p.part_code {
            next.part_code = v.clone();
        }
        if let Some(v) = &p.category {
            next.category = v.clone();
        }
        if let Some(v) = &p.subcategory {
            next.subcategory = v.clone();
        }
        if let Some(v) = &p.package {
            next.package = v.clone();
        }
        if let Some(v) = &p.manufacturer {
            next.manufacturer = v.clone();
        }
        if let Some(v) = &p.mpn {
            next.mpn = v.clone();
        }
        if let Some(v) = &p.description {
            next.description = v.clone();
        }
        if let Some(v) = &p.datasheet_url {
            next.datasheet_url = v.clone();
        }
        if p.voltage_max.is_some() {
            next.voltage_max = p.voltage_max;
        }
        if p.current_max.is_some() {
            next.current_max = p.current_max;
        }
        if let Some(v) = &p.location {
            next.location = v.clone();
        }
        let next = sanitize(&next)?;
        update(&tx, p.id, &next, reason, None)?;
        n += 1;
    }
    tx.commit()?;
    Ok(n)
}
