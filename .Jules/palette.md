## 2024-05-24 - Explicit ARIA Labels for Icon-Only Buttons

**Learning:** Icon-only buttons (like modal close buttons, settings, and theme toggles) that lack explicit text need standard screen-reader context to be accessible. Relying only on `title` or visual cues can leave keyboard and screen-reader users guessing.
**Action:** Enforce strict semantic HTML5 by adding `aria-label` attributes to all `.modal-close` buttons and sidebar icon buttons, and tagging their purely decorative SVG children with `aria-hidden="true"`.
