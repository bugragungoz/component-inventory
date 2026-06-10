## 2024-06-10 - [Accessibility Enhancements for Icon-Only Modal Controls]

**Learning:** Vanilla HTML icon-only buttons (like modal close buttons) are functionally inaccessible to screen readers without explicit ARIA contexts, and default browser focus states often blend into minimalist open-source backgrounds, hindering keyboard navigation.
**Action:** Always inject `aria-label` and `title` attributes on interactive icon-only elements while explicitly hiding their interior decorative SVGs (`aria-hidden="true"`). Furthermore, always enforce a visible `:focus-visible` outline utilizing existing CSS variables (`--accent-dim` or similar) to ensure logical tab-order feedback.
