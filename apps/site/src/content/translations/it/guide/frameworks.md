---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

Un solo pacchetto, un percorso di import per ogni framework. `configureEmojis` e
`preloadEmojis` non dipendono da alcun framework e restano in
`animated-fluent-emojis`; vedi [Precaricamento](assets.md#preloading) e
[Asset site](assets.md#asset-site). Tutti gli adapter condividono lo stesso core
di riproduzione e superano la stessa suite di conformità, quindi le props si
comportano ovunque allo stesso modo. Vedi l'
[ADR 0014](../adr/0014-multi-framework-support.md).

Gli adapter React, Vue e Svelte e `createEmoji` leggono i propri keyframes da
`animated-fluent-emojis/style.css`; importalo una sola volta. `<fluent-emoji>` e
il componente Astro includono i propri stili.

## React

Importa `Emoji` dal sottopercorso React:

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

Se esegui la migrazione dalla 0.6 o da una versione precedente: l'export `Emoji`
dalla radice è stato deprecato nella 0.6 e rimosso nella 0.7. Cambia il percorso
di import, nient'altro; props e comportamento sono identici. Anche il tipo
`EmojiProps` è stato spostato in `animated-fluent-emojis/react`.
`configureEmojis` e `preloadEmojis` restano in `animated-fluent-emojis`. React
18 e 19 sono supportati, e `react` e `react-dom` sono peer opzionali.

## Vue

Vue 3.3 o successivo. `Emoji` riceve le props qui sotto in camelCase. Lo slot
`fallback` sostituisce l'immagine, e gli eventi sono `load`, `error` e
`playbackEnd`. Gli altri attributi come `class`, `style` e `data-*` vengono
passati allo span radice.

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

Lato server, e durante l'idratazione, renderizza un segnaposto vuoto alla
dimensione finale, quindi funziona con Nuxt.

## Svelte

Svelte 5. `Emoji` riceve le props qui sotto; `fallback` è uno snippet, e
`class`, `style` e `attributes` vengono passati allo span radice. I callback
sono `onLoad`, `onError` e `onPlaybackEnd`.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

Renderizza un segnaposto lato server e l'emoji dopo l'idratazione, quindi
funziona con SvelteKit. L'export del pacchetto ha una condizione `svelte` che
punta al sorgente del componente.

## Astro

Astro 5 o successivo. Il componente renderizza il markup dell'emoji in fase di
build: lo sprite è quindi già nell'HTML prima che giri qualsiasi script, e un
piccolo script avvia la riproduzione nel browser. Include i propri stili; nessun
foglio di stile da importare. Lo slot con nome `fallback` viene renderizzato
quando l'id è sconosciuto o l'immagine non si carica.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

Le props sono quelle qui sotto, senza i callback, con `class` e uno `style` di
tipo stringa. Lo span radice emette `emoji-load`, `emoji-error` e `playback-end`
come eventi DOM con bubbling, al posto dei callback. Lo script del browser viene
eseguito di nuovo anche su `astro:page-load`, così le view transition continuano
a funzionare.

<a id="plain-html"></a>

## HTML semplice

Importare `animated-fluent-emojis/element` registra `<fluent-emoji>`. Non serve
alcun foglio di stile: i keyframes vivono nel suo shadow root.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Gli attributi rispecchiano le props in kebab-case: `id`, `size`,
`play-on-hover`, `animation-iterations`, `auto-play`, `playing`, `skin-tone` e
`alt`. Un attributo booleano è attivo a meno che il suo valore sia `false`. Gli
stessi nomi esistono come proprietà camelCase dell'elemento
(`element.playOnHover = true`); assegnare una proprietà non riscrive
l'attributo. Un elemento con `slot="fallback"` è il fallback. L'elemento emette
`emoji-load`, `emoji-error` e `playback-end` come eventi con bubbling e
`composed`.

Finché l'elemento non è definito, non ha dimensioni. Aggiungi
`FLUENT_EMOJI_PRE_UPGRADE_CSS`, esportato dallo stesso entry point, al CSS della
tua pagina per riservare lo spazio a partire dall'attributo `size` (in pixel) ed
evitare uno spostamento del layout.

<a id="angular-solid-and-preact"></a>

## Angular, Solid e Preact

Usano `<fluent-emoji>` tramite la propria sintassi dei template; vedi le guide
pratiche per [Angular](../how-to/use-with-angular.md),
[Solid](../how-to/use-with-solid.md) e [Preact](../how-to/use-with-preact.md).
Lo stesso vale per Lit, Alpine e htmx: importa `animated-fluent-emojis/element`
e scrivi il tag.

<a id="without-a-framework"></a>

## Senza framework

`createEmoji` esegue il rendering in qualsiasi nodo del DOM e restituisce un
controller. È il core senza framework di ogni adapter. Importarlo non tocca il
DOM.

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

Le sue opzioni sono le props qui sotto, con `className`, `style` e `attributes`
per lo span radice, i callback `onLoad`, `onError` e `onPlaybackEnd`, e un
`fallback` che è un nodo, una funzione che restituisce un nodo, oppure `null`.
