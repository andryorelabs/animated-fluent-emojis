---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup` enthält kein React und teilt sich das Manifest
mit `Emoji`, sodass es günstig ist, es daneben hinzuzufügen. Jede Funktion lädt
das Manifest und liefert `undefined` oder ein leeres Array, wenn sie es nicht
kann, und lehnt nie ab:

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` löst ein einzelnes Emoji auf und bildet einen
  einzelnen Hautton-Modifikator auf `skinTone` ab; gemischte Töne lösen zum
  Basis-Emoji auf. Symbole wie `©` oder `™` benötigen den
  Emoji-Variation-Selector (U+FE0F), um zu passen, während ZWJ-Sequenzen auch
  dann passen, wenn der Variation Selector fehlt (minimally qualified).
- Wenn sich mehrere Katalogeinträge ein Glyph teilen, liefert Lookup das
  kanonische Emoji: die ID, der die Codepoints des Glyphs vorangestellt sind,
  andernfalls einen geprüften Override, andernfalls den ersten Eintrag in der
  Katalogreihenfolge. Zum Beispiel löst `❤️` zum Herz auf und nicht zu einer
  Variante, die das Glyph wiederverwendet. Mit einem Hautton fällt es auf einen
  Geschwistereintrag zurück, der Töne hat.
- `extractEmojis(text)` findet jedes Katalog-Emoji in einem Text, belässt
  ZWJ-Sequenzen ganz und liefert Offset und Länge. Ohne `Intl.Segmenter` fällt
  es auf einen Codepoint-Gruppierer zurück, und keine der beiden Funktionen
  lehnt je ab.
- `searchEmojis(query, { limit })` vergleicht Beschreibungen ohne
  Berücksichtigung der Groß- und Kleinschreibung; `limit` ist standardmäßig 20;
  ein `limit`, der keine positive Zahl ist, bedeutet kein Limit, außer `0`, das
  nichts zurückgibt.
