# Capture tool

Saves the structure of a shop page you have open in Brave, so extractors can be written and tested
without logging in. Read-only: it does not read cookies, storage or passwords.

## Set up once

Close Brave, then start it with a debugging port and its **own profile folder**:

```bat
"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" ^
  --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\brave-capture-profile"
```

Sign in to the shops in that window. The login stays in that folder. A separate folder is required:
Chromium 136 and later ignore the debugging port for the default profile.

## Use

```bash
node tools/capture/capture.mjs list
node tools/capture/capture.mjs outline --tab motorobit
node tools/capture/capture.mjs snap --tab uye-siparisleri --shop motorobit --name order-detail
```

`outline` prints tables, quantity cells, quantity inputs, repeated class names, JSON-LD types and
dataLayer events: usually enough to write a selector. `snap` saves a cleaned copy of the page to
`.captures/<shop>/<name>.html` (git-ignored).

To expand a collapsed order first: `--click "<css selector>"`. For lazy lists add `--scroll`.

## Before anything is shared or committed

The tool strips scripts, styles, images and input values, and masks e-mail addresses, phone numbers,
IBANs and 11-digit numbers. It cannot know your name, street or order numbers: pass them with
`--redact "text"` and then read the file yourself. Only move a capture to `test-fixtures/` when it
holds nothing personal. Screenshots (`--screenshot`) show everything on screen; treat them as private.
