## 2026-06-16 - Explicit ARIA Labels for Icon-Only Elements

**Learning:** Icon-only buttons (like `.icon-btn` and `.modal-close`) lacking explicit screen-reader contexts create significant accessibility gaps in Vanilla JS applications, as screen readers fall back to ambiguous announcements. Furthermore, decorative SVGs without `aria-hidden="true"` add noise to the accessibility tree.
**Action:** Always provide explicit `aria-label` attributes for icon-only interactive elements and enforce `aria-hidden="true"` on their child SVGs to ensure clean and semantic screen reader routing.
