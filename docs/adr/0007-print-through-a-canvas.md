# 0007. Labels and the PDF list are drawn on a canvas

- Status: accepted
- Date: 2026-10-03

## Context

jsPDF's built-in fonts cover Western European letters only. Turkish ş, ğ and ı, Cyrillic, Chinese and
Arabic come out as wrong glyphs. Embedding a font would need a TrueType file with every script the app
supports; the bundled Geist ships only as split WOFF2 subsets.

## Decision

Labels and the inventory PDF are drawn on a canvas with the app's own fonts (Geist, and the system font
of the script through the per-language stacks) and placed in the PDF as images: about 300 dpi for labels,
150 dpi for list pages.

## Consequences

- Every language prints correctly, right to left included, and looks like the app.
- The text in these PDFs cannot be selected or searched, and a long list makes a larger file (about
  150 kB a page). The Excel and CSV exports remain the searchable formats.
