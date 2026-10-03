//! Parts, projects, settings, backups, the Drive snapshot and the command dispatcher.

mod common;

use inventory_core::api::{self, *};
use inventory_core::model::ComponentInput;
use inventory_core::projects::{BomLineInput, BomLinePatch, ProjectPatch};
use serde_json::json;

fn part(code: &str, qty: i64) -> ComponentInput {
    ComponentInput { part_code: code.into(), quantity: qty, ..Default::default() }
}

#[test]
fn save_rejects_duplicates_and_records_movements() {
    let (_d, core) = common::fresh();
    let a = api::save_component(&core, SaveComponentArgs { component: part("LM358", 5) }).unwrap();
    assert_eq!(a.category, "Uncategorized");
    let err = api::save_component(&core, SaveComponentArgs { component: part("LM358", 1) }).unwrap_err();
    assert!(matches!(err, inventory_core::CoreError::DuplicatePartCode(_)));
    let mut edit = ComponentInput::from(&a);
    edit.quantity = 8;
    api::save_component(&core, SaveComponentArgs { component: edit }).unwrap();
    let moves = api::list_movements(&core, MovementArgs { component_id: a.id, limit: 10 }).unwrap();
    assert_eq!(moves.iter().map(|m| (m.reason.as_str(), m.delta)).collect::<Vec<_>>(), vec![("edit", 3), ("create", 5)]);
    let bad = ComponentInput { part_code: "X".into(), datasheet_url: "javascript:alert(1)".into(), ..Default::default() };
    assert!(api::save_component(&core, SaveComponentArgs { component: bad }).is_err());
    assert!(api::save_component(&core, SaveComponentArgs { component: part("  ", 1) }).is_err());
    assert!(api::save_component(&core, SaveComponentArgs { component: part("NEG", -1) }).is_err());
}

#[test]
fn delete_and_restore_bring_back_the_part_and_its_bom_lines() {
    let (_d, core) = common::fresh();
    let a = api::save_component(&core, SaveComponentArgs { component: part("NE555", 7) }).unwrap();
    let p = api::create_project(&core, CreateProjectArgs { name: "Timer".into() }).unwrap();
    api::upsert_bom_line(
        &core,
        UpsertBomArgs {
            line: BomLineInput { project_id: p.id, component_id: a.id, required_qty: 2, note: "U1".into(), add_to_existing: false },
        },
    )
    .unwrap();
    let snap = api::delete_components(&core, IdsArgs { ids: vec![a.id] }).unwrap();
    assert!(api::list_components(&core, NoArgs {}).unwrap().is_empty());
    assert!(api::list_bom(&core, IdArgs { id: p.id }).unwrap().is_empty());
    let rep = api::restore_components(&core, RestoreComponentsArgs { snapshot: snap }).unwrap();
    assert!(rep.skipped.is_empty());
    let back = api::list_components(&core, NoArgs {}).unwrap();
    assert_eq!((back[0].id, back[0].quantity), (a.id, 7));
    let bom = api::list_bom(&core, IdArgs { id: p.id }).unwrap();
    assert_eq!((bom[0].required_qty, bom[0].note.as_str()), (2, "U1"));
}

#[test]
fn bulk_delete_takes_a_backup_first() {
    let (_d, core) = common::fresh();
    let a = api::save_component(&core, SaveComponentArgs { component: part("A", 1) }).unwrap();
    let b = api::save_component(&core, SaveComponentArgs { component: part("B", 1) }).unwrap();
    api::delete_components(&core, IdsArgs { ids: vec![a.id, b.id] }).unwrap();
    assert!(api::list_backups(&core, NoArgs {}).unwrap().iter().any(|e| e.kind == "pre-delete"));
}

#[test]
fn adjust_never_goes_below_zero() {
    let (_d, core) = common::fresh();
    let a = api::save_component(&core, SaveComponentArgs { component: part("A", 2) }).unwrap();
    assert_eq!(api::adjust_quantity(&core, AdjustArgs { id: a.id, delta: -5 }).unwrap().quantity, 0);
    assert_eq!(api::adjust_quantity(&core, AdjustArgs { id: a.id, delta: 3 }).unwrap().quantity, 3);
}

