## 2024-03-24 - [A11y: Explicit Labeling for Icon-only Modal Close Buttons]

**Learning:** When using Vanilla JS and raw HTML templates without frameworks, decorative-only icon buttons (such as `.modal-close` buttons containing only `<svg>` tags) require explicit text alternatives to be accessible to screen readers. Relying solely on visual cues or empty elements introduces accessibility gaps for keyboard and screen-reader users navigating modal overlays. The project's custom i18n system (`data-i18n-aria-label` and `data-i18n-title`) should be leveraged instead of hardcoding English labels.

**Action:** Ensured all `.modal-close` buttons have `data-i18n-aria-label="settings.btn.close"` and `data-i18n-title="settings.btn.close"` (with fallback English `aria-label="Close"` and `title="Close"`). Additionally, added `aria-hidden="true"` to the decorative `<svg>` element inside to prevent redundant or confusing screen-reader announcements.
