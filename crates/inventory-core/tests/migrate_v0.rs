//! The owner's database (schema 0) must open in the new app without losing anything.

mod common;

use inventory_core::api::{self, IdArgs, NoArgs};
use inventory_core::{db, Core};

#[test]
fn v0_fixture_migrates_and_every_row_survives() {
    let dir = common::v0_data_dir();
    let core = Core::open(dir.path(), None).unwrap();

    // A copy of the old file was written before anything changed.
    let report = core.migration.clone().expect("a migration report");
    assert_eq!(report.from_version, 0);
    assert_eq!(report.to_version, 1);
    let backup = report.backup_path.clone().expect("pre-migration backup");
    assert!(std::path::Path::new(&backup).is_file());
    let old = rusqlite::Connection::open(&backup).unwrap();
    assert_eq!(db::user_version(&old).unwrap(), 0);
    assert!(db::has_column(&old, "project_components", "missing_qty").unwrap());

    let parts = api::list_components(&core, NoArgs {}).unwrap();
    assert_eq!(parts.len(), 10);
    let by = |code: &str| parts.iter().find(|p| p.part_code == code).unwrap_or_else(|| panic!("{code} lost")).clone();

    let lm358 = by("LM358ADT");
    assert_eq!(lm358.quantity, 10);
    assert_eq!(lm358.category, "ICs");
    assert_eq!(lm358.subcategory, "Op-Amps");
    assert_eq!(lm358.location, "Kutu 3");
    assert_eq!(lm358.preferred_supplier, "Özdisan");
    assert_eq!(lm358.unit_price, Some(3.47));
    assert_eq!(lm358.description, "IC-358 AMPLIFIER DUAL SMD TR SO8 ST");

    let r = by("R-91K-0603");
    assert_eq!(r.quantity, 100);
    assert_eq!(r.resistance, "91k");
    assert_eq!(r.tolerance, "1%");
    assert_eq!(r.power_rating, Some(0.1));
    assert_eq!(r.attributes.get("resistance").and_then(|v| v.as_str()), Some("91k"));

    // Legacy duplicate category names fold into one; the custom one stays.
    assert_eq!(by("BT139-800E").category, "Thyristors");
    assert_eq!(by("BTA16-600B").category, "Thyristors");
    assert_eq!(by("BTA16-600B").location, "Raf A");
    assert_eq!(by("X-UNCAT-1").category, "Uncategorized");
    assert!(by("X-UNCAT-1").attributes.is_empty(), "NULL attributes become an empty object");
    assert_eq!(by("X-UNCL-1").category, "Uncategorized");
    assert_eq!(by("X-UNCL-1").quantity, 0);
    assert_eq!(by("SOLDER-PASTE").category, "Consumables");
    assert_eq!(by("SOLDER-PASTE").description, "Lötfett Lehim Pastası");
    assert_eq!(by("TWEEZERS-1").category, "Consumables");
    assert_eq!(by("STK-SONY-1").category, "Legacy Parts (Sony/VCR)");
    assert_eq!(by("STK-SONY-1").location, "Kutu 9");

    let tr = by("ÇİP-İıŞş");
    assert_eq!(tr.quantity, 5);
    assert_eq!(tr.description, "Turkish case folding: İ ı Ş ş Ç ç Ğ ğ Ö ö Ü ü");

    // Storage places: every row that had one still has it.
    assert_eq!(parts.iter().filter(|p| !p.location.is_empty()).count(), 3);

    // Stock movements.
    let moves = api::list_movements(&core, api::MovementArgs { component_id: lm358.id, limit: 50 }).unwrap();
    assert_eq!(moves.len(), 3);
    let total: i64 = core.read(|c| Ok(c.query_row("SELECT COUNT(*) FROM stock_movements", [], |r| r.get(0))?)).unwrap();
    assert_eq!(total, 5);

    // Project and BOM; the shortage is derived (4 in stock, 6 needed -> 2, as the old typed value).
    let projects = api::list_projects(&core, NoArgs {}).unwrap();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].name, "Güç kaynağı");
    assert_eq!(projects[0].schematic_path, "C:/Users/someone/proj/psu.pdf");
    let bom = api::list_bom(&core, IdArgs { id: projects[0].id }).unwrap();
    assert_eq!(bom.len(), 2);
    let triac = bom.iter().find(|b| b.part_code == "BT139-800E").unwrap();
    assert_eq!((triac.required_qty, triac.stock, triac.shortage), (6, 4, 2));
    assert_eq!(triac.note, "needs 6, have 4");
    assert_eq!(projects[0].shortage, 2);

    // Custom columns.
    let cols = api::list_custom_columns(&core, NoArgs {}).unwrap();
    assert_eq!(cols.len(), 1);
    assert_eq!((cols[0].col_key.as_str(), cols[0].col_label.as_str()), ("cc_bin", "Bin"));

    // Schema details.
    core.read(|c| {
        assert_eq!(db::user_version(c)?, 1);
        assert!(!db::has_column(c, "project_components", "missing_qty")?);
        assert!(db::has_column(c, "components", "custom_fields")?);
        assert!(db::has_column(c, "stock_movements", "import_batch_id")?);
        let log: Vec<String> =
            c.prepare("SELECT message FROM migration_log ORDER BY id")?.query_map([], |r| r.get(0))?.collect::<Result<_, _>>()?;
        assert!(log.iter().any(|m| m.contains("\"Thyristors & Triacs\" -> \"Thyristors\"")), "{log:?}");
        assert!(log.iter().any(|m| m.contains("\"Unclassified\" -> \"Uncategorized\"")), "{log:?}");
        assert!(log.iter().any(|m| m.contains("\"Consumables & Tools\" -> \"Consumables\"")), "{log:?}");
        assert!(log.iter().any(|m| m.contains("Legacy Parts (Sony/VCR)") && m.contains("kept")), "{log:?}");
        assert!(log.iter().any(|m| m.contains("missing_qty")), "{log:?}");
        Ok(())
    })
    .unwrap();
}