#[test]
fn merge_sums_quantities_and_moves_bom_lines() {
    let (_d, core) = common::fresh();
    let a = api::save_component(
        &core,
        SaveComponentArgs { component: ComponentInput { part_code: "LM7805".into(), quantity: 3, ..Default::default() } },
    )
    .unwrap();
    let b = api::save_component(
        &core,
        SaveComponentArgs {
            component: ComponentInput { part_code: "7805".into(), quantity: 2, package: "TO-220".into(), ..Default::default() },
        },
    )
    .unwrap();
    let p = api::create_project(&core, CreateProjectArgs { name: "PSU".into() }).unwrap();
    api::upsert_bom_line(
        &core,
        UpsertBomArgs { line: BomLineInput { project_id: p.id, component_id: b.id, required_qty: 1, ..Default::default() } },
    )
    .unwrap();
    let m = api::merge_components(&core, MergeArgs { keep_id: a.id, merge_ids: vec![b.id], part_code: None }).unwrap();
    assert_eq!((m.quantity, m.package.as_str()), (5, "TO-220"));
    let bom = api::list_bom(&core, IdArgs { id: p.id }).unwrap();
    assert_eq!(bom[0].component_id, a.id);
}

#[test]
fn patches_move_parts_into_a_storage_place_and_keep_counts() {
    let (_d, core) = common::fresh();
    let a = api::save_component(&core, SaveComponentArgs { component: part("A", 5) }).unwrap();
    let b = api::save_component(&core, SaveComponentArgs { component: part("B", 2) }).unwrap();
    let patch =
        |id: i64, place: &str| inventory_core::components::ComponentPatch { id, location: Some(place.into()), ..Default::default() };
    let r = api::apply_patches(
        &core,
        PatchArgs { patches: vec![patch(a.id, "Kutu 1"), patch(b.id, "Kutu 1")], reason: "storage place".into() },
    )
    .unwrap();
    assert_eq!(r.count, 2);
    assert!(!r.backup_file.is_empty(), "a bulk change takes a backup first");
    let list = api::list_components(&core, NoArgs {}).unwrap();
    assert!(list.iter().all(|c| c.location == "Kutu 1"));
    assert_eq!(list.iter().map(|c| c.quantity).sum::<i64>(), 7);
    // Renaming a box is the same patch on every part in it; an empty place takes a part out.
    api::apply_patches(&core, PatchArgs { patches: vec![patch(a.id, "Raf A / Kutu 1"), patch(b.id, "")], reason: "storage place".into() })
        .unwrap();
    let list = api::list_components(&core, NoArgs {}).unwrap();
    assert_eq!(list.iter().find(|c| c.part_code == "A").unwrap().location, "Raf A / Kutu 1");
    assert_eq!(list.iter().find(|c| c.part_code == "B").unwrap().location, "");
}

#[test]
fn rename_category_and_subcategory() {
    let (_d, core) = common::fresh();
    api::save_component(
        &core,
        SaveComponentArgs {
            component: ComponentInput {
                part_code: "A".into(),
                category: "Resistors".into(),
                subcategory: "SMD".into(),
                ..Default::default()
            },
        },
    )
    .unwrap();
    let n = api::rename_category(&core, RenameCategoryArgs { from: "SMD".into(), to: "Chip".into(), parent: Some("Resistors".into()) })
        .unwrap();
    assert_eq!(n.count, 1);
    assert_eq!(api::list_components(&core, NoArgs {}).unwrap()[0].subcategory, "Chip");
}

