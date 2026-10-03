//! Stock movements: one row per change of a part's count, with the reason and, for imports, the
//! batch that wrote it.

use rusqlite::{params, Connection};

use crate::db::{int, now, opt_int, text};
use crate::error::Result;
use crate::model::Movement;

pub fn record_movement(
    conn: &Connection,
    component_id: i64,
    part_code: &str,
    delta: i64,
    quantity_after: i64,
    reason: &str,
    batch: Option<i64>,
) -> Result<()> {
    if delta == 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO stock_movements (component_id, part_code, delta, quantity_after, reason, created_at, import_batch_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![component_id, part_code, delta, quantity_after, reason, now(), batch],
    )?;
    Ok(())
}

pub fn list_for(conn: &Connection, component_id: i64, limit: i64) -> Result<Vec<Movement>> {
    let mut stmt = conn.prepare(
        "SELECT id, component_id, part_code, delta, quantity_after, reason, import_batch_id, created_at
           FROM stock_movements WHERE component_id = ?1 ORDER BY id DESC LIMIT ?2",
    )?;
    let rows = stmt
        .query_map(params![component_id, limit.clamp(1, 1000)], |r| {
            Ok(Movement {
                id: r.get(0)?,
                component_id: r.get(1)?,
                part_code: text(r, 2),
                delta: int(r, 3),
                quantity_after: int(r, 4),
                reason: text(r, 5),
                import_batch_id: opt_int(r, 6),
                created_at: text(r, 7),
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}
