## 2024-05-14 - Modal Close Animations

**Learning:** Abruptly setting `display: 'none'` on modal overlays disrupts the DOM paint and breaks expected micro-interaction design patterns (like fade and scale out) typical in Material Design.
**Action:** When closing modals or overlays, implement and use a `window.closeModal(overlay)` JavaScript helper. This helper should apply a `.closing` class (to trigger CSS exit animations) and wait for a 140ms timeout before setting `display: 'none'`.
