//! CSV, JSON and XLSX exports, and the workbook the Drive snapshot writes. Column headers are
//! English on purpose: the files are read by other tools and the old app wrote the same headers.

use rust_xlsxwriter::{Format, FormatAlign, Workbook, Worksheet};
use serde_json::{Map, Value};

use crate::error::{CoreError, Result};
use crate::model::{Component, CustomColumn, UNCATEGORIZED};

pub struct Column {
    pub key: &'static str,
    pub label: &'static str,
}

pub const COLUMNS: &[Column] = &[
    Column { key: "part_code", label: "Part Code" },
    Column { key: "category", label: "Category" },
    Column { key: "subcategory", label: "Subcategory" },
    Column { key: "quantity", label: "Quantity" },
    Column { key: "package", label: "Package" },
    Column { key: "manufacturer", label: "Manufacturer" },
    Column { key: "mpn", label: "MPN" },
    Column { key: "location", label: "Storage Place" },
    Column { key: "preferred_supplier", label: "Supplier" },
    Column { key: "voltage_max", label: "V Max" },
    Column { key: "current_max", label: "I Max" },
    Column { key: "resistance", label: "Value" },
    Column { key: "tolerance", label: "Tolerance" },
    Column { key: "power_rating", label: "Power (W)" },
    Column { key: "description", label: "Description" },
    Column { key: "datasheet_url", label: "Datasheet" },
    Column { key: "unit_price", label: "Unit Price" },
    Column { key: "notes", label: "Notes" },
    Column { key: "updated_at", label: "Updated At" },
];

/// Compact per-category column sets for the Drive workbook (as in the old app).
fn category_columns(category: &str) -> Option<&'static [&'static str]> {
    Some(match category {
        "Resistors" => &[
            "part_code",
            "subcategory",
            "package",
            "resistance",
            "tolerance",
            "power_rating",
            "quantity",
            "location",
            "manufacturer",
            "unit_price",
            "datasheet_url",
        ],
        "Capacitors" => &[
            "part_code",
            "subcategory",
            "package",
            "resistance",
            "voltage_max",
            "tolerance",
            "quantity",
            "location",
            "manufacturer",
            "unit_price",
            "datasheet_url",
            "description",
        ],
        "Inductors" => &[
            "part_code",
            "subcategory",
            "package",
            "current_max",
            "tolerance",
            "quantity",
            "location",
            "manufacturer",
            "unit_price",
            "datasheet_url",
            "description",
        ],
        "Transistors" => &[
            "part_code",
            "subcategory",
            "package",
            "voltage_max",
            "current_max",
            "power_rating",
            "quantity",
            "location",
            "manufacturer",
            "mpn",
            "unit_price",
            "datasheet_url",
        ],
        "Diodes" => &[
            "part_code",
            "subcategory",
            "package",
            "voltage_max",
            "current_max",
            "quantity",
            "location",
            "manufacturer",
            "unit_price",
            "datasheet_url",
            "description",
        ],
        "ICs" => &[
            "part_code",
            "subcategory",
            "package",
            "voltage_max",
            "current_max",
            "quantity",
            "location",
            "manufacturer",
            "mpn",
            "unit_price",
            "datasheet_url",
            "description",
        ],
        "Connectors" => &["part_code", "subcategory", "package", "quantity", "location", "manufacturer", "unit_price", "description"],
        "Sensors" => &[
            "part_code",
            "subcategory",
            "package",
            "voltage_max",
            "current_max",
            "quantity",
            "location",
            "manufacturer",
            "mpn",
            "unit_price",
            "datasheet_url",
            "description",
        ],
        "Crystals" => {
            &["part_code", "subcategory", "package", "tolerance", "quantity", "location", "manufacturer", "unit_price", "description"]
        }
        _ => return None,
    })
}

fn label_for(key: &str) -> &'static str {
    COLUMNS.iter().find(|c| c.key == key).map(|c| c.label).unwrap_or("")
}

