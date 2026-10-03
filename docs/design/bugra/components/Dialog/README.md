# Dialog

A `surface` sheet with a `line-strong` border, `radius` corners, `shadow-dialog`, an `h3` title, muted body text and right-aligned buttons.

- Added for confirmations; the source has none. Place it on a `scrim` layer at `z-dialog`.
- Title says the decision; buttons repeat the action verbs ("Delete", "Cancel"), never "OK". Put the destructive or primary action last.
- Trap focus inside, return it on close, close on Escape.
