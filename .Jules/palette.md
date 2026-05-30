## 2026-05-30 - Modal Close and Icon Button Accessibility

**Learning:** In Vanilla JS/Tauri apps, icon-only buttons (like modal closes or sidebar controls) lack accessible text unless explicitly provided. Screen readers will often read raw SVGs if they are not explicitly hidden.
**Action:** Always provide `aria-label` and `title` to icon-only buttons, and set `aria-hidden="true"` on child decorative `<svg>` elements to ensure a clean, understandable screen reader experience without repetitive layout readings.
