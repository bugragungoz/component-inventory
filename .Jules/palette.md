## 2026-06-01 - [Add aria-labels to icon-only buttons]

**Learning:** Icon-only buttons without inner text are skipped or read poorly by screen readers. Furthermore, decorative SVG elements inside buttons should be explicitly hidden from the accessibility tree using `aria-hidden="true"` to prevent redundant reading.
**Action:** Added `aria-label` to sidebar and modal close buttons, and `aria-hidden="true"` to their inner SVG icons in `src/index.html`.