fn row_value(c: &Component) -> Value {
    serde_json::to_value(c).unwrap_or(Value::Null)
}

fn field(v: &Value, key: &str) -> Value {
    v.get(key).cloned().unwrap_or(Value::Null)
}

fn cell_text(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        other => other.to_string(),
    }
}

fn csv_escape(s: &str) -> String {
    // Leading =, +, - or @ would run as a formula in a spreadsheet; prefix them with an apostrophe.
    let s =
        if s.starts_with(['=', '+', '@']) || (s.starts_with('-') && s.parse::<f64>().is_err()) { format!("'{s}") } else { s.to_string() };
    if s.contains([',', '"', '\n', '\r', ';']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s
    }
}

pub fn csv(components: &[Component], custom: &[CustomColumn]) -> Vec<u8> {
    let mut out = String::new();
    let mut header: Vec<String> = COLUMNS.iter().map(|c| c.label.to_string()).collect();
    header.extend(custom.iter().map(|c| c.col_label.clone()));
    out.push_str(&header.iter().map(|h| csv_escape(h)).collect::<Vec<_>>().join(","));
    out.push_str("\r\n");
    for c in components {
        let v = row_value(c);
        let mut cells: Vec<String> = COLUMNS.iter().map(|col| csv_escape(&cell_text(&field(&v, col.key)))).collect();
        cells.extend(custom.iter().map(|cc| csv_escape(&cell_text(c.custom_fields.get(&cc.col_key).unwrap_or(&Value::Null)))));
        out.push_str(&cells.join(","));
        out.push_str("\r\n");
    }
    // UTF-8 BOM so Excel reads Turkish letters correctly.
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(out.as_bytes());
    bytes
}

pub fn json(components: &[Component]) -> Result<Vec<u8>> {
    let rows: Vec<Value> = components
        .iter()
        .map(|c| {
            let mut m = Map::new();
            let v = row_value(c);
            for col in COLUMNS {
                m.insert(col.key.to_string(), field(&v, col.key));
            }
            m.insert("attributes".into(), Value::Object(c.attributes.clone()));
            m.insert("custom_fields".into(), Value::Object(c.custom_fields.clone()));
            Value::Object(m)
        })
        .collect();
    Ok(serde_json::to_vec_pretty(&rows)?)
}

fn xerr(e: rust_xlsxwriter::XlsxError) -> CoreError {
    CoreError::Export(e.to_string())
}

fn write_sheet(ws: &mut Worksheet, rows: &[&Component], keys: &[&str], custom: &[CustomColumn], header_fmt: &Format) -> Result<()> {
    let mut labels: Vec<String> = keys.iter().map(|k| label_for(k).to_string()).collect();
    labels.extend(custom.iter().map(|c| c.col_label.clone()));
    let mut widths: Vec<usize> = labels.iter().map(|l| l.chars().count() + 2).collect();
    for (col, label) in labels.iter().enumerate() {
        ws.write_string_with_format(0, col as u16, label, header_fmt).map_err(xerr)?;
    }
    for (r, c) in rows.iter().enumerate() {
        let row = (r + 1) as u32;
        let rv = row_value(c);
        for (col, key) in keys.iter().enumerate() {
            let v = field(&rv, key);
            match &v {
                Value::Number(n) => {
                    ws.write_number(row, col as u16, n.as_f64().unwrap_or(0.0)).map_err(xerr)?;
                }
                other => {
                    let s = cell_text(other);
                    if !s.is_empty() {
                        ws.write_string(row, col as u16, &s).map_err(xerr)?;
                    }
                }
            }
            widths[col] = widths[col].max(cell_text(&v).chars().count() + 2);
        }
        for (i, cc) in custom.iter().enumerate() {
            let col = keys.len() + i;
            let s = cell_text(c.custom_fields.get(&cc.col_key).unwrap_or(&Value::Null));
            if !s.is_empty() {
                ws.write_string(row, col as u16, &s).map_err(xerr)?;
            }
            widths[col] = widths[col].max(s.chars().count() + 2);
        }
    }
    for (col, w) in widths.iter().enumerate() {
        ws.set_column_width(col as u16, (*w).clamp(10, 48) as f64).map_err(xerr)?;
    }
    ws.set_freeze_panes(1, 0).map_err(xerr)?;
    let last_col = (labels.len().max(1) - 1) as u16;
    ws.autofilter(0, 0, rows.len() as u32, last_col).map_err(xerr)?;
    Ok(())
}

