# Component Inventory

A desktop application for managing electronic component inventory. Built with Tauri v2 (Rust + WebView2), SQLite, and Vanilla JS.

## Prerequisites

- Windows 10/11 (WebView2 pre-installed on Windows 11; auto-installed on Windows 10)
- [Rust](https://rustup.rs/) 1.75+
- Node.js 20+
- npm 10+

For development only. End users install via the bundled `.exe` installer — no runtime dependencies required.

## Installation (Development)

```bash
npm install
npm run dev
```

Starts the Vite dev server and the Tauri application window simultaneously.

## Build

```bash
npm run tauri build
```

Produces two installers in `src-tauri/target/release/bundle/`:

| File | Type |
|---|---|
| `Component Inventory_x.x.x_x64-setup.exe` | NSIS installer (recommended) |
| `Component Inventory_x.x.x_x64_en-US.msi` | MSI package |

## Data Storage

| Path | Contents |
|---|---|
| `%AppData%\com.bugragungoz.component-inventory\component_inventory.db` | SQLite database |
| `%AppData%\com.bugragungoz.component-inventory\backups\` | Automatic backups |
| `%AppData%\com.bugragungoz.component-inventory\images\` | Attached component images |

## Features

### Inventory Management
- Full CRUD: Part Code, Category, Subcategory, Quantity, Package, Manufacturer, MPN, Location, Voltage Max, Current Max, Description, Datasheet URL, Unit Price, Notes, Image
- Search across all fields
- Filter by category tree (sidebar) and hierarchical location tree
- Sort by any column
- Compact / Detailed view toggle
- Low stock highlighting (Qty <= 1)

### Import
- Supported formats: CSV, JSON, Excel (.xlsx / .xls), PDF (text-based tables)
- Auto-detects delimiter (comma, semicolon, tab)
- Fuzzy column header matching — covers English and Turkish variants including order/purchase forms
- Auto-generates Part Code from Description when no part code column is present
- Import preview with per-cell validation (warnings and errors highlighted)
- Merge or Replace mode

### Export
- CSV (UTF-8 with BOM for Excel compatibility), JSON, Excel (.xlsx), PDF (styled table)

### Component Detail
- Type-specific schematic icon (Resistor, Capacitor, Inductor, IC, Transistor, Diode, LED, MOSFET, Relay, Connector, Crystal, Fuse, Transformer, Sensor, Module, MCU, OPAMP, Regulator, Switch)
- Electrical specifications from component record or built-in reference database (900+ common parts)
- Datasheet PDF button in modal header (visible only when URL is available)
- Local image attachment (copied to app data directory, shown in detail view)
- DB suggestion banner when built-in database has richer data than stored record

### Label Printing
- QR code label generator (per component)
- Configurable copy count (1-100)
- Exports A4 PDF with 2-column label layout

### Backup
- Auto-backup on every write operation
- Scheduled backup every 15 minutes
- Max 30 backups retained (oldest pruned automatically)
- Manual restore from backup list

### UI
- Dark / Light theme toggle
- Compact / Detailed table view
- Hierarchical location tree in sidebar
- Stats bar: component types, total units, category count

## Data Model

| Field | Type | Notes |
|---|---|---|
| part_code | TEXT (PK-like) | Unique identifier |
| category | TEXT | |
| subcategory | TEXT | |
| quantity | INTEGER | |
| package | TEXT | e.g. SOT-23, DIP-8 |
| manufacturer | TEXT | |
| mpn | TEXT | Manufacturer Part Number |
| location | TEXT | Supports hierarchy: `Cabinet-A / Shelf-3 / Bin-7` |
| voltage_max | REAL | |
| current_max | REAL | |
| description | TEXT | |
| datasheet_url | TEXT | |
| unit_price | REAL | |
| notes | TEXT | |
| image_path | TEXT | Absolute path in app data dir |

## Import Column Mapping

The importer recognizes the following column name variations (case-insensitive, Turkish diacritics normalized):

| Field | Accepted Headers (sample) |
|---|---|
| Part Code | part_code, sku, stok kodu, urun kodu, malzeme kodu, malzeme no, barkod, katalog no |
| Category | category, cat, kategori, tur, grup |
| Subcategory | subcategory, sub, alt kategori, alt kat |
| Quantity | quantity, qty, adet, miktar, toplam adet, siparis miktari |
| Package | package, footprint, pkg, paket, kasa |
| Manufacturer | manufacturer, mfr, brand, uretici, marka, tedarikci |
| MPN | mpn, part number, model, seri no, lot no |
| Location | location, bin, shelf, konum, depo, raf |
| Voltage Max | voltage_max, vmax, voltaj, gerilim |
| Current Max | current_max, imax, akim |
| Description | description, desc, name, urun adi, mal adi, komponent |
| Datasheet URL | datasheet_url, datasheet, url, link, pdf url |
| Unit Price | unit_price, price, cost, fiyat, birim fiyat, tl fiyat |
| Notes | notes, note, remarks, not, notlar, yorum |

If no Part Code column is found, the importer auto-generates codes from Description or assigns sequential IDs (`IMP-0001`, `IMP-0002`, ...).
