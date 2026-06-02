## 2024-05-24 - Tactile Clear Search Button & Accessibility Labels

**Learning:** Search inputs often lack explicit context for screen readers in lightweight vanilla setups. Additionally, users lack immediate visual/tactile feedback to clear long queries.
**Action:** Added `aria-label` to the main search input. Injected a tactile, minimalist "Clear search" (`x`) icon button inside the `.search-wrap` container that seamlessly appears when input is present, providing immediate contextual feedback and keyboard-safe clearing.
