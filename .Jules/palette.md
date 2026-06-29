## 2024-05-24 - Accessibility improvements on modals

**Learning:** When modals have a close button, screen readers need to know what they do. The project relies on a custom Vanilla JS i18n implementation and uses `data-i18n-*` attributes to ensure translations are applied correctly at runtime.
**Action:** Added `data-i18n-aria-label="settings.btn.close"` and `data-i18n-title="settings.btn.close"` to all `.modal-close` buttons. Also ensured that the SVGs inside those buttons have `aria-hidden="true"` so that the screen reader focuses on the label and not the image itself.
