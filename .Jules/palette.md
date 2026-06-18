## 2024-06-18 - Explicit ARIA Labels for Icon-Only Buttons
**Learning:** In Vanilla JS/Tauri applications, native semantic structures sometimes lack context for screen readers when components use icon-only buttons.
**Action:** Always add explicit `aria-label` attributes to icon-only buttons and append `aria-hidden="true"` to decorative `<svg>` elements to prevent unnecessary screen reader announcements.
