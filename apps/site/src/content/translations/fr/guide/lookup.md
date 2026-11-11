---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup` ne dépend pas de React et partage le manifest
avec `Emoji` ; l'ajouter à côté de lui coûte donc très peu. Chaque fonction
charge le manifest et, lorsqu'elle n'y parvient pas, se résout en `undefined` ou
en tableau vide, sans jamais rejeter :

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` résout un emoji et affecte un unique modificateur
  de teinte de peau à `skinTone` ; les teintes mélangées se résolvent en l'emoji
  de base. Les symboles comme `©` ou `™` ont besoin du sélecteur de variation
  d'emoji (U+FE0F) pour correspondre, tandis que les séquences ZWJ correspondent
  même lorsque le sélecteur de variation est absent (minimally qualified).
- Lorsque plusieurs entrées du catalog partagent un glyphe, lookup renvoie
  l'emoji canonique : l'id préfixé par les code points du glyphe ; sinon, une
  surcharge révisée ; sinon, la première entrée dans l'ordre du catalog. Par
  exemple, `❤️` se résout en cœur et non en une variante qui réutilise le
  glyphe. Avec une teinte de peau, il se rabat sur une entrée sœur qui a des
  teintes.
- `extractEmojis(text)` trouve tous les emojis du catalog dans un texte, en
  gardant les séquences ZWJ entières, avec leur décalage et leur longueur. Sans
  `Intl.Segmenter`, il se rabat sur un regroupeur de code points, et aucune des
  deux fonctions ne rejette jamais.
- `searchEmojis(query, { limit })` cherche dans les descriptions, sans tenir
  compte de la casse ; `limit` vaut 20 par défaut ; un `limit` qui n'est pas un
  nombre positif signifie sans limite, sauf `0`, qui ne renvoie rien.
