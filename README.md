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
- **Import** — CSV, JSON, Excel (.xlsx/.xls), PDF; fuzzy column mapping covering English and Turkish order forms; Merge or Replace mode
- **Export** — CSV (UTF-8 BOM), JSON, Excel, PDF (styled table with header banner)
- **Component Detail** — Type-specific schematic icon, electrical specs, datasheet PDF button, local image attachment
- **Built-in Database** — 900+ common parts for auto-fill and bulk categorization
- **Label Printing** — QR code labels exported as A4 PDF
- **Backup** — Auto-backup on write, scheduled every 15 minutes, max 30 retained, manual restore
- **Settings** — Show/hide location panel, low stock threshold, default export folder

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
