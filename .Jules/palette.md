## 2026-05-31 - Enhance Modal Close Button Accessibility

**Learning:** Icon-only modal close buttons without `aria-label` or `title` attributes create an accessibility gap, making it difficult for screen reader users to understand their purpose.
**Action:** Add `aria-label="Close dialog"` and `title="Close dialog"` to all `class="modal-close"` buttons, and `aria-hidden="true"` to their child SVGs.
