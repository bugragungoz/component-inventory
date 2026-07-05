## 2024-06-25 - CSS Exit Animations via Modal Helper

**Learning:** Abruptly setting `display: 'none'` on modal overlays in the Vanilla JS / Tauri ecosystem prevents CSS exit transitions from firing, making the application feel unpolished compared to entry transitions.
**Action:** Implemented a global `closeModal(overlay)` JavaScript helper in `app.js` that applies a `.closing` CSS class (which triggers a 140ms `ci-modal-pop-out` animation) and uses `setTimeout` to wait for the animation to finish before removing the element from the flow. This ensures a symmetrical, Anthropic-style micro-interaction for both modal entry and exit.
