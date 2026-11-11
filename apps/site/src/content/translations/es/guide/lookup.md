---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup` no depende de React y comparte el manifest con
`Emoji`, por lo que es barato agregarlo junto a él. Cada función carga el
manifest y, cuando no puede, resuelve a `undefined` o a un arreglo vacío, sin
rechazar nunca:

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` resuelve un emoji y asigna un único modificador de
  tono de piel a `skinTone`; los tonos mezclados resuelven al emoji base. Los
  símbolos como `©` o `™` necesitan el selector de variación de emoji (U+FE0F)
  para coincidir, mientras que las secuencias ZWJ coinciden incluso cuando falta
  el selector de variación (minimally qualified).
- Cuando varias entradas del catalog comparten un glifo, lookup devuelve el
  emoji canónico: el id con prefijo de los code points del glifo; si no, una
  sobrescritura revisada; si no, la primera entrada en el orden del catalog. Por
  ejemplo, `❤️` resuelve al corazón y no a una variante que reutiliza el glifo.
  Con un tono de piel, recurre a una entrada hermana que tenga tonos.
- `extractEmojis(text)` encuentra todos los emojis del catalog en un texto,
  manteniendo completas las secuencias ZWJ, con su desplazamiento y longitud.
  Sin `Intl.Segmenter` recurre a un agrupador de code points, y ninguna de las
  dos funciones rechaza nunca.
- `searchEmojis(query, { limit })` busca en las descripciones, sin distinguir
  mayúsculas de minúsculas; `limit` es 20 por defecto; un `limit` que no sea un
  número positivo significa sin límite, excepto `0`, que no devuelve nada.
