## 2024-05-15 - Modal Closing Animations

**Learning:** When closing modals or overlays, setting `display: 'none'` abruptly removes the element from the DOM flow, preventing any exit animations (like fade out or scale down) from playing.
**Action:** Use a JavaScript helper `window.closeModal(overlay)` that applies a `.closing` class (which triggers CSS exit animations) and a timeout to defer `display: 'none'`, aligning with smooth micro-interaction design patterns (Google Material Design 3). Ensure CSS contains `.closing` rules with matching animation durations.
