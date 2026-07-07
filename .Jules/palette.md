## 2024-07-07 - Smooth Modal Closing Exit Animations

**Learning:** Abruptly setting `display: 'none'` on modals breaks CSS exit animations (fade/scale out) and creates a jarring micro-interaction for the user, falling short of modern Material Design 3 expectations.
**Action:** When closing modals or overlays, always use the `window.closeModal(overlay)` JavaScript helper. This helper applies a `.closing` class (triggering `modal-out` and `overlay-out` CSS keyframes) and waits 140ms before removing the element from the flow.
