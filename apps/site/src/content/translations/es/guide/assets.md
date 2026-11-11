---
title: Assets
sourceHash: 375cf7e40f14709c
---

<a id="images-and-hd-sprite-sheets"></a>

## Imágenes y sprite sheets HD

Los sprite sheets se cargan con `loading="lazy"` y `decoding="async"`. Los
emojis que tienen un sprite sheet HD (cuadros de 200px) reciben además un
`srcSet` basado en ancho (`100w` y `200w`) con `sizes` igual al tamaño
renderizado (`auto` para un `size` de tipo string), de modo que el navegador
elige el sheet `@2x` en pantallas de alta densidad.

<a id="preloading"></a>

## Precarga

`preloadEmojis` empieza a obtener el manifest antes de que se renderice
cualquier `Emoji` y, cuando recibe ids, solicita sus sprite sheets una vez que
está listo. Nunca rechaza:

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` elige la variante que se precalienta para los emojis que tienen tonos
de piel.

## Asset site

Por defecto, el manifest y los sprite sheets provienen de
`https://animated-fluent-emojis-cdn.andryore.dev`. La dirección anterior,
`https://animated-fluent-emojis.pages.dev`, sigue funcionando. Para servirlos
desde tu propia copia, llama a `configureEmojis` una vez, antes de que se
renderice el primer `Emoji`:

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
