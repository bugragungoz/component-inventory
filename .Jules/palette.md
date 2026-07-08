## 2025-02-12 - Smooth Modal Closing Transitions

**Learning:** Abruptly hiding modals removes them from DOM before exit animations can play. Vanilla JS needs a class toggling and timeout mechanism to persist the DOM node during the animation.
**Action:** When closing modals or overlays, use the `window.closeModal(overlay)` JavaScript helper (which applies a `.closing` class and a 140ms timeout) instead of abruptly setting `display: 'none'`.
