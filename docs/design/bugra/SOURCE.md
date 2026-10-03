# Bugra design system: source of truth

These files are a copy of the project owner's "Bugra" design system (a claude.ai Design System
artifact: https://claude.ai/artifact/9jFbPnPhVZF6TCc8w7PKLJ). Read `README.md` first, then `tokens.json`.

- `tokens.json` holds every color (dark and light), type style, space, radius, shadow, motion and
  z-index value. The app's CSS variables in `src/style.css` are mapped from it (see the table in
  `docs/DEVELOPMENT_PROMPT.md`).
- `components/*/README.md` are the usage rules for each component; `components/bundle.css` and
  `components/bundle.js` are the reference implementation (React, for the system's own previews).
- If this copy and the artifact differ, the artifact wins; ask the owner before changing tokens.
