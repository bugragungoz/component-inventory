## 2024-06-13 - Icon-Only Button Accessibility

**Learning:** In a lightweight Vanilla JS architecture without UI frameworks, icon-only buttons (like modal close buttons) easily lack context for screen readers. Native semantic HTML attributes must be strictly manually enforced to maintain accessibility.
**Action:** Always include `aria-label` and `title` on icon-only buttons. Add `aria-hidden="true"` to decorative SVGs inside these buttons to prevent confusing screen reader announcements.
