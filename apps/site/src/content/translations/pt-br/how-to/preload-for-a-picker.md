---
title: Pré-carregue para um seletor
sourceHash: 727a2637d064bf30
---

Aqueça o manifest e os sprite sheets antes de um seletor de emojis abrir, para
que os emojis apareçam sem um carregamento visível.

## Aqueça o manifest cedo

`preloadEmojis` sem argumentos começa a buscar o manifest antes de qualquer
`Emoji` ser renderizado. Ele nunca é rejeitado, então `void` basta:

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

Chame-o quando o usuário provavelmente vai abrir o seletor, por exemplo ao
passar o mouse ou focar o botão que o abre, ou quando o shell do app é montado.

## Aqueça os sprite sheets que você vai mostrar

Passe ids para requisitar seus sprite sheets assim que o manifest estiver
pronto. Passe `skinTone` para aquecer a variante que o usuário verá, nos emojis
que têm tons de pele:

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

Aqueça apenas os ids que você vai renderizar primeiro. Um seletor com centenas
de emojis não deve pré-carregar todos; os sprite sheets são carregados de forma
lazy (`loading="lazy"`) à medida que se aproximam da viewport. `skinTone` é um
entre `'default'`, `'light'`, `'medium-light'`, `'medium'`, `'medium-dark'` ou
`'dark'`.

## Configure o asset site primeiro

Se você usa [um asset site próprio](self-host-the-assets.md), chame
`configureEmojis` antes de `preloadEmojis`. Mudar o asset site depois de um
preload reinicia o manifest, então as requisições aquecidas são desperdiçadas.

## Quando a rede falha

A requisição do manifest desiste após 15 segundos. Um manifest com falha é
repetido na próxima chamada de `preloadEmojis`, na próxima montagem ou quando o
navegador volta a ficar online, então chamá-lo de novo a partir do botão é
seguro. Consulte [preloading](../guide/assets.md#preloading) e
[fallback](../guide/behavior.md#fallback).
