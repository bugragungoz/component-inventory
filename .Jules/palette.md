## 2026-06-26 - Accessibility: Added aria-label to modal close buttons

**Learning:** Icon-only buttons lacking explicit screen-reader contexts fail accessibility guidelines. Custom Vanilla JS i18n means hardcoded attributes like `aria-label="Close"` won't translate.
**Action:** Always add `data-i18n-aria-label="settings.btn.close"` and `title` to icon-only buttons that map to existing translation keys.
