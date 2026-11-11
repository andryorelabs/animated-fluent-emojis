---
title: Assets
sourceHash: 375cf7e40f14709c
---

<a id="images-and-hd-sprite-sheets"></a>

## Imagens e sprite sheets HD

Os sprite sheets são carregados com `loading="lazy"` e `decoding="async"`. Os
emojis que têm um sprite sheet HD (quadros de 200px) também recebem um `srcSet`
baseado em largura (`100w` e `200w`), com `sizes` definido como o tamanho
renderizado (`auto` para um `size` em string), para que o navegador escolha o
sheet `@2x` em telas de alta densidade.

<a id="preloading"></a>

## Pré-carregamento

`preloadEmojis` começa a buscar o manifest antes que qualquer `Emoji` seja
renderizado e, quando recebe ids, solicita seus sprite sheets assim que ele
estiver pronto. Ele nunca rejeita:

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` escolhe a variante a aquecer para os emojis que têm tons de pele.

## Asset site

Por padrão, o manifest e os sprite sheets vêm de
`https://animated-fluent-emojis-cdn.andryore.dev`. O endereço anterior,
`https://animated-fluent-emojis.pages.dev`, continua funcionando. Para servi-los
a partir da sua própria cópia, chame `configureEmojis` uma vez, antes de o
primeiro `Emoji` ser renderizado:

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
