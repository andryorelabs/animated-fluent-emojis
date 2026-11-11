# Assets

## Images and HD sprite sheets

Sprite sheets are loaded with `loading="lazy"` and `decoding="async"`. Emojis
that have an HD sprite sheet (200px frames) also get a width-based `srcSet`
(`100w` and `200w`) with `sizes` set to the rendered size (`auto` for a string
`size`), so the browser picks the `@2x` sheet on high-density displays.

## Preloading

`preloadEmojis` starts fetching the manifest before any `Emoji` renders and,
when given ids, requests their sprite sheets once it is ready. It never rejects:

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` picks the variant to warm for emojis that have skin tones.

## Asset site

By default the manifest and sprite sheets come from
`https://animated-fluent-emojis-cdn.andryore.dev`. The previous address,
`https://animated-fluent-emojis.pages.dev`, keeps working. To serve them from
your own copy, call `configureEmojis` once, before the first `Emoji` renders:

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
