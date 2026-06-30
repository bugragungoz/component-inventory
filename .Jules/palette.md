## 2024-07-28 - Modal Exit Transitions and Tactile Feedback

**Learning:** Modals in this Vanilla JS/Tauri ecosystem abruptly disappear when `display: 'none'` is set, instantly destroying the DOM paint and interrupting the user's mental model of spatial layers. This lacks the tactile feedback expected in Material Design 3 micro-interactions.
**Action:** Implement a `closeModal()` JavaScript helper that applies a `.closing` CSS class to trigger 140ms exit keyframes (fade out and scale down) before removing the element from the display tree.
