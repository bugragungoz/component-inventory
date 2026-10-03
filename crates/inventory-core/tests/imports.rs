//! Atomic imports and their undo.

mod common;

use inventory_core::api::{self, ApplyImportArgs, IdArgs, NoArgs, SaveComponentArgs};
use inventory_core::imports::{ImportMode, ImportRequest, ImportRow};
use inventory_core::model::ComponentInput;
use inventory_core::Core;

fn row(code: &str, qty: i64) -> ImportRow {
    ImportRow { part_code: code.into(), quantity: qty, ..Default::default() }
}

fn import(core: &Core, mode: ImportMode, rows: Vec<ImportRow>) -> inventory_core::imports::ImportResult {
    api::apply_import(
        core,
        ApplyImportArgs { request: ImportRequest { source_label: "test".into(), source_kind: "file".into(), mode, rows } },
    )
    .unwrap()
}

fn qty(core: &Core, code: &str) -> Option<i64> {
    api::list_components(core, NoArgs {}).unwrap().into_iter().find(|c| c.part_code == code).map(|c| c.quantity)
}

#[test]
fn add_mode_creates_adds_and_sums_duplicates() {
    let (_d, core) = common::fresh();
    let r = import(&core, ImportMode::Add, vec![row("LM358", 10), row("BC547", 5), row("LM358", 2)]);
    assert_eq!((r.created, r.updated, r.pieces), (2, 0, 17));
    assert_eq!(qty(&core, "LM358"), Some(12));
    let r2 = import(&core, ImportMode::Add, vec![row("LM358", 3)]);
    assert_eq!((r2.created, r2.updated, r2.pieces), (0, 1, 3));
    assert_eq!(qty(&core, "LM358"), Some(15));
    // Every movement the import wrote carries its batch id.
    let missing: i64 = core
        .read(|c| {
            Ok(c.query_row("SELECT COUNT(*) FROM stock_movements WHERE reason = 'import' AND import_batch_id IS NULL", [], |r| r.get(0))?)
        })
        .unwrap();
    assert_eq!(missing, 0);
    // A backup was taken before each import.
    let backups = api::list_backups(&core, NoArgs {}).unwrap();
    assert_eq!(backups.iter().filter(|b| b.kind == "pre-import").count(), 2);
}

#[test]
fn add_mode_fills_empty_fields_but_keeps_curated_ones() {
    let (_d, core) = common::fresh();
    api::save_component(
        &core,
        SaveComponentArgs {
            component: ComponentInput {
                part_code: "LM358".into(),
                quantity: 1,
                description: "My dual op-amp".into(),
                ..Default::default()
            },
        },
    )
    .unwrap();
    let mut r = row("LM358", 2);
    r.description = "IC-358 AMPLIFIER DUAL SMD TR SO8 ST".into();
    r.package = "SO8".into();
    r.category = "ICs".into();
    import(&core, ImportMode::Add, vec![r]);
    let c = api::list_components(&core, NoArgs {}).unwrap().remove(0);
    assert_eq!(c.description, "My dual op-amp");
    assert_eq!(c.package, "SO8");
    assert_eq!(c.category, "ICs", "Uncategorized counts as empty");
    assert_eq!(c.quantity, 3);
}

#[test]
fn sync_mode_sets_quantities() {
    let (_d, core) = common::fresh();
    import(&core, ImportMode::Add, vec![row("A", 10)]);
    import(&core, ImportMode::Sync, vec![row("A", 4), row("B", 1)]);
    assert_eq!(qty(&core, "A"), Some(4));
    assert_eq!(qty(&core, "B"), Some(1));
}

