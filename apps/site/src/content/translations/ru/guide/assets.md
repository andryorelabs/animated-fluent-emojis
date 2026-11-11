---
title: Assets
sourceHash: 375cf7e40f14709c
---

<a id="images-and-hd-sprite-sheets"></a>

## Изображения и HD sprite sheets

Sprite sheets загружаются с `loading="lazy"` и `decoding="async"`. Эмодзи, у
которых есть HD sprite sheet (кадры 200px), также получают `srcSet` на основе
ширины (`100w` и `200w`) с `sizes`, равным отрисованному размеру (`auto` для
строкового `size`), поэтому на экранах с высокой плотностью браузер выбирает
sheet `@2x`.

<a id="preloading"></a>

## Предзагрузка

`preloadEmojis` начинает загрузку manifest до рендера любого `Emoji` и, если
переданы id, запрашивает их sprite sheets, когда он готов. Он никогда не
отклоняется:

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` выбирает вариант, который нужно прогреть, для эмодзи с оттенками
кожи.

## Asset site

По умолчанию manifest и sprite sheets берутся с
`https://animated-fluent-emojis-cdn.andryore.dev`. Прежний адрес,
`https://animated-fluent-emojis.pages.dev`, продолжает работать. Чтобы отдавать
их из собственной копии, вызовите `configureEmojis` один раз, до первого рендера
`Emoji`:

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