#[test]
fn projects_bom_and_restore() {
    let (_d, core) = common::fresh();
    let c = api::save_component(&core, SaveComponentArgs { component: part("BC547", 1) }).unwrap();
    let p1 = api::create_project(&core, CreateProjectArgs { name: "One".into() }).unwrap();
    let p2 = api::create_project(&core, CreateProjectArgs { name: "Two".into() }).unwrap();
    assert_eq!(api::list_projects(&core, NoArgs {}).unwrap()[0].id, p2.id, "new projects go on top");
    let line = api::upsert_bom_line(
        &core,
        UpsertBomArgs { line: BomLineInput { project_id: p1.id, component_id: c.id, required_qty: 4, ..Default::default() } },
    )
    .unwrap();
    assert_eq!(line.shortage, 3);
    let line = api::upsert_bom_line(
        &core,
        UpsertBomArgs {
            line: BomLineInput { project_id: p1.id, component_id: c.id, required_qty: 2, add_to_existing: true, ..Default::default() },
        },
    )
    .unwrap();
    assert_eq!(line.required_qty, 6);
    let line =
        api::update_bom_line(&core, UpdateBomArgs { patch: BomLinePatch { id: line.id, required_qty: Some(1), note: Some("Q1".into()) } })
            .unwrap();
    assert_eq!((line.shortage, line.note.as_str()), (0, "Q1"));
    api::update_project(
        &core,
        UpdateProjectArgs {
            patch: ProjectPatch { id: p1.id, description: Some("desc".into()), notes: Some("notes".into()), ..Default::default() },
        },
    )
    .unwrap();
    assert!(api::update_project(
        &core,
        UpdateProjectArgs { patch: ProjectPatch { id: p1.id, schematic_path: Some("C:/x.pdf".into()), ..Default::default() } }
    )
    .is_err());
    api::reorder_projects(&core, IdsArgs { ids: vec![p1.id, p2.id] }).unwrap();
    assert_eq!(api::list_projects(&core, NoArgs {}).unwrap()[0].id, p1.id);
    let usage = api::project_usage(&core, NoArgs {}).unwrap();
    assert_eq!((usage[0].project_count, usage[0].total_required), (1, 1));
    let snap = api::delete_project(&core, IdArgs { id: p1.id }).unwrap();
    assert_eq!(api::list_projects(&core, NoArgs {}).unwrap().len(), 1);
    let back = api::restore_project(&core, RestoreProjectArgs { snapshot: snap }).unwrap();
    assert_eq!((back.id, back.description.as_str(), back.line_count), (p1.id, "desc", 1));
}

#[test]
fn settings_defaults_patches_and_folder_rule() {
    let (_d, core) = common::fresh();
    let s = api::get_settings(&core, NoArgs {}).unwrap();
    assert_eq!((s.theme.as_str(), s.default_quantity, s.backup_retention, s.drive_base_name.as_str()), ("system", 1, 30, "croxz"));
    let s = api::update_settings(
        &core,
        UpdateSettingsArgs { patch: json!({"theme": "light", "low_stock_threshold": 5, "drive_base_name": "my inv"}) },
    )
    .unwrap();
    assert_eq!((s.theme.as_str(), s.low_stock_threshold, s.drive_base_name.as_str()), ("light", 5, "my_inv"));
    assert!(api::update_settings(&core, UpdateSettingsArgs { patch: json!({"drive_folder": "C:/anywhere"}) }).is_err());
    assert!(api::update_settings(&core, UpdateSettingsArgs { patch: json!({"theme": "neon"}) }).is_err());
    assert!(api::update_settings(&core, UpdateSettingsArgs { patch: json!({"nope": 1}) }).is_err());
    assert!(api::update_settings(&core, UpdateSettingsArgs { patch: json!({"drive_folder": null}) }).is_ok());
    assert_eq!(api::get_settings(&core, NoArgs {}).unwrap().theme, "light");
    // 0 minutes turns the automatic backup off (Settings offers it); more than a day is refused.
    assert_eq!(
        api::update_settings(&core, UpdateSettingsArgs { patch: json!({"backup_interval_minutes": 0}) }).unwrap().backup_interval_minutes,
        0
    );
    assert!(api::update_settings(&core, UpdateSettingsArgs { patch: json!({"backup_interval_minutes": 1441}) }).is_err());
}

