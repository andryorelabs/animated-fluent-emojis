---
title: Assets
sourceHash: 375cf7e40f14709c
---

<a id="images-and-hd-sprite-sheets"></a>

## Bilder und HD-Sprite-Sheets

Sprite Sheets werden mit `loading="lazy"` und `decoding="async"` geladen. Emojis
mit einem HD-Sprite-Sheet (Frames mit 200px) erhalten zusätzlich ein
breitenbasiertes `srcSet` (`100w` und `200w`), wobei `sizes` der gerenderten
Größe entspricht (`auto` bei einer `size` als String), sodass der Browser auf
Displays mit hoher Pixeldichte das `@2x`-Sheet wählt.

<a id="preloading"></a>

## Vorladen

`preloadEmojis` beginnt das Manifest zu laden, bevor ein `Emoji` gerendert wird,
und fordert, wenn IDs übergeben werden, deren Sprite Sheets an, sobald es bereit
ist. Es lehnt nie ab (rejects):

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` wählt die Variante, die für Emojis mit Hauttönen vorgewärmt wird.

## Asset site

Standardmäßig stammen das Manifest und die Sprite Sheets von
`https://animated-fluent-emojis-cdn.andryore.dev`. Die frühere Adresse,
`https://animated-fluent-emojis.pages.dev`, funktioniert weiterhin. Um sie von
deiner eigenen Kopie auszuliefern, rufe `configureEmojis` einmal auf, bevor das
erste `Emoji` gerendert wird:

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
