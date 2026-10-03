# Button

The pill button. **Outline** is the default; **primary** (accent fill, `on-accent` text) at most once per view, for the thing the page is for.

- Verb first, sentence case, one or two words: "Copy prompt", "Save changes". A confirmation names the same action: "Publish" then "Published".
- `size="sm"` (34px) is for related-project links and bars; default padding is 11px 20px.
- Pass `href` to render an anchor. A disabled button drops to `disabled-fill` and `disabled-ink`.
- Hover adds a `surface-2` fill and an `ink` border; a primary button brightens to `accent-hover`.
