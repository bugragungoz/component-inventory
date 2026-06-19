## 2024-06-19 - Accessibility Improvements for Modals and Icon Buttons
**Learning:** Icon-only buttons and modal close buttons lack explicit screen-reader contexts (like `aria-label`).
**Action:** Add `data-i18n-aria-label` or `aria-label` to icon-only buttons (`.modal-close`, `btn-github-sidebar`, `btn-settings`, `btn-theme`) to ensure screen readers announce their function. If translation keys exist, use `data-i18n-aria-label`.
