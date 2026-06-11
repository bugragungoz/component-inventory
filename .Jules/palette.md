## 2024-06-11 - Icon-Only Button Accessibility

**Learning:** Icon-only buttons lacking explicit screen-reader context degrade accessibility and user experience in modern web aesthetics. SVGs acting merely as visuals within these buttons should be hidden to avoid screen reader clutter.
**Action:** Always include an explicit `aria-label` attribute on icon-only buttons (`.icon-btn`, `.modal-close`) and add `aria-hidden="true"` to the inner decorative SVGs.