#[test]
fn reopening_does_not_migrate_or_back_up_again() {
    let dir = common::v0_data_dir();
    drop(Core::open(dir.path(), None).unwrap());
    let backups_before = std::fs::read_dir(dir.path().join("backups")).unwrap().count();
    let core = Core::open(dir.path(), None).unwrap();
    assert!(core.migration.is_none());
    assert_eq!(std::fs::read_dir(dir.path().join("backups")).unwrap().count(), backups_before);
    assert_eq!(api::list_components(&core, NoArgs {}).unwrap().len(), 10);
}

#[test]
fn a_very_old_database_without_later_columns_migrates() {
    let dir = tempfile::tempdir().unwrap();
    let conn = rusqlite::Connection::open(dir.path().join("component_inventory.db")).unwrap();
    conn.execute_batch(
        "CREATE TABLE components (id INTEGER PRIMARY KEY AUTOINCREMENT, part_code TEXT UNIQUE NOT NULL,
           category TEXT DEFAULT '', subcategory TEXT DEFAULT '', quantity INTEGER DEFAULT 0, package TEXT DEFAULT '',
           manufacturer TEXT DEFAULT '', mpn TEXT DEFAULT '', location TEXT DEFAULT '', voltage_max REAL, current_max REAL,
           description TEXT DEFAULT '', datasheet_url TEXT DEFAULT '', unit_price REAL, notes TEXT DEFAULT '',
           created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
         INSERT INTO components (part_code, category, quantity, notes) VALUES ('NE555', 'ics', 2.5, '');
         INSERT INTO components (part_code, category, quantity) VALUES ('BC547', 'Transistors', '12');",
    )
    .unwrap();
    drop(conn);
    let core = Core::open(dir.path(), None).unwrap();
    let parts = api::list_components(&core, NoArgs {}).unwrap();
    let ne = parts.iter().find(|p| p.part_code == "NE555").unwrap();
    assert_eq!(ne.category, "ICs");
    assert_eq!(ne.quantity, 3);
    assert!(ne.notes.contains("quantity was 2.5"), "the rounding is written on the part");
    assert_eq!(parts.iter().find(|p| p.part_code == "BC547").unwrap().quantity, 12);
    assert!(api::list_projects(&core, NoArgs {}).unwrap().is_empty());
}

#[test]
fn a_newer_database_is_refused_untouched() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("component_inventory.db");
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute_batch("CREATE TABLE components (id INTEGER PRIMARY KEY, part_code TEXT); PRAGMA user_version = 99;").unwrap();
    drop(conn);
    let before = std::fs::read(&path).unwrap();
    match Core::open(dir.path(), None) {
        Err(inventory_core::CoreError::NewerSchema(99)) => {}
        Err(e) => panic!("unexpected error {e}"),
        Ok(_) => panic!("a newer database must not open"),
    }
    assert_eq!(std::fs::read(&path).unwrap(), before);
}

#[test]
fn a_new_database_starts_at_the_current_schema() {
    let (_dir, core) = common::fresh();
    let info = api::app_info(&core, NoArgs {}).unwrap();
    assert_eq!(info.schema_version, inventory_core::schema::CURRENT_VERSION);
    assert_eq!(info.component_count, 0);
    assert!(info.migration.is_some(), "first run reports that a database was created");
}
