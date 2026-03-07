# Component Inventory

A desktop application for managing electronic component inventory. Built with Tauri v2 (Rust + WebView2), SQLite, and Vanilla JS. Follows Anthropic brand guidelines.

## Prerequisites

- Windows 10/11 (WebView2 is pre-installed on Windows 11; auto-installed on Windows 10)
- [Rust](https://rustup.rs/) 1.70+
- Node.js 18+
- npm 9+
- [Ollama](https://ollama.com/) (optional, for AI features)

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This starts the Vite dev server and the Tauri application window simultaneously.

## Build

```bash
npm run build
```

Produces a standalone `.exe` installer in `src-tauri/target/release/bundle/`.

## Data Storage

- Database: `%AppData%\Roaming\com.bugragungoz.component-inventory\component_inventory.db`
- Backups: `%AppData%\Roaming\com.bugragungoz.component-inventory\backups\`

## Features

- Full CRUD on electronic components (Part Code, Category, Subcategory, Qty, Package, Manufacturer, MPN, Location, Voltage Max, Current Max, Description, Datasheet URL, Unit Price, Notes)
- Search, filter by category tree, sort by any column
- Import: CSV, JSON, Excel (.xlsx), PDF
- Export: CSV, JSON, Excel (.xlsx), PDF
- Ollama AI chat with full inventory context
- Ollama auto-categorize all components
- Ollama AI field enrichment for individual components
- Auto-backup on every mutation + scheduled every 15 minutes (max 30 backups retained)
- Dark / Light theme toggle
- Low stock highlighting (Qty <= 1)

## AI Setup

1. Install [Ollama](https://ollama.com/)
2. Pull a model: `ollama pull llama3.1`
3. Start Ollama: `ollama serve`
4. Open the AI Chat panel in the application

## Import Column Mapping

The importer accepts common column name variations:

| Field | Accepted Headers |
|---|---|
| Part Code | part_code, Part Code, part, partcode |
| Category | category, cat |
| Subcategory | subcategory, sub, sub_category |
| Quantity | quantity, qty, stock, count |
| Package | package, footprint, pkg |
| Manufacturer | manufacturer, mfr, brand |
| MPN | mpn, manufacturer part number, part number |
| Location | location, bin, storage |
| Voltage Max | voltage_max, voltage max, vmax |
| Current Max | current_max, current max, imax |
| Description | description, desc |
| Datasheet URL | datasheet_url, datasheet |
| Unit Price | unit_price, price, cost |
| Notes | notes, note, remarks, comment |
