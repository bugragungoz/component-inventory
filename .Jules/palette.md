## 2023-11-20 - Global Modal Close Animation Hook

**Learning:** When modals are closed throughout the Vanilla JS application (including via click outside, escape key, close buttons), abruptly setting `display: 'none'` bypasses any CSS exit animations. The prompt requests using a global `window.closeModal(overlay)` JavaScript helper to add a `.closing` class, delay 140ms for the animation, and then set `display: none` / remove the `.closing` class.

**Action:**
- Create `window.closeModal` helper in `src/app.js`.
- Search and replace all instances of `.style.display = 'none'` (for modals/overlays) with calls to `window.closeModal()`.
- Add animation CSS in `src/style.css` for `.modal.closing` and `.modal-overlay.closing`.
