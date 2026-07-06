## 2025-07-06 - [Smooth Modal Close]
 **Learning:** Setting `display: none` immediately on modals cuts off CSS exit animations, which feels abrupt. A helper is needed to apply a closing class, wait for the animation, and then remove the element from the flow.
 **Action:** Introduce a `closeModal(overlay)` helper in Vanilla JS. Update code to use `closeModal()` instead of setting `display = 'none'` directly. Add CSS transition/animation for the `.closing` state in `src/style.css`.
