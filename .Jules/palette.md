## 2024-05-24 - Add aria-labels and aria-hidden to Modal Close Buttons

**Learning:** SVG icons inside icon-only close buttons lacking explicit screen-reader contexts fail strict accessibility standards because screen readers have nothing to announce.
**Action:** Enhance `.modal-close` buttons by adding `aria-label="Close dialog"` and `aria-hidden="true"` to their inner `<svg>` elements across the main interface.
