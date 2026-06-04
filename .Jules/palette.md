## 2024-05-14 - [A11y Label]

**Learning:** Empty states lack screen reader contexts. Action buttons might be purely visual.
**Action:** Enhance accessibility across components while adding small micro-interactions, like subtle opacity changes or transform scaling.

## 2024-05-15 - [Accessible Icon Buttons & Micro-Interactions]

**Learning:** Icon-only buttons (like modal close buttons) often lack explicit semantic meaning for screen readers, and rigid interfaces feel unresponsive to user clicks.
**Action:** Always add explicit `aria-label` and `title` attributes to icon-only buttons. Add `aria-hidden="true"` to purely decorative inner SVGs. Employ the `.interaction-safe` class to provide a tactile `transform: scale(0.95)` on active states for smoother micro-interactions without relying on heavy external frameworks.
