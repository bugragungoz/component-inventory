//! Difference between a backup and the current database, by part code.

use std::collections::BTreeMap;

use serde_json::Value;

use crate::model::{BackupDiff, ChangedPart, Component, FieldChange};

pub const DIFF_FIELDS: &[&str] = &[
    "category",
    "subcategory",
    "quantity",
    "package",
    "manufacturer",
    "mpn",
    "location",
    "preferred_supplier",
    "voltage_max",
    "current_max",
    "resistance",
    "tolerance",
    "power_rating",
    "description",
    "datasheet_url",
    "unit_price",
    "notes",
];

fn norm(v: Value) -> Value {
    match v {
        Value::Null => Value::String(String::new()),
        other => other,
    }
}

/// `backup` is the older state (A), `current` the newer (B).
pub fn diff(backup: &[Component], current: &[Component]) -> BackupDiff {
    let a: BTreeMap<&str, &Component> = backup.iter().map(|c| (c.part_code.as_str(), c)).collect();
    let b: BTreeMap<&str, &Component> = current.iter().map(|c| (c.part_code.as_str(), c)).collect();
    let mut out = BackupDiff::default();
    for (code, cb) in &b {
        match a.get(code) {
            None => out.added.push((*cb).clone()),
            Some(ca) => {
                let va = serde_json::to_value(ca).unwrap_or(Value::Null);
                let vb = serde_json::to_value(cb).unwrap_or(Value::Null);
                let fields: Vec<FieldChange> = DIFF_FIELDS
                    .iter()
                    .filter_map(|f| {
                        let before = norm(va.get(*f).cloned().unwrap_or(Value::Null));
                        let after = norm(vb.get(*f).cloned().unwrap_or(Value::Null));
                        (before != after).then(|| FieldChange { field: (*f).to_string(), before, after })
                    })
                    .collect();
                if !fields.is_empty() {
                    out.changed.push(ChangedPart { part_code: (*code).to_string(), fields });
                }
            }
        }
    }
    for (code, ca) in &a {
        if !b.contains_key(code) {
            out.removed.push((*ca).clone());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c(code: &str, qty: i64) -> Component {
        Component { part_code: code.into(), quantity: qty, ..Default::default() }
    }

    #[test]
    fn added_removed_changed() {
        let d = diff(&[c("A", 1), c("B", 2)], &[c("B", 5), c("C", 1)]);
        assert_eq!(d.added.len(), 1);
        assert_eq!(d.removed.len(), 1);
        assert_eq!(d.changed.len(), 1);
        assert_eq!(d.changed[0].fields[0].field, "quantity");
        assert_eq!(d.changed[0].fields[0].before, Value::from(2));
        assert_eq!(d.changed[0].fields[0].after, Value::from(5));
    }
}
