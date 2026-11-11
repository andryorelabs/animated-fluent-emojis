---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup` não depende do React e compartilha o manifest
com `Emoji`, então é barato adicioná-lo ao lado dele. Cada função carrega o
manifest e resolve para `undefined` ou um array vazio, sem nunca rejeitar,
quando não consegue:

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` resolve um emoji e mapeia um único modificador de
  tom de pele para `skinTone`; tons mistos resolvem para o emoji base. Símbolos
  como `©` ou `™` precisam do seletor de variação de emoji (U+FE0F) para
  corresponder, enquanto as sequências ZWJ correspondem mesmo quando o seletor
  de variação está ausente (minimamente qualificadas).
- Quando várias entradas do catálogo compartilham um glifo, o lookup devolve o
  emoji canônico: o id prefixado com os code points do glifo, senão uma
  substituição revisada, senão a primeira entrada na ordem do catálogo. Por
  exemplo, `❤️` resolve para o coração, e não para uma variante que reutiliza o
  glifo. Com um tom de pele, ele recorre a uma entrada irmã que tenha tons.
- `extractEmojis(text)` encontra todos os emojis do catálogo em um texto,
  mantendo as sequências ZWJ inteiras, com seu deslocamento e comprimento. Sem
  `Intl.Segmenter`, ele recorre a um agrupador de code points, e nenhuma das
  duas funções jamais rejeita.
- `searchEmojis(query, { limit })` compara com as descrições, ignorando
  maiúsculas e minúsculas; `limit` tem padrão 20; um `limit` que não seja um
  número positivo significa sem limite, exceto `0`, que não devolve nada.
