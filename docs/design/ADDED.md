# What the app adds to Bugra

Bugra was drawn for a website. A data-heavy desktop app needs pieces it does not have; each one below
is built from Bugra tokens and shapes, marked "(added)" in the code, and can be moved into the Bugra
artifact if the owner wants it there.

## Tokens (`docs/design/added-tokens.json`, generated into `src/styles/tokens.css`)

| Token | Value | Why |
|---|---|---|
| `--row-h` | 36px | Dense table rows; the table is virtual and needs a fixed height. |
| `--table-head-h` | 36px | Sticky table header. |
| `--toolbar-h` | 56px | The view toolbar. |
| `--statusbar-h` | 30px | Counts, last backup and Drive sync at the bottom. |
| `--sidebar-w` | 272px | Navigation and the category tree. |
| `--panel-w` | 440px | The detail panel beside the table. |
| `--icon-ui` | 18px | Toolbar and row icons. |
| `--icon-category` | 20px | Category and subcategory icons. |
| `--dialog-w` | 560px | Form dialogs (Bugra's question dialog stays 440px). |
| `--dialog-w-wide` | 1080px | Labels, bulk suggestions, diffs. |
| `--z-panel` | 25 | The detail panel when it floats over the table. |
| `--z-tooltip` | 65 | Tooltips above dialogs and snackbars. |

## Components (`src/components`)

| Component | Notes |
|---|---|
| Button `quiet` and `danger` | Quiet has no outline until hovered; danger uses the `warn` outline and text. |
| Checkbox | Native input, 3:1 outline, accent fill with a check. |
| Dialog sizes | `question` (Bugra's), `form` and `wide`; focus moves in before paint, Escape answers the topmost dialog only. |
| Confirm host | Bugra's dialog for questions, answered through a Promise (B7, B8). Cancel has the focus. |
| Snackbar stack | Bugra's snackbar, stacked, with an Undo action; warnings stay until closed. |
| Menu | A popover list with arrow keys and Escape. |
| Tabs | Pill tabs with a count. |
| Badge | A small pill with a word; status never by color alone. |
| Empty state | Says what is missing and offers the next action. |
| Progress, spinner | A thin line and an inline spinner. |
| Kbd | Keyboard keys in the shortcut list and the search hint. |
| Virtual table | Fixed rows, one scroller, sticky header, `role="grid"` with keyboard navigation. |
| Category icons | A 24 px, 1.6 stroke glyph for every category and subcategory (`src/components/categoryIcons.ts`, gallery in `docs/design/category-icons.png`). |

## Print output

Labels and the PDF inventory list are black on white whatever the theme; they are drawn on a canvas so
every script prints (`docs/adr/0007-print-through-a-canvas.md`).
