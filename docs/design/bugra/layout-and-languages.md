# Layout and languages

## Page structure

One column, `measure` (900px) wide, centered with a fluid gutter of 20-64px (`clamp(20px, 5vw, 64px)`). Order: promo bar (optional), masthead, hero, sections (each with a `line` top border), footer. Sections use 44-72px vertical padding; the hero opens 56-104px from the masthead. Prose is at most 66ch.

## Breakpoints

- Below 480px: the language menu shows only its globe and the list pins to the gutters.
- Below 640px: the promo bar drops its sentence and secondary link and keeps two short chips and the close button.
- For Android and mobile layouts, use Material window size classes: compact under 600dp, medium 600-839dp, expanded 840dp and up. The web column stays fluid rather than snapping to them.

## Languages

- The source publishes ten languages from one template, English first, each name written in its own language: English, Turkce, Francais, Espanol, Deutsch, Italiano, Russian, Japanese, Arabic, Chinese. Keep the menu order stable.
- Use logical properties everywhere (`inset-inline-start`, `padding-inline-start`, `margin-inline-end`) so right-to-left pages need no separate layout. Set `dir` on `html`.
- Geist has no CJK or Arabic glyphs. Keep Geist first in the stack and let missing glyphs fall to the system font for that language: Hiragino Sans, Yu Gothic or Noto Sans JP for Japanese; PingFang SC, Microsoft YaHei or Noto Sans SC for Chinese; SF Arabic, Geeza Pro or Noto Sans Arabic for Arabic.
- For Arabic, Japanese and Chinese set heading `letter-spacing` to normal (the tight tracking is tuned for Latin); Arabic body line-height 1.85.
- Code, prompt and command blocks stay `dir="ltr"` on every page.
- Each language page carries its own `lang`, canonical URL, `hreflang` alternates with an `x-default`, and its own social image.

## Social image

1200x630 (`og-w`, `og-h`). Headline in `og-title` with the subject phrase in `accent`, sub line in `og-sub`, the address as an `accent` pill bottom-end. Headline size per language: English and Turkish 82px, French 72px, Spanish 78px, German 70px, Italian 74px, Russian 70px, Japanese 66px, Arabic 76px, Chinese 80px; max width 17ch (Latin), 24ch (Japanese), 20ch (Arabic and Chinese). Render it with headless Chrome at `--window-size=1200,630`.
