## 2024-05-19 - Accessible Modals

**Learning:** Modal close buttons (`<button class="modal-close">`) require proper ARIA attributes to be accessible, as they are often icon-only buttons without text content. In this custom Vanilla JS application, they must use the existing translation system (e.g., `data-i18n-aria-label="settings.btn.close"`) rather than hardcoded English.
**Action:** Added `data-i18n-aria-label="settings.btn.close"` and `aria-label="Close"` to all `.modal-close` buttons throughout `src/index.html`. Added `aria-hidden="true"` to decorative SVGs within these buttons.
