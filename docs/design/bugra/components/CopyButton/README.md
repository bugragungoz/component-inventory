# CopyButton

A small pill that copies text and swaps its label to the confirmation for two seconds, filling with `accent`.

- Labels are supplied in the page language: `label="Copy"`, `copiedLabel="Copied"`.
- Give it `text` or a `getText()` callback. It falls back silently when the Clipboard API is unavailable.
- Sits at the end of a `CodeBlock` bar; use it on its own only next to a block of copyable text.
