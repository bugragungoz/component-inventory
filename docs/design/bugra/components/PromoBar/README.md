# PromoBar

A one-row strip above the masthead for a single cross-promotion: one line of text, up to two small buttons and a close button.

- It opens once (height and opacity ease over 500ms and 400ms), and stays closed after a dismissal; remember the dismissal for 30 days in `localStorage` and show it if storage is unavailable.
- Under `prefers-reduced-motion` it appears and disappears without animation.
- On phones the text and secondary button hide, leaving two short chips and the close button.
- Icons in it are drawn in their own site's color (`partner-cyan` for the terminal glyph).