#[test]
fn undo_reverses_only_that_batch() {
    let (_d, core) = common::fresh();
    let first = import(&core, ImportMode::Add, vec![row("A", 10), row("B", 5)]);
    let second = import(&core, ImportMode::Add, vec![row("A", 1), row("C", 7)]);
    let u = api::undo_import(&core, IdArgs { id: first.batch_id }).unwrap();
    assert!(u.notes.is_empty(), "{:?}", u.notes);
    // A was created by the first import and got +1 from the second: only the 10 go away.
    assert_eq!(qty(&core, "A"), Some(1));
    // B came only from the first import: it is removed.
    assert_eq!(qty(&core, "B"), None);
    assert_eq!(qty(&core, "C"), Some(7));
    // Undoing twice is refused.
    assert!(api::undo_import(&core, IdArgs { id: first.batch_id }).is_err());
    let batches = api::list_imports(&core, NoArgs {}).unwrap();
    assert_eq!(batches.iter().find(|b| b.id == first.batch_id).unwrap().status, "undone");
    assert_eq!(batches.iter().find(|b| b.id == second.batch_id).unwrap().status, "applied");
    let u2 = api::undo_import(&core, IdArgs { id: second.batch_id }).unwrap();
    // C, and A (created by the first import, emptied now), both go.
    assert_eq!(u2.deleted, 2);
    assert!(api::list_components(&core, NoArgs {}).unwrap().is_empty());
}

#[test]
fn undo_leaves_fields_edited_after_the_import() {
    let (_d, core) = common::fresh();
    import(&core, ImportMode::Add, vec![row("A", 1)]);
    let mut r = row("A", 2);
    r.description = "from the shop".into();
    r.package = "SO8".into();
    let b = import(&core, ImportMode::Add, vec![r]);
    // The owner fixes the package by hand afterwards.
    let mut c = api::list_components(&core, NoArgs {}).unwrap().remove(0);
    c.package = "SOIC-8".into();
    api::save_component(&core, SaveComponentArgs { component: ComponentInput::from(&c) }).unwrap();
    let u = api::undo_import(&core, IdArgs { id: b.batch_id }).unwrap();
    let c = api::list_components(&core, NoArgs {}).unwrap().remove(0);
    assert_eq!(c.quantity, 1);
    assert_eq!(c.description, "", "a field nobody touched goes back");
    assert_eq!(c.package, "SOIC-8", "a field edited after the import stays");
    assert!(u.notes.iter().any(|n| n.reason == "edited_since" && n.field.as_deref() == Some("package")));
}

#[test]
fn undo_keeps_a_new_part_that_was_put_on_a_bom() {
    let (_d, core) = common::fresh();
    let b = import(&core, ImportMode::Add, vec![row("A", 3)]);
    let p = api::create_project(&core, api::CreateProjectArgs { name: "P".into() }).unwrap();
    let id = api::list_components(&core, NoArgs {}).unwrap()[0].id;
    api::upsert_bom_line(
        &core,
        api::UpsertBomArgs {
            line: inventory_core::projects::BomLineInput { project_id: p.id, component_id: id, required_qty: 1, ..Default::default() },
        },
    )
    .unwrap();
    let u = api::undo_import(&core, IdArgs { id: b.batch_id }).unwrap();
    assert_eq!(qty(&core, "A"), Some(0));
    assert!(u.notes.iter().any(|n| n.reason == "used_in_project"));
}

#[test]
fn undo_reports_when_stock_went_below_what_was_imported() {
    let (_d, core) = common::fresh();
    import(&core, ImportMode::Add, vec![row("A", 2)]);
    let b = import(&core, ImportMode::Add, vec![row("A", 5)]);
    let id = api::list_components(&core, NoArgs {}).unwrap()[0].id;
    api::adjust_quantity(&core, api::AdjustArgs { id, delta: -6 }).unwrap();
    let u = api::undo_import(&core, IdArgs { id: b.batch_id }).unwrap();
    assert_eq!(qty(&core, "A"), Some(0));
    assert!(u.notes.iter().any(|n| n.reason == "stock_below"));
}

