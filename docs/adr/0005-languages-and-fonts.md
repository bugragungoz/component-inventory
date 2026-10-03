# 0005. Languages and fonts

- Status: accepted
- Date: 2026-10-03

## Decision

- One JSON file per locale in `src/locales/` (`en`, `tr`, `zh-CN`, `ru`, `de`, `ar`). English is the
  fallback. Each file carries `"_meta": { "reviewed": false }` until a person signs it off; the About
  screen shows that state.
- Messages use `{name}` placeholders and CLDR plural forms selected with `Intl.PluralRules`
  (`"key": { "one": "...", "other": "..." }`; Russian has one/few/many/other, Chinese only other).
  `tools/i18n/check-locales.mjs` fails the build when a locale lacks a key, has an extra key, uses other
  placeholders than English, or misses a plural form its language needs.
- Numbers, dates, lists and sorting go through `Intl`; search folds case by locale (Turkish `İ/i`, `I/ı`).
- `parseQuantity` reads shop data and is locale independent; quantities the owner types follow the UI
  locale (`parseUserQuantity`).
- A pseudo-locale (`en-XA`: accented, 40 % longer) is generated at runtime for visual tests.
- **Fonts:** Geist 400/500/600 and JetBrains Mono 400/500 (Latin, Latin Extended and Cyrillic subsets)
  are bundled. Scripts Geist lacks fall to Windows system fonts through the font stack, chosen with
  `:lang()`: Cyrillic and Greek `Segoe UI`, Simplified Chinese `Microsoft YaHei UI`, Japanese
  `Yu Gothic UI`, Korean `Malgun Gothic`, Arabic `Segoe UI`. `lang` and `dir` are set on `<html>`.
- Layout uses logical CSS properties only, so Arabic needs no separate layout.