#[test]
fn legacy_settings_are_read_once() {
    let (_d, core) = common::fresh();
    let values = json!({"locale": "tr", "theme": "dark", "defaultQty": "3", "lowStockThreshold": "2", "formMode": "simple",
        "backupRetention": "10", "backupIntervalMinutes": "30", "driveSyncEnabled": "true", "driveSyncFolder": "C:\\Users\\x\\Drive\\inv",
        "driveSyncBaseName": "croxz", "locationsEnabled": "true"});
    let s = api::import_legacy_settings(&core, LegacySettingsArgs { values: values.as_object().unwrap().clone() }).unwrap();
    assert_eq!(s.language.as_deref(), Some("tr"));
    assert_eq!((s.default_quantity, s.low_stock_threshold, s.form_mode.as_str()), (3, 2, "simple"));
    assert_eq!((s.backup_retention, s.backup_interval_minutes), (10, 30));
    assert!(s.drive_enabled);
    assert_eq!(s.drive_folder.as_deref(), Some("C:\\Users\\x\\Drive\\inv"));
    assert_eq!(s.show_storage_place, "show");
    assert!(s.legacy_imported);
    let again =
        api::import_legacy_settings(&core, LegacySettingsArgs { values: json!({"locale": "en"}).as_object().unwrap().clone() }).unwrap();
    assert_eq!(again.language.as_deref(), Some("tr"), "only the first time counts");
}

#[test]
fn backups_restore_diff_and_retention() {
    let (_d, core) = common::fresh();
    let a = api::save_component(&core, SaveComponentArgs { component: part("A", 1) }).unwrap();
    let b1 = api::create_backup(&core, CreateBackupArgs { kind: String::new() }).unwrap();
    assert_eq!(b1.kind, "manual");
    let mut e = ComponentInput::from(&a);
    e.quantity = 9;
    api::save_component(&core, SaveComponentArgs { component: e }).unwrap();
    api::save_component(&core, SaveComponentArgs { component: part("B", 2) }).unwrap();
    let d = api::diff_backup(&core, FileArgs { file_name: b1.file_name.clone() }).unwrap();
    assert_eq!((d.added.len(), d.removed.len(), d.changed.len()), (1, 0, 1));
    let r = api::restore_backup(&core, FileArgs { file_name: b1.file_name.clone() }).unwrap();
    assert_eq!(r.safety_backup.kind, "pre-restore");
    let parts = api::list_components(&core, NoArgs {}).unwrap();
    assert_eq!(parts.len(), 1);
    assert_eq!(parts[0].quantity, 1);
    assert!(api::restore_backup(&core, FileArgs { file_name: "../component_inventory.db".into() }).is_err());
    assert!(api::diff_backup(&core, FileArgs { file_name: "nope.db".into() }).is_err());

    // Retention: automatic backups are pruned, manual ones stay.
    api::update_settings(&core, UpdateSettingsArgs { patch: json!({"backup_retention": 2}) }).unwrap();
    for i in 0..4 {
        api::save_component(&core, SaveComponentArgs { component: part(&format!("X{i}"), 1) }).unwrap();
        assert!(api::auto_backup(&core, NoArgs {}).unwrap().is_some());
        std::thread::sleep(std::time::Duration::from_millis(1100));
    }
    assert!(api::auto_backup(&core, NoArgs {}).unwrap().is_none(), "nothing changed since the last one");
    let list = api::list_backups(&core, NoArgs {}).unwrap();
    assert_eq!(list.iter().filter(|b| b.kind != "manual").count(), 2, "{list:?}");
    assert!(list.iter().any(|b| b.file_name == b1.file_name));
}

#[test]
fn restoring_an_old_schema_backup_migrates_it_again() {
    let dir = common::v0_data_dir();
    let core = inventory_core::Core::open(dir.path(), None).unwrap();
    let pre = api::list_backups(&core, NoArgs {}).unwrap().into_iter().find(|b| b.kind == "pre-migration").unwrap();
    api::save_component(&core, SaveComponentArgs { component: part("NEW", 1) }).unwrap();
    let r = api::restore_backup(&core, FileArgs { file_name: pre.file_name }).unwrap();
    assert_eq!((r.migration.from_version, r.migration.to_version), (0, 1));
    let parts = api::list_components(&core, NoArgs {}).unwrap();
    assert_eq!(parts.len(), 10);
    assert!(parts.iter().all(|p| p.category != "Unclassified"));
}

