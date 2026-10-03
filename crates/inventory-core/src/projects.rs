//! Projects and their bills of materials. The shortage of a line is always derived:
//! max(0, required - stock).

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::db::{int, now, text};
use crate::error::{invalid, CoreError, Result};
use crate::model::{BomLink, BomRow, Project, ProjectRow, ProjectSnapshot, ProjectUse, UsageSummary, MAX_QUANTITY};

fn clean(s: &str, max: usize) -> String {
    s.trim().chars().take(max).collect()
}

pub fn list(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.description, p.notes, p.schematic_path, p.order_index, p.created_at, p.updated_at,
                (SELECT COUNT(*) FROM project_components pc WHERE pc.project_id = p.id),
                (SELECT COALESCE(SUM(MAX(0, pc.required_qty - MAX(0, COALESCE(c.quantity, 0)))), 0)
                   FROM project_components pc JOIN components c ON c.id = pc.component_id WHERE pc.project_id = p.id)
           FROM projects p ORDER BY p.order_index, p.id",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Project {
                id: r.get(0)?,
                name: text(r, 1),
                description: text(r, 2),
                notes: text(r, 3),
                schematic_path: text(r, 4),
                order_index: int(r, 5),
                created_at: text(r, 6),
                updated_at: text(r, 7),
                line_count: int(r, 8),
                shortage: int(r, 9),
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get(conn: &Connection, id: i64) -> Result<Project> {
    list(conn)?.into_iter().find(|p| p.id == id).ok_or_else(|| CoreError::NotFound(format!("project {id}")))
}

pub fn create(conn: &mut Connection, name: &str) -> Result<Project> {
    let name = clean(name, 200);
    if name.is_empty() {
        return Err(invalid("a project needs a name"));
    }
    let tx = conn.transaction()?;
    // New projects go to the top, as in the old app.
    tx.execute("UPDATE projects SET order_index = order_index + 1", [])?;
    let ts = now();
    tx.execute(
        "INSERT INTO projects (name, description, notes, schematic_path, order_index, created_at, updated_at)
         VALUES (?1, '', '', '', 0, ?2, ?2)",
        params![name, ts],
    )?;
    let id = tx.last_insert_rowid();
    tx.commit()?;
    get(conn, id)
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ProjectPatch {
    pub id: i64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    /// Only `Some("")` (clear) is accepted from the frontend; a path is set by the picker.
    pub schematic_path: Option<String>,
}

pub fn update(conn: &Connection, patch: &ProjectPatch) -> Result<Project> {
    get(conn, patch.id)?;
    if let Some(name) = &patch.name {
        let name = clean(name, 200);
        if name.is_empty() {
            return Err(invalid("a project needs a name"));
        }
        conn.execute("UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3", params![name, now(), patch.id])?;
    }
    if let Some(d) = &patch.description {
        conn.execute("UPDATE projects SET description = ?1, updated_at = ?2 WHERE id = ?3", params![clean(d, 4000), now(), patch.id])?;
    }
    if let Some(n) = &patch.notes {
        conn.execute("UPDATE projects SET notes = ?1, updated_at = ?2 WHERE id = ?3", params![clean(n, 50000), now(), patch.id])?;
    }
    if let Some(s) = &patch.schematic_path {
        if !s.is_empty() {
            return Err(invalid("the schematic is chosen with the file dialog"));
        }
        conn.execute("UPDATE projects SET schematic_path = '', updated_at = ?1 WHERE id = ?2", params![now(), patch.id])?;
    }
    get(conn, patch.id)
}

pub fn set_schematic(conn: &Connection, id: i64, path: &str) -> Result<Project> {
    get(conn, id)?;
    conn.execute("UPDATE projects SET schematic_path = ?1, updated_at = ?2 WHERE id = ?3", params![path, now(), id])?;
    get(conn, id)
}

fn links_for_project(conn: &Connection, project_id: i64) -> Result<Vec<BomLink>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, component_id, required_qty, note, created_at, updated_at
           FROM project_components WHERE project_id = ?1 ORDER BY id",
    )?;
    let rows = stmt
        .query_map([project_id], |r| {
            Ok(BomLink {
                id: r.get(0)?,
                project_id: r.get(1)?,
                component_id: r.get(2)?,
                required_qty: int(r, 3),
                note: text(r, 4),
                created_at: text(r, 5),
                updated_at: text(r, 6),
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// Deletes a project and its BOM lines. The snapshot restores both.
pub fn delete(conn: &mut Connection, id: i64) -> Result<ProjectSnapshot> {
    let tx = conn.transaction()?;
    let row = tx
        .query_row(
            "SELECT id, name, description, notes, schematic_path, order_index, created_at, updated_at FROM projects WHERE id = ?1",
            [id],
            |r| {
                Ok(ProjectRow {
                    id: r.get(0)?,
                    name: text(r, 1),
                    description: text(r, 2),
                    notes: text(r, 3),
                    schematic_path: text(r, 4),
                    order_index: int(r, 5),
                    created_at: text(r, 6),
                    updated_at: text(r, 7),
                })
            },
        )
        .optional()?
        .ok_or_else(|| CoreError::NotFound(format!("project {id}")))?;
    let links = links_for_project(&tx, id)?;
    tx.execute("DELETE FROM project_components WHERE project_id = ?1", [id])?;
    tx.execute("DELETE FROM projects WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(ProjectSnapshot { project: Some(row), bom_rows: links })
}

pub fn restore(conn: &mut Connection, snap: &ProjectSnapshot) -> Result<Project> {
    let Some(p) = &snap.project else { return Err(invalid("nothing to restore")) };
    let tx = conn.transaction()?;
    let taken: bool = tx.query_row("SELECT id FROM projects WHERE id = ?1", [p.id], |r| r.get::<_, i64>(0)).optional()?.is_some();
    tx.execute(
        "INSERT INTO projects (id, name, description, notes, schematic_path, order_index, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            if taken { None } else { Some(p.id) },
            p.name,
            p.description,
            p.notes,
            p.schematic_path,
            p.order_index,
            p.created_at,
            now()
        ],
    )?;
    let new_id = tx.last_insert_rowid();
    for l in &snap.bom_rows {
        let exists: bool =
            tx.query_row("SELECT id FROM components WHERE id = ?1", [l.component_id], |r| r.get::<_, i64>(0)).optional()?.is_some();
        if !exists {
            continue;
        }
        tx.execute(
            "INSERT OR IGNORE INTO project_components (project_id, component_id, required_qty, note, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![new_id, l.component_id, l.required_qty, l.note, l.created_at, now()],
        )?;
    }
    tx.commit()?;
    get(conn, new_id)
}

pub fn reorder(conn: &mut Connection, ids: &[i64]) -> Result<()> {
    let tx = conn.transaction()?;
    for (i, id) in ids.iter().enumerate() {
        tx.execute("UPDATE projects SET order_index = ?1 WHERE id = ?2", params![i as i64, id])?;
    }
    tx.commit()?;
    Ok(())
}

pub fn bom(conn: &Connection, project_id: i64) -> Result<Vec<BomRow>> {
    let mut stmt = conn.prepare(
        "SELECT pc.id, pc.project_id, pc.component_id, c.part_code, c.description, c.category, c.subcategory,
                c.quantity, pc.required_qty, pc.note
           FROM project_components pc JOIN components c ON c.id = pc.component_id
          WHERE pc.project_id = ?1 ORDER BY c.part_code COLLATE NOCASE",
    )?;
    let rows = stmt
        .query_map([project_id], |r| {
            let stock = int(r, 7).max(0);
            let required = int(r, 8).max(0);
            Ok(BomRow {
                id: r.get(0)?,
                project_id: r.get(1)?,
                component_id: r.get(2)?,
                part_code: text(r, 3),
                description: text(r, 4),
                category: text(r, 5),
                subcategory: text(r, 6),
                stock,
                required_qty: required,
                note: text(r, 9),
                shortage: (required - stock).max(0),
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn bom_row(conn: &Connection, id: i64) -> Result<BomRow> {
    let project_id: i64 = conn
        .query_row("SELECT project_id FROM project_components WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or_else(|| CoreError::NotFound(format!("BOM line {id}")))?;
    bom(conn, project_id)?.into_iter().find(|b| b.id == id).ok_or_else(|| CoreError::NotFound(format!("BOM line {id}")))
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct BomLineInput {
    pub project_id: i64,
    pub component_id: i64,
    pub required_qty: i64,
    pub note: String,
    /// When the part is already on the BOM: add to its required quantity instead of replacing it.
    pub add_to_existing: bool,
}

pub fn upsert_line(conn: &Connection, input: &BomLineInput) -> Result<BomRow> {
    if !(0..=MAX_QUANTITY).contains(&input.required_qty) {
        return Err(invalid("required quantity is out of range"));
    }
    get(conn, input.project_id)?;
    crate::components::get(conn, input.component_id)?;
    let existing: Option<(i64, i64)> = conn
        .query_row(
            "SELECT id, required_qty FROM project_components WHERE project_id = ?1 AND component_id = ?2",
            params![input.project_id, input.component_id],
            |r| Ok((r.get(0)?, int(r, 1))),
        )
        .optional()?;
    let note = clean(&input.note, 1000);
    let id = match existing {
        Some((id, req)) => {
            let qty = if input.add_to_existing { (req + input.required_qty).min(MAX_QUANTITY) } else { input.required_qty };
            conn.execute(
                "UPDATE project_components SET required_qty = ?1, note = CASE WHEN ?2 = '' THEN note ELSE ?2 END, updated_at = ?3 WHERE id = ?4",
                params![qty, note, now(), id],
            )?;
            id
        }
        None => {
            let ts = now();
            conn.execute(
                "INSERT INTO project_components (project_id, component_id, required_qty, note, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                params![input.project_id, input.component_id, input.required_qty, note, ts],
            )?;
            conn.last_insert_rowid()
        }
    };
    conn.execute("UPDATE projects SET updated_at = ?1 WHERE id = ?2", params![now(), input.project_id])?;
    bom_row(conn, id)
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct BomLinePatch {
    pub id: i64,
    pub required_qty: Option<i64>,
    pub note: Option<String>,
}

pub fn update_line(conn: &Connection, patch: &BomLinePatch) -> Result<BomRow> {
    bom_row(conn, patch.id)?;
    if let Some(q) = patch.required_qty {
        if !(0..=MAX_QUANTITY).contains(&q) {
            return Err(invalid("required quantity is out of range"));
        }
        conn.execute("UPDATE project_components SET required_qty = ?1, updated_at = ?2 WHERE id = ?3", params![q, now(), patch.id])?;
    }
    if let Some(n) = &patch.note {
        conn.execute("UPDATE project_components SET note = ?1, updated_at = ?2 WHERE id = ?3", params![clean(n, 1000), now(), patch.id])?;
    }
    bom_row(conn, patch.id)
}

pub fn delete_line(conn: &Connection, id: i64) -> Result<BomLink> {
    let link = conn
        .query_row(
            "SELECT id, project_id, component_id, required_qty, note, created_at, updated_at FROM project_components WHERE id = ?1",
            [id],
            |r| {
                Ok(BomLink {
                    id: r.get(0)?,
                    project_id: r.get(1)?,
                    component_id: r.get(2)?,
                    required_qty: int(r, 3),
                    note: text(r, 4),
                    created_at: text(r, 5),
                    updated_at: text(r, 6),
                })
            },
        )
        .optional()?
        .ok_or_else(|| CoreError::NotFound(format!("BOM line {id}")))?;
    conn.execute("DELETE FROM project_components WHERE id = ?1", [id])?;
    Ok(link)
}

pub fn usage(conn: &Connection) -> Result<Vec<UsageSummary>> {
    let mut stmt = conn.prepare(
        "SELECT component_id, COUNT(DISTINCT project_id), COALESCE(SUM(required_qty), 0)
           FROM project_components GROUP BY component_id",
    )?;
    let rows = stmt
        .query_map([], |r| Ok(UsageSummary { component_id: r.get(0)?, project_count: int(r, 1), total_required: int(r, 2) }))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn for_component(conn: &Connection, component_id: i64) -> Result<Vec<ProjectUse>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, pc.required_qty, pc.note FROM project_components pc
           JOIN projects p ON p.id = pc.project_id WHERE pc.component_id = ?1 ORDER BY p.order_index, p.id",
    )?;
    let rows = stmt
        .query_map([component_id], |r| {
            Ok(ProjectUse { project_id: r.get(0)?, project_name: text(r, 1), required_qty: int(r, 2), note: text(r, 3) })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}