/// Sheet names: at most 31 characters, none of `\ / ? * [ ] :`, unique.
fn sheet_name(name: &str, used: &mut Vec<String>) -> String {
    let base: String = name.chars().map(|c| if "\\/?*[]:".contains(c) { '_' } else { c }).take(31).collect();
    let base = if base.trim().is_empty() { UNCATEGORIZED.to_string() } else { base };
    let mut n = base.clone();
    let mut i = 2;
    while used.iter().any(|u| u.eq_ignore_ascii_case(&n)) {
        let suffix = format!(" {i}");
        n = format!("{}{}", base.chars().take(31 - suffix.len()).collect::<String>(), suffix);
        i += 1;
    }
    used.push(n.clone());
    n
}

/// A "Summary" sheet with every part and one sheet per category with that category's columns;
/// frozen header row, auto-filter, sized columns.
pub fn xlsx(components: &[Component], custom: &[CustomColumn]) -> Result<Vec<u8>> {
    let mut wb = Workbook::new();
    let header_fmt = Format::new().set_bold().set_align(FormatAlign::Left);
    let all: Vec<&Component> = components.iter().collect();
    let keys: Vec<&str> = COLUMNS.iter().map(|c| c.key).collect();
    let mut used = Vec::new();
    {
        let ws = wb.add_worksheet();
        ws.set_name(sheet_name("Summary", &mut used)).map_err(xerr)?;
        write_sheet(ws, &all, &keys, custom, &header_fmt)?;
    }
    let mut cats: Vec<&str> =
        components.iter().map(|c| if c.category.trim().is_empty() { UNCATEGORIZED } else { c.category.as_str() }).collect();
    cats.sort_unstable();
    cats.dedup();
    for cat in cats {
        let rows: Vec<&Component> =
            components.iter().filter(|c| (if c.category.trim().is_empty() { UNCATEGORIZED } else { c.category.as_str() }) == cat).collect();
        let cat_keys: Vec<&str> = category_columns(cat).map(|k| k.to_vec()).unwrap_or_else(|| keys.clone());
        let ws = wb.add_worksheet();
        ws.set_name(sheet_name(cat, &mut used)).map_err(xerr)?;
        write_sheet(ws, &rows, &cat_keys, &[], &header_fmt)?;
    }
    wb.save_to_buffer().map_err(xerr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_quotes_and_neutralizes_formulas() {
        let c = Component { part_code: "=HYPERLINK(\"x\")".into(), description: "a, b".into(), quantity: 3, ..Default::default() };
        let out = String::from_utf8(csv(&[c], &[])[3..].to_vec()).unwrap();
        let line = out.lines().nth(1).unwrap();
        assert!(line.starts_with("\"'=HYPERLINK(\"\"x\"\")\""), "{line}");
        assert!(line.contains("\"a, b\""));
    }

    #[test]
    fn sheet_names_are_valid_and_unique() {
        let mut used = Vec::new();
        assert_eq!(sheet_name("Legacy Parts (Sony/VCR)", &mut used), "Legacy Parts (Sony_VCR)");
        assert_eq!(sheet_name("Summary", &mut used), "Summary");
        assert_eq!(sheet_name("summary", &mut used), "summary 2");
    }

    #[test]
    fn xlsx_builds() {
        let c = Component { part_code: "LM358".into(), category: "ICs".into(), quantity: 3, ..Default::default() };
        let bytes = xlsx(&[c], &[]).unwrap();
        assert_eq!(&bytes[0..2], b"PK");
    }
}
