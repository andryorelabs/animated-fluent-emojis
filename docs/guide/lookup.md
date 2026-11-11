# Lookup

`animated-fluent-emojis/lookup` has no React and shares the manifest with
`Emoji`, so it is cheap to add next to it. Every function loads the manifest and
resolves to `undefined` or an empty array, never rejects, when it cannot:

```js
import {
  extractEmojis,
  findEmojiByShortcode,
  findEmojiByUnicode,
  searchEmojis,
} from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await findEmojiByShortcode(":launch:"); // { id: '1f680_launch' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` resolves one emoji and maps a single skin tone
  modifier to `skinTone`; mixed tones resolve to the base emoji. Symbols such as
  `©` or `™` need the emoji variation selector (U+FE0F) to match, while ZWJ
  sequences match even when the variation selector is missing (minimally
  qualified).
- When several catalog entries share a glyph, lookup returns the canonical
  emoji: the id prefixed with the glyph's code points, otherwise a reviewed
  override, otherwise the first entry in catalog order. For example, `❤️`
  resolves to the heart rather than a variant that reuses the glyph. With a skin
  tone, it falls back to a sibling entry that has tones.
- `findEmojiByShortcode(shortcode)` resolves a `:name:` shortcode, ignoring
  case. The name is matched against emoji ids: first the exact id, then the id
  without its code point prefix, so `:launch:` resolves to `1f680_launch`. An
  exact id wins a collision (`:turkey:`, `:umbrella:` and `:camera:` resolve to
  the plain ids) and the prefixed entry stays reachable by its full id, such as
  `:1f983_turkey:`. Unknown shortcodes resolve to `undefined`. Shortcodes derive
  from ids only: the catalog has no other aliases.
- `extractEmojis(text)` finds every catalog emoji in a text, keeping ZWJ
  sequences whole, with its offset and length. Known `:shortcodes:` are found
  too, with the shortcode as `text`; unknown ones are left alone. Results are in
  order of appearance. Without `Intl.Segmenter` it falls back to a code point
  grouper, and neither function ever rejects.
- `searchEmojis(query, { limit })` matches descriptions, ignoring case; `limit`
  defaults to 20; a `limit` that is not a positive number means no limit, except
  `0`, which returns nothing.
