# lang

Localization and textual resources of Crownicles, one directory per locale (`de`, `en`, `es`, `fr`, `it`, `pt`).

## Rules

- French (`fr/`) is the reference locale.
- Every locale has exactly the same files and keys as French. When you add, edit or remove a French string, add, update or remove it in every other locale in the same pull request.
- A translation keeps the placeholders of its French version: `{{variable}}`, `{emote:path}`, `{command:name}` and `$t(namespace:key)`.
- No hardcoded emojis: use `{emote:path}` interpolations.

## CI

The `Translations` workflow enforces these rules on every pull request touching `Lang/`:

```bash
node .github/scripts/check-translations.mjs parity Lang                 # same keys in every locale
node .github/scripts/check-translations.mjs sync Lang origin/develop    # edited French strings are updated everywhere
node .github/scripts/check-emojis.mjs translations Lang                 # no hardcoded emojis
```

A French-only change that does not affect the other languages (typo, wording) can skip the update of the other locales with the `no-translation-sync` pull request label. The placeholders are still checked.
