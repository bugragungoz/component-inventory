## 2024-05-24 - Accessibility Enhancements for Icon-Only Buttons

**Learning:** In the Vanilla JS + Tauri ecosystem, native HTML elements like `<button>` often rely purely on `title` attributes for tooltips, which aren't always reliably read by screen readers. Furthermore, decorative SVG icons inside these buttons are exposed to accessibility APIs unless explicitly hidden.
**Action:** Always include explicit `aria-label` attributes on icon-only interactive elements and enforce `aria-hidden="true"` on their inner SVG graphics to ensure a clean, predictable screen-reader experience.
