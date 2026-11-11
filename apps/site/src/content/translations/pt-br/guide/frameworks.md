---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

Um pacote, um caminho de importação por framework. `configureEmojis` e
`preloadEmojis` não dependem de nenhum framework e permanecem em
`animated-fluent-emojis`; veja [Pré-carregamento](assets.md#preloading) e
[Asset site](assets.md#asset-site). Todos os adaptadores compartilham um mesmo
núcleo de reprodução e passam por uma mesma suíte de conformidade, então as
props se comportam do mesmo jeito em qualquer lugar. Veja o
[ADR 0014](../adr/0014-multi-framework-support.md).

Os adaptadores de React, Vue e Svelte e o `createEmoji` leem seus keyframes de
`animated-fluent-emojis/style.css`; importe-o uma única vez. O `<fluent-emoji>`
e o componente do Astro trazem seus próprios estilos.

## React

Importe `Emoji` do subcaminho do React:

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

Migrando da versão 0.6 ou anterior: a exportação `Emoji` da raiz foi
descontinuada na 0.6 e removida na 0.7. Mude o caminho de importação, nada mais;
as props e o comportamento são idênticos. O tipo `EmojiProps` também foi movido
para `animated-fluent-emojis/react`. `configureEmojis` e `preloadEmojis`
permanecem em `animated-fluent-emojis`. O React 18 e o 19 são compatíveis, e
`react` e `react-dom` são peers opcionais.

## Vue

Vue 3.3 ou posterior. `Emoji` recebe as props abaixo em camelCase. O slot
`fallback` substitui a imagem, e os eventos são `load`, `error` e `playbackEnd`.
Outros atributos, como `class`, `style` e `data-*`, vão para o span raiz.

```vue
<script setup lang="ts">
import { Emoji } from "animated-fluent-emojis/vue";

import "animated-fluent-emojis/style.css";

const handlePlaybackEnd = () => {
  console.log("done");
};
</script>

<template>
  <Emoji id="1f44b_wavinghand" :size="64" play-on-hover @playback-end="handlePlaybackEnd">
    <template #fallback><span>👋</span></template>
  </Emoji>
</template>
```

No servidor, e durante a hidratação, ele renderiza um placeholder vazio com o
tamanho final, então funciona no Nuxt.

## Svelte

Svelte 5. `Emoji` recebe as props abaixo; `fallback` é um snippet, e `class`,
`style` e `attributes` vão para o span raiz. Os callbacks são `onLoad`,
`onError` e `onPlaybackEnd`.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

Ele renderiza um placeholder no servidor e o emoji após a hidratação, então
funciona no SvelteKit. A exportação do pacote tem uma condição `svelte` que
aponta para o código-fonte do componente.

## Astro

Astro 5 ou posterior. O componente renderiza a marcação do emoji em tempo de
build, então o sprite já está no HTML antes de qualquer script rodar, e um
pequeno script inicia a reprodução no navegador. Ele traz seus próprios estilos;
não há folha de estilo para importar. O slot nomeado `fallback` é renderizado
quando o id é desconhecido ou a imagem falha.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

As props são as listadas abaixo, menos os callbacks, com `class` e um `style` em
string. O span raiz dispara `emoji-load`, `emoji-error` e `playback-end` como
eventos DOM com bubbling, em vez de callbacks. O script do navegador também roda
de novo em `astro:page-load`, então as view transitions continuam funcionando.

<a id="plain-html"></a>

## HTML puro

Importar `animated-fluent-emojis/element` registra o `<fluent-emoji>`. Ele não
precisa de folha de estilo: os keyframes ficam no seu shadow root.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Os atributos espelham as props em kebab-case: `id`, `size`, `play-on-hover`,
`animation-iterations`, `auto-play`, `playing`, `skin-tone` e `alt`. Um atributo
booleano está ativado, a menos que seu valor seja `false`. Os mesmos nomes
existem como propriedades em camelCase no elemento
(`element.playOnHover = true`); definir uma propriedade não reescreve o
atributo. Um elemento com `slot="fallback"` é o fallback. O elemento dispara
`emoji-load`, `emoji-error` e `playback-end` como eventos com bubbling e
composed.

Até que o elemento seja definido, ele não tem tamanho. Adicione
`FLUENT_EMOJI_PRE_UPGRADE_CSS`, exportado da mesma entrada, ao CSS da sua página
para reservar o espaço a partir do atributo `size` (em pixels) e evitar um
deslocamento de layout.

<a id="angular-solid-and-preact"></a>

## Angular, Solid e Preact

Eles usam o `<fluent-emoji>` por meio da sintaxe de template de cada um; veja os
guias práticos para [Angular](../how-to/use-with-angular.md),
[Solid](../how-to/use-with-solid.md) e [Preact](../how-to/use-with-preact.md). O
mesmo vale para Lit, Alpine e htmx: importe `animated-fluent-emojis/element` e
escreva a tag.

<a id="without-a-framework"></a>

## Sem framework

`createEmoji` renderiza em qualquer nó do DOM e devolve um controller. É o
núcleo, independente de framework, de todos os adaptadores. Importá-lo não toca
no DOM.

```js
import { createEmoji } from "animated-fluent-emojis";
import "animated-fluent-emojis/style.css";

const controller = createEmoji(document.querySelector("#slot"), {
  id: "1f44b_wavinghand",
  size: 64,
  fallback: () => document.createTextNode("👋"),
});

controller.update({ playing: false });
controller.destroy();
```

Suas opções são as props abaixo, com `className`, `style` e `attributes` para o
span raiz, os callbacks `onLoad`, `onError` e `onPlaybackEnd`, e um `fallback`
que é um nó, uma função que devolve um nó, ou `null`.
