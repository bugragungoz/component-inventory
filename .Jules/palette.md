## 2024-07-09 - [Modal Closing Animations]

**Learning:** When closing modals or overlays in this Tauri/Vanilla JS application, setting `display: 'none'` abruptly removes the element from the DOM paint cycle, losing any smooth exit animations.
**Action:** Always use the `window.closeModal(overlay)` JavaScript helper, which applies a `.closing` class (triggering the `ci-overlay-fade-out` and `ci-modal-pop-out` animations in `src/style.css`) and waits 140ms before setting `display: 'none'`.
