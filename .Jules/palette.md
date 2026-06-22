## 2024-05-19 - Adding ARIA labels to close buttons

**Learning:** Icon-only modal close buttons lack explicit screen-reader context. The Vanilla JS custom i18n module processes `data-i18n-aria-label` attributes to dynamically assign the translated string to the `aria-label`.
**Action:** Adding `data-i18n-aria-label="settings.btn.close"` to all `.modal-close` buttons in `src/index.html` to improve accessibility.