#[test]
fn drive_snapshot_writes_three_files_atomically() {
    let (_d, core) = common::fresh();
    let drive = tempfile::tempdir().unwrap();
    api::save_component(
        &core,
        SaveComponentArgs {
            component: ComponentInput { part_code: "LM358".into(), category: "ICs".into(), quantity: 3, ..Default::default() },
        },
    )
    .unwrap();
    assert_eq!(api::sync_now(&core, NoArgs {}).unwrap().state, "off");
    core.read(|c| {
        inventory_core::settings::set_folder(c, inventory_core::settings::FolderKind::Drive, Some(drive.path().to_string_lossy().into()))
    })
    .unwrap();
    api::update_settings(&core, UpdateSettingsArgs { patch: json!({"drive_enabled": true}) }).unwrap();
    assert_eq!(api::sync_status(&core, NoArgs {}).unwrap().state, "pending");
    let s = api::sync_now(&core, NoArgs {}).unwrap();
    assert_eq!(s.state, "ok", "{s:?}");
    for f in ["croxz.xlsx", "croxz.json", "croxz.db"] {
        assert!(drive.path().join(f).is_file(), "{f}");
    }
    assert!(std::fs::read_dir(drive.path()).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().ends_with(".tmp")));
    let json: serde_json::Value = serde_json::from_slice(&std::fs::read(drive.path().join("croxz.json")).unwrap()).unwrap();
    assert_eq!(json[0]["part_code"], "LM358");
    let snap = rusqlite::Connection::open(drive.path().join("croxz.db")).unwrap();
    let n: i64 = snap.query_row("SELECT COUNT(*) FROM components", [], |r| r.get(0)).unwrap();
    assert_eq!(n, 1);
    assert_eq!(api::sync_status(&core, NoArgs {}).unwrap().state, "ok");
}

#[test]
fn custom_columns_keep_their_values() {
    let (_d, core) = common::fresh();
    let col = api::save_custom_column(
        &core,
        SaveCustomColumnArgs {
            column: inventory_core::custom_columns::CustomColumnInput {
                id: None,
                col_label: "Raf / Göz".into(),
                col_type: "text".into(),
                is_visible: true,
                order_index: 0,
            },
        },
    )
    .unwrap();
    assert_eq!(col.col_key, "cc_raf_goz");
    let mut c = part("A", 1);
    c.custom_fields.insert(col.col_key.clone(), json!("3B"));
    let saved = api::save_component(&core, SaveComponentArgs { component: c }).unwrap();
    assert_eq!(saved.custom_fields.get("cc_raf_goz"), Some(&json!("3B")));
}

#[test]
fn dispatch_reads_invoke_shaped_arguments() {
    let (_d, core) = common::fresh();
    let out = api::dispatch(&core, "save_component", json!({"args": {"component": {"part_code": "BC547", "quantity": 4}}})).unwrap();
    assert_eq!(out["part_code"], "BC547");
    let list = api::dispatch(&core, "list_components", json!({"args": {}})).unwrap();
    assert_eq!(list.as_array().unwrap().len(), 1);
    let err = api::dispatch(&core, "drop_everything", json!({})).unwrap_err();
    assert_eq!(err.code, "unknown_command");
    let err = api::dispatch(&core, "get_component", json!({"args": {"id": "x"}})).unwrap_err();
    assert_eq!(err.code, "invalid_input");
    let err = api::dispatch(&core, "get_component", json!({"args": {"id": 999}})).unwrap_err();
    assert_eq!(err.code, "not_found");
    assert!(api::command_names().contains(&"undo_import"));
}

#[test]
fn library_lookup_when_the_bundled_file_is_present() {
    let lib = common::repo_root().join("patched.db");
    if !lib.is_file() {
        eprintln!("patched.db not present, skipped");
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let core = inventory_core::Core::open(dir.path(), Some(lib)).unwrap();
    let hits = api::search_library(&core, SearchArgs { term: "VHF160808".into(), limit: 5 }).unwrap();
    assert!(!hits.is_empty());
    let t = std::time::Instant::now();
    let codes: Vec<String> = (0..2000).map(|i| if i % 2 == 0 { "vhf160808h1n8st".to_string() } else { format!("NOPE{i}") }).collect();
    let found = api::lookup_library(&core, CodesArgs { codes }).unwrap();
    eprintln!("2000 library look-ups: {:?}", t.elapsed());
    assert_eq!(found[0].as_ref().unwrap().part_code, "VHF160808H1N8ST");
    assert!(found[1].is_none());
}
