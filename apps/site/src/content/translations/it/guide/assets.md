---
title: Asset
sourceHash: 375cf7e40f14709c
---

<a id="images-and-hd-sprite-sheets"></a>

## Immagini e sprite sheet HD

Gli sprite sheet vengono caricati con `loading="lazy"` e `decoding="async"`. Gli
emoji che dispongono di uno sprite sheet HD (fotogrammi da 200px) ricevono
inoltre un `srcSet` basato sulla larghezza (`100w` e `200w`) con `sizes` pari
alla dimensione renderizzata (`auto` per un `size` di tipo stringa), così il
browser sceglie lo sheet `@2x` sugli schermi ad alta densità.

<a id="preloading"></a>

## Precaricamento

`preloadEmojis` inizia a recuperare il manifest prima che venga renderizzato
qualsiasi `Emoji` e, quando riceve degli id, richiede i loro sprite sheet una
volta che è pronto. Non rifiuta mai:

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` sceglie la variante da preriscaldare per gli emoji che hanno toni
della pelle.

## Asset site

Per default, il manifest e gli sprite sheet provengono da
`https://animated-fluent-emojis-cdn.andryore.dev`. Il vecchio indirizzo,
`https://animated-fluent-emojis.pages.dev`, continua a funzionare. Per servirli
dalla tua copia, chiama `configureEmojis` una volta, prima che venga
renderizzato il primo `Emoji`:

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
