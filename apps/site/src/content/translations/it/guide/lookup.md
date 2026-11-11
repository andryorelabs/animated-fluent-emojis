---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup` non dipende da React e condivide il manifest con
`Emoji`; aggiungerlo accanto ha quindi un costo minimo. Ogni funzione carica il
manifest e, quando non riesce, si risolve in `undefined` o in un array vuoto,
senza mai rifiutare:

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` risolve un emoji e assegna a `skinTone` un unico
  modificatore del tono della pelle; i toni misti si risolvono nell'emoji di
  base. Simboli come `©` o `™` hanno bisogno del selettore di variazione emoji
  (U+FE0F) per corrispondere, mentre le sequenze ZWJ corrispondono anche quando
  il selettore di variazione manca (minimally qualified).
- Quando più voci del catalog condividono un glifo, lookup restituisce l'emoji
  canonico: l'id prefissato dai code point del glifo; altrimenti, un override
  rivisto; altrimenti, la prima voce nell'ordine del catalog. Ad esempio, `❤️`
  si risolve in cuore e non in una variante che riutilizza il glifo. Con un tono
  della pelle, ripiega su una voce sorella che ha toni.
- `extractEmojis(text)` trova tutti gli emoji del catalog in un testo,
  mantenendo intere le sequenze ZWJ, con il loro offset e la loro lunghezza.
  Senza `Intl.Segmenter`, ripiega su un raggruppatore di code point, e nessuna
  delle due funzioni rifiuta mai.
- `searchEmojis(query, { limit })` cerca nelle descrizioni, senza distinguere
  maiuscole e minuscole; `limit` vale 20 per default; un `limit` che non è un
  numero positivo significa nessun limite, tranne `0`, che non restituisce
  nulla.