#[test]
fn replace_relinks_bom_by_code_and_undo_restores_everything() {
    let (_d, core) = common::fresh();
    import(&core, ImportMode::Add, vec![row("KEEP", 4), row("GONE", 9)]);
    let parts = api::list_components(&core, NoArgs {}).unwrap();
    let keep = parts.iter().find(|c| c.part_code == "KEEP").unwrap().clone();
    let gone = parts.iter().find(|c| c.part_code == "GONE").unwrap().clone();
    let p = api::create_project(&core, api::CreateProjectArgs { name: "Amp".into() }).unwrap();
    for (c, req) in [(&keep, 2), (&gone, 3)] {
        api::upsert_bom_line(
            &core,
            api::UpsertBomArgs {
                line: inventory_core::projects::BomLineInput {
                    project_id: p.id,
                    component_id: c.id,
                    required_qty: req,
                    note: "n".into(),
                    ..Default::default()
                },
            },
        )
        .unwrap();
    }
    let r = import(&core, ImportMode::Replace, vec![row("KEEP", 1), row("NEW", 2)]);
    assert_eq!((r.removed, r.created), (2, 2));
    let bom = api::list_bom(&core, IdArgs { id: p.id }).unwrap();
    assert_eq!(bom.len(), 1, "KEEP is linked again by its code, GONE has no part any more");
    assert_eq!(bom[0].part_code, "KEEP");
    assert_eq!(bom[0].required_qty, 2);

    api::undo_import(&core, IdArgs { id: r.batch_id }).unwrap();
    let after = api::list_components(&core, NoArgs {}).unwrap();
    assert_eq!(after.len(), 2);
    assert_eq!(after.iter().find(|c| c.part_code == "KEEP").unwrap().id, keep.id, "the old ids come back");
    assert_eq!(qty(&core, "KEEP"), Some(4));
    assert_eq!(qty(&core, "GONE"), Some(9));
    assert_eq!(qty(&core, "NEW"), None);
    let bom = api::list_bom(&core, IdArgs { id: p.id }).unwrap();
    assert_eq!(bom.len(), 2);
}

#[test]
fn an_invalid_line_fails_the_whole_import_and_writes_nothing() {
    let (_d, core) = common::fresh();
    let res = api::apply_import(
        &core,
        ApplyImportArgs {
            request: ImportRequest {
                source_label: "t".into(),
                source_kind: "file".into(),
                mode: ImportMode::Add,
                rows: vec![row("A", 1), row("", 2)],
            },
        },
    );
    assert!(res.is_err());
    let res = api::apply_import(
        &core,
        ApplyImportArgs {
            request: ImportRequest {
                source_label: "t".into(),
                source_kind: "file".into(),
                mode: ImportMode::Add,
                rows: vec![row("A", 1), row("B", -1)],
            },
        },
    );
    assert!(res.is_err());
    assert!(api::list_components(&core, NoArgs {}).unwrap().is_empty());
    assert!(api::list_imports(&core, NoArgs {}).unwrap().is_empty());
}

#[test]
fn two_thousand_lines_commit_in_under_three_seconds() {
    let (_d, core) = common::fresh();
    let rows: Vec<ImportRow> = (0..2000)
        .map(|i| ImportRow {
            part_code: format!("P-{i:05}"),
            quantity: (i % 50) + 1,
            category: "Resistors".into(),
            description: format!("part {i}"),
            ..Default::default()
        })
        .collect();
    let t = std::time::Instant::now();
    let r = import(&core, ImportMode::Add, rows.clone());
    let first = t.elapsed();
    assert_eq!(r.created, 2000);
    let t = std::time::Instant::now();
    let r = import(&core, ImportMode::Add, rows);
    let second = t.elapsed();
    assert_eq!(r.updated, 2000);
    eprintln!("2000-line import: create {first:?}, update {second:?}");
    assert!(first.as_secs_f64() < 3.0 && second.as_secs_f64() < 3.0, "create {first:?}, update {second:?}");
}
