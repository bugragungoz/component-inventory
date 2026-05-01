<div align="center">
  <img src="src-tauri/icons/icon.png" width="96" alt="Component Inventory logo"/>
  <h1>Component Inventory</h1>
  <p>Local-first desktop application for managing electronic component inventory.<br>No telemetry. No cloud. Data stays on your device.</p>
</div>

---

## Download

Grab the latest installer from [**Releases**](https://github.com/bugragungoz/component-inventory/releases).

| Installer | Notes |
|---|---|
| `Component Inventory_x.x.x_x64-setup.exe` | NSIS — recommended |
| `Component Inventory_x.x.x_x64_en-US.msi` | MSI package |

No runtime dependencies required. Install and run.

---

## Features

- **Inventory** — Full CRUD with search, category/location tree filtering, sort, compact/detailed view, low stock highlighting
- **Category-Aware Attributes** — Per-component-type dynamic parameter schema (VDS/ID/RDS(on)/VGS(th) for MOSFETs, VCE/IC/hFE for BJTs, etc.); parameters are rendered as form fields on add/edit and stored as JSON in the database; table columns update dynamically based on the active category
- **Import** — CSV, JSON, Excel (.xlsx/.xls), PDF; fuzzy column mapping covering English and Turkish order forms; Merge or Replace mode
- **Export** — CSV (UTF-8 BOM), JSON, Excel, PDF (styled table with header banner)
- **Component Detail** — Type-specific schematic icon, electrical specs, datasheet PDF button, local image attachment
- **Built-in Reference Library** — JLCPCB-sourced database of 60 000+ components enriched with KiCad datasheet links, bundled as `patched.db`; search by part name or value in the add/edit modal for one-click auto-fill of category, sub-category, parameters, and datasheet URL
- **Label Printing** — QR code labels exported as A4 PDF
- **Backup** — Auto-backup on write, scheduled every 15 minutes, max 30 retained, manual restore
- **Settings** — Show/hide location panel, low stock threshold, default export folder

---

## Phase 1 — Category-Aware Dynamic Attribute System

Each component type (MOSFET, BJT, Diode, Resistor, Capacitor, Inductor, etc.) has a dedicated set of electrical parameters defined by its category and sub-category. When adding or editing a component, the form automatically renders the relevant parameter fields for the selected type — for example, VDS, ID, RDS(on), and VGS(th) for MOSFETs, or VCE, IC, and hFE for BJTs. All parameter values are stored as JSON in the SQLite database using the `attribute_schemas` system. The inventory table adapts its visible columns dynamically based on the active category filter.

---

## Phase 2 — Advanced Built-in Reference Database (`patched.db`)

The application ships with a rich reference database derived from the JLCPCB component catalogue, cleaned of low-quality entries and enriched with datasheet links sourced from the KiCad component repository. When adding or editing a component, a built-in library search is available directly in the modal — type a part name or value to find matches, then select a result to auto-fill the category, sub-category, parameters, and datasheet URL in one click. The `patched.db` file is bundled with the application and requires no separate installation.

---

## Data Storage

| Path | Contents |
|---|---|
| `%AppData%\com.bugragungoz.component-inventory\component_inventory.db` | SQLite database |
| `%AppData%\com.bugragungoz.component-inventory\backups\` | Automatic backups |
| `%AppData%\com.bugragungoz.component-inventory\images\` | Attached images |

---

## Development

**Prerequisites:** Rust 1.75+, Node.js 20+, npm 10+

```bash
npm install
npm run dev        # dev server + Tauri window
npm run tauri build  # produces installer in src-tauri/target/release/bundle/
```

---

## Stack

- [Tauri v2](https://tauri.app/) (Rust backend, WebView2 frontend)
- Vanilla HTML / CSS / JavaScript
- SQLite via `tauri-plugin-sql`
- SheetJS, jsPDF, PDF.js, QRCode.js

---

## License

[MIT](LICENSE)

---

*Coded with [Claude Sonnet 4.6](https://www.anthropic.com/).*
