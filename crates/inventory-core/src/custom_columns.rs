//! The user's own columns. Definitions live in `custom_columns`; values in `components.custom_fields`
//! under the column's key.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::db::{int, text};
use crate::error::{invalid, CoreError, Result};
use crate::model::CustomColumn;

pub const TYPES: &[&str] = &["text", "number", "url"];

pub fn list(conn: &Connection) -> Result<Vec<CustomColumn>> {
    let mut stmt =
        conn.prepare("SELECT id, col_key, col_label, col_type, is_visible, order_index FROM custom_columns ORDER BY order_index, id")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CustomColumn {
                id: r.get(0)?,
                col_key: text(r, 1),
                col_label: text(r, 2),
                col_type: text(r, 3),
                is_visible: int(r, 4) != 0,
                order_index: int(r, 5),
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct CustomColumnInput {
    pub id: Option<i64>,
    pub col_label: String,
    pub col_type: String,
    pub is_visible: bool,
    pub order_index: i64,
}

/// A stable key from the label: "cc_" + lower-case ASCII letters, digits and underscores.
pub fn key_for(label: &str) -> String {
    let mut k = String::from("cc_");
    for c in label.chars() {
        let c = match c {
            'ç' | 'Ç' => 'c',
            'ğ' | 'Ğ' => 'g',
            'ı' | 'İ' | 'I' => 'i',
            'ö' | 'Ö' => 'o',
            'ş' | 'Ş' => 's',
            'ü' | 'Ü' => 'u',
            other => other.to_ascii_lowercase(),
        };
        if c.is_ascii_alphanumeric() {
            k.push(c);
        } else if !k.ends_with('_') {
            k.push('_');
        }
    }
    let k = k.trim_end_matches('_').to_string();
    if k == "cc" {
        "cc_column".to_string()
    } else {
        k
    }
}

pub fn save(conn: &Connection, input: &CustomColumnInput) -> Result<CustomColumn> {
    let label: String = input.col_label.trim().chars().take(60).collect();
    if label.is_empty() {
        return Err(invalid("a column needs a name"));
    }
    let col_type = if input.col_type.is_empty() { "text".to_string() } else { input.col_type.clone() };
    if !TYPES.contains(&col_type.as_str()) {
        return Err(invalid(format!("unknown column type {col_type}")));
    }
    let id = match input.id {
        Some(id) => {
            let n = conn.execute(
                "UPDATE custom_columns SET col_label = ?1, col_type = ?2, is_visible = ?3, order_index = ?4 WHERE id = ?5",
                params![label, col_type, input.is_visible as i64, input.order_index, id],
            )?;
            if n == 0 {
                return Err(CoreError::NotFound(format!("column {id}")));
            }
            id
        }
        None => {
            let base = key_for(&label);
            let mut key = base.clone();
            let mut i = 2;
            while conn.query_row("SELECT id FROM custom_columns WHERE col_key = ?1", [&key], |r| r.get::<_, i64>(0)).optional()?.is_some() {
                key = format!("{base}_{i}");
                i += 1;
            }
            conn.execute(
                "INSERT INTO custom_columns (col_key, col_label, col_type, is_visible, order_index) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![key, label, col_type, input.is_visible as i64, input.order_index],
            )?;
            conn.last_insert_rowid()
        }
    };
    list(conn)?.into_iter().find(|c| c.id == id).ok_or_else(|| CoreError::NotFound(format!("column {id}")))
}

/// Removes the column definition. Values stay in `custom_fields`, so re-adding a column with the
/// same name brings them back.
pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM custom_columns WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::key_for;

    #[test]
    fn keys_are_ascii() {
        assert_eq!(key_for("Bin"), "cc_bin");
        assert_eq!(key_for("Raf / Göz"), "cc_raf_goz");
        assert_eq!(key_for("İç çap"), "cc_ic_cap");
        assert_eq!(key_for("***"), "cc_column");
    }
}
