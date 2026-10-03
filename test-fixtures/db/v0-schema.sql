-- The schema of the owner's real database as of 2026-10-03 (PRAGMA user_version = 0), copied with
-- sqlite_master. Rows are synthetic: edge cases a migration must keep (legacy duplicate category
-- names, NULL attributes, Turkish letters, the old missing_qty column, custom_columns, a BOM row).
-- Owner's real counts at that date: 635 components, 2942 stock movements, 0 projects, 72 rows with a location.

CREATE TABLE components (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      part_code     TEXT UNIQUE NOT NULL,
      category      TEXT DEFAULT '',
      subcategory   TEXT DEFAULT '',
      quantity      INTEGER DEFAULT 0,
      package       TEXT DEFAULT '',
      manufacturer  TEXT DEFAULT '',
      mpn           TEXT DEFAULT '',
      location      TEXT DEFAULT '',
      voltage_max   REAL,
      current_max   REAL,
      description   TEXT DEFAULT '',
      datasheet_url TEXT DEFAULT '',
      unit_price    REAL,
      notes         TEXT DEFAULT '',
      image_path    TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    , resistance   TEXT DEFAULT '', tolerance    TEXT DEFAULT '', power_rating REAL, attributes   TEXT DEFAULT '{}', preferred_supplier TEXT DEFAULT '');

CREATE TABLE stock_movements (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id   INTEGER NOT NULL,
      part_code      TEXT NOT NULL,
      delta          INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      reason         TEXT DEFAULT '',
      created_at     TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE projects (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      description    TEXT DEFAULT '',
      schematic_path TEXT DEFAULT '',
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    , notes        TEXT DEFAULT '', order_index  INTEGER NOT NULL DEFAULT 0);

CREATE TABLE project_components (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id   INTEGER NOT NULL,
      component_id INTEGER NOT NULL,
      required_qty INTEGER NOT NULL DEFAULT 1,
      note         TEXT DEFAULT '',
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now')), missing_qty INTEGER NOT NULL DEFAULT 0,
      UNIQUE(project_id, component_id)
    );

CREATE TABLE custom_columns (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      col_key      TEXT NOT NULL UNIQUE,
      col_label    TEXT NOT NULL,
      col_type     TEXT DEFAULT 'text',
      is_visible   INTEGER DEFAULT 1,
      order_index  INTEGER DEFAULT 0
    );

INSERT INTO components (part_code, category, subcategory, quantity, package, manufacturer, mpn, location, description, unit_price, resistance, tolerance, power_rating, attributes, preferred_supplier) VALUES
 ('LM358ADT','ICs','Op-Amps',10,'SO8','ST','LM358ADT','Kutu 3','IC-358 AMPLIFIER DUAL SMD TR SO8 ST',3.47,'','',NULL,'{}','Özdisan'),
 ('R-91K-0603','Resistors','SMD',100,'0603','','','', '91K 603 SMD Direnç',0.59,'91k','1%',0.1,'{"resistance":"91k"}','Motorobit'),
 ('BT139-800E','Thyristors','Triacs',4,'TO-220','','','','BT139-800E Triyak TO-220 16A 800V',17.64,'','',NULL,'{}','Robocombo'),
 ('BTA16-600B','Thyristors & Triacs','Triacs',2,'TO-220','ST','','Raf A','legacy duplicate category name',NULL,'','',NULL,'',''),
 ('X-UNCAT-1','Uncategorized','',1,'','','','','',NULL,'','',NULL,NULL,''),
 ('X-UNCL-1','Unclassified','',0,'','','','','zero stock row',NULL,'','',NULL,'{}',''),
 ('SOLDER-PASTE','Consumables','',2,'','Felder','','','Lötfett Lehim Pastası',147.0,'','',NULL,'{}',''),
 ('TWEEZERS-1','Consumables & Tools','',1,'','','','','',NULL,'','',NULL,'{}',''),
 ('STK-SONY-1','Legacy Parts (Sony/VCR)','',3,'','Sony','','Kutu 9','',NULL,'','',NULL,'{}',''),
 ('ÇİP-İıŞş','ICs','',5,'','','','','Turkish case folding: İ ı Ş ş Ç ç Ğ ğ Ö ö Ü ü',NULL,'','',NULL,'{}','');
INSERT INTO stock_movements (component_id, part_code, delta, quantity_after, reason) VALUES
 (1,'LM358ADT',10,10,'import'),(2,'R-91K-0603',100,100,'import'),(3,'BT139-800E',4,4,'import'),(1,'LM358ADT',-2,8,'manual'),(1,'LM358ADT',2,10,'manual');
INSERT INTO projects (name, description, schematic_path, notes, order_index) VALUES ('Güç kaynağı','LM317 bench supply','C:/Users/someone/proj/psu.pdf','',0);
INSERT INTO project_components (project_id, component_id, required_qty, note, missing_qty) VALUES (1,1,2,'',0),(1,3,6,'needs 6, have 4',2);
INSERT INTO custom_columns (col_key, col_label, col_type, is_visible, order_index) VALUES ('cc_bin','Bin','text',1,0);
