## 2024-06-20 - [ARIA Accessibility for Modals and Icons]

**Learning:** When using icon-only buttons or close buttons in Vanilla JS applications, screen readers lack explicit context.
**Action:** Always add `aria-hidden="true"` to decorative SVGs, and use custom attributes like `data-i18n-aria-label` matching existing translation keys (e.g. `data-i18n-aria-label="settings.btn.close"`) on the parent `<button>` tags so the UI text reflects the correct runtime locale explicitly.
