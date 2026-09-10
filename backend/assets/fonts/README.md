# PDF fonts

| File | Family | License |
|------|--------|---------|
| `IBMPlexSansArabic-Regular.ttf` / `-Bold.ttf` | IBM Plex Sans Arabic | SIL Open Font License 1.1 — © IBM Corp., https://github.com/IBM/plex |
| `NotoSansArabic-Regular.ttf` | Noto Sans Arabic (legacy, unused) | SIL Open Font License 1.1 — © The Noto Project Authors |

The invoice PDF (`src/services/invoicePdf.service.js`) uses **IBM Plex Sans Arabic** for
both scripts: it covers Latin, digits, punctuation, symbols and full Arabic shaping in a
single face, so a line can mix Arabic and Latin runs without font switching.

`NotoSansArabic-Regular.ttf` is kept only for backward compatibility with any external
reference to `ARABIC_FONT_PATH`; nothing renders with it anymore and it can be removed.
