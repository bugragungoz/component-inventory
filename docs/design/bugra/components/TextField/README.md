# TextField

A labeled 48px text input on `surface` with a `border-control` outline (3:1), hint or error text below.

- Added to cover forms; the source has none. Uses `border-control`, not `line-strong`, so the field edge is visible.
- The error message starts with the word "Error:" and turns `warn`; the border turns `warn` too, but the word carries the meaning.
- Label is always visible, never a placeholder replacement.
