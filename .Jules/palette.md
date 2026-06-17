## 2026-06-17 - [Explicit ARIA Labels for Icon-Only Buttons]
**Learning:** Icon-only buttons (like modal close buttons) in Vanilla JS / semantic HTML interfaces fail to provide actionable context to screen readers, and standard `<svg>` tags can often be interpreted incorrectly if not hidden.
**Action:** Always apply `aria-label` and `title` attributes to buttons containing only iconography, and append `aria-hidden="true"` to the inner SVG element to ensure clean accessibility mappings.
