//! JSON-lines bridge to `inventory_core::api` for the UI test harness (docs/adr/0004).
//!
//! Usage: `inventory-bridge <data-dir> [library.db]`. Each stdin line is
//! `{"id": 1, "cmd": "list_components", "args": {...}}`; each answer is
//! `{"id": 1, "ok": true, "value": ...}` or `{"id": 1, "ok": false, "error": {"code", "detail"}}`.
//! Besides the shared commands it knows a few test-only ones (`set_folder_for_test`,
//! `set_schematic_for_test`, `export_to_path`, `seed_components`).

use std::io::{BufRead, Write};
use std::path::PathBuf;

use inventory_core::{api, export, settings, ApiError, Core};
use serde_json::{json, Value};

fn test_only(core: &Core, cmd: &str, payload: &Value) -> Option<Result<Value, ApiError>> {
    let args = payload.get("args").cloned().unwrap_or(Value::Null);
    let res = match cmd {
        "set_folder_for_test" => {
            let kind = match args.get("kind").and_then(Value::as_str) {
                Some("export") => settings::FolderKind::Export,
                _ => settings::FolderKind::Drive,
            };
            let path = args.get("path").and_then(Value::as_str).map(str::to_string);
            core.read(|c| settings::set_folder(c, kind, path))
                .map(|s| serde_json::to_value(s).unwrap_or(Value::Null))
                .map_err(ApiError::from)
        }
        "set_schematic_for_test" => {
            // What `pick_schematic` stores after the native file dialog.
            let id = args.get("project_id").and_then(Value::as_i64).unwrap_or(0);
            let path = args.get("path").and_then(Value::as_str).unwrap_or_default().to_string();
            core.write(|c| inventory_core::projects::set_schematic(c, id, &path))
                .map(|p| serde_json::to_value(p).unwrap_or(Value::Null))
                .map_err(ApiError::from)
        }
        "export_to_path" => {
            let format = args.get("format").and_then(Value::as_str).unwrap_or("csv").to_string();
            let path = args.get("path").and_then(Value::as_str).unwrap_or_default().to_string();
            (|| -> Result<Value, inventory_core::CoreError> {
                let comps = core.read(inventory_core::components::list)?;
                let custom = core.read(inventory_core::custom_columns::list)?;
                let bytes = match format.as_str() {
                    "json" => export::json(&comps)?,
                    "xlsx" => export::xlsx(&comps, &custom)?,
                    _ => export::csv(&comps, &custom),
                };
                std::fs::write(&path, bytes)?;
                Ok(json!(path))
            })()
            .map_err(ApiError::from)
        }
        "seed_components" => {
            // Fast synthetic data for performance checks: n parts in one transaction.
            let n = args.get("count").and_then(Value::as_i64).unwrap_or(0).clamp(0, 200_000);
            core.write(|c| {
                let tx = c.transaction()?;
                {
                    let mut stmt = tx.prepare(
                        "INSERT INTO components (part_code, category, subcategory, quantity, package, description, location)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    )?;
                    let cats = [
                        ("Resistors", "SMD", "0603"),
                        ("Capacitors", "MLCC", "0805"),
                        ("ICs", "Op-Amp", "SO-8"),
                        ("Transistors", "MOSFET N-Channel", "TO-220"),
                        ("Diodes", "Schottky", "SMA"),
                    ];
                    for i in 0..n {
                        let (cat, sub, pkg) = cats[(i % cats.len() as i64) as usize];
                        stmt.execute(rusqlite::params![
                            format!("PART-{i:06}"),
                            cat,
                            sub,
                            i % 500,
                            pkg,
                            format!("Synthetic part {i}"),
                            if i % 7 == 0 { format!("Box {}", i % 40) } else { String::new() }
                        ])?;
                    }
                }
                tx.commit()?;
                Ok(json!(n))
            })
            .map_err(ApiError::from)
        }
        _ => return None,
    };
    Some(res)
}

fn main() {
    let mut argv = std::env::args().skip(1);
    let data_dir = PathBuf::from(argv.next().expect("usage: inventory-bridge <data-dir> [library.db]"));
    let library = argv.next().map(PathBuf::from);
    let core = match Core::open(&data_dir, library) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("bridge: cannot open the database: {e}");
            std::process::exit(2);
        }
    };
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout().lock();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let msg: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let _ =
                    writeln!(stdout, "{}", json!({"id": null, "ok": false, "error": {"code": "invalid_input", "detail": e.to_string()}}));
                continue;
            }
        };
        let id = msg.get("id").cloned().unwrap_or(Value::Null);
        let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or_default().to_string();
        let payload = json!({ "args": msg.get("args").cloned().unwrap_or(json!({})) });
        let result = match test_only(&core, &cmd, &payload) {
            Some(r) => r,
            None => api::dispatch(&core, &cmd, payload),
        };
        let out = match result {
            Ok(v) => json!({"id": id, "ok": true, "value": v}),
            Err(e) => json!({"id": id, "ok": false, "error": e}),
        };
        let _ = writeln!(stdout, "{out}");
        let _ = stdout.flush();
    }
}
