---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

Un paquete, una ruta de importación por framework. `configureEmojis` y
`preloadEmojis` no dependen de ningún framework y permanecen en
`animated-fluent-emojis`; consulta [Precarga](assets.md#preloading) y
[Asset site](assets.md#asset-site). Todos los adaptadores comparten un mismo
núcleo de reproducción y pasan una misma suite de conformidad, por lo que las
props se comportan igual en todas partes. Consulta el
[ADR 0014](../adr/0014-multi-framework-support.md).

Los adaptadores de React, Vue y Svelte y `createEmoji` leen sus keyframes de
`animated-fluent-emojis/style.css`; impórtalo una sola vez. `<fluent-emoji>` y
el componente de Astro incluyen sus propios estilos.

## React

Importa `Emoji` desde la subruta de React:

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

Si migras desde la 0.6 o anterior: la exportación `Emoji` de la raíz quedó
obsoleta en la 0.6 y se eliminó en la 0.7. Cambia la ruta de importación y nada
más; las props y el comportamiento son idénticos. El tipo `EmojiProps` también
se movió a `animated-fluent-emojis/react`. `configureEmojis` y `preloadEmojis`
permanecen en `animated-fluent-emojis`. Se admiten React 18 y 19, y `react` y
`react-dom` son peers opcionales.

## Vue

Vue 3.3 o posterior. `Emoji` recibe las props de abajo en camelCase. El slot
`fallback` reemplaza la imagen, y los eventos son `load`, `error` y
`playbackEnd`. Otros atributos como `class`, `style` y `data-*` se pasan al span
raíz.

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

En el servidor, y durante la hidratación, renderiza un marcador vacío con el
tamaño final, por lo que funciona en Nuxt.

## Svelte

Svelte 5. `Emoji` recibe las props de abajo; `fallback` es un snippet, y
`class`, `style` y `attributes` se pasan al span raíz. Los callbacks son
`onLoad`, `onError` y `onPlaybackEnd`.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

Renderiza un marcador en el servidor y el emoji después de la hidratación, por
lo que funciona en SvelteKit. La exportación del paquete tiene una condición
`svelte` que apunta al código fuente del componente.

## Astro

Astro 5 o posterior. El componente renderiza el marcado del emoji en tiempo de
compilación, por lo que el sprite ya está en el HTML antes de que se ejecute
cualquier script, y un pequeño script inicia la reproducción en el navegador.
Trae sus propios estilos; no hay ninguna hoja de estilos que importar. El slot
con nombre `fallback` se renderiza cuando el id es desconocido o la imagen
falla.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

Las props son las de abajo, sin los callbacks, con `class` y un `style` de tipo
string. El span raíz despacha `emoji-load`, `emoji-error` y `playback-end` como
eventos DOM con burbujeo, en lugar de callbacks. El script del navegador también
se ejecuta de nuevo en `astro:page-load`, por lo que las transiciones de vista
siguen funcionando.

<a id="plain-html"></a>

## HTML simple

Importar `animated-fluent-emojis/element` registra `<fluent-emoji>`. No necesita
hoja de estilos: los keyframes viven en su shadow root.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Los atributos reflejan las props en kebab-case: `id`, `size`, `play-on-hover`,
`animation-iterations`, `auto-play`, `playing`, `skin-tone` y `alt`. Un atributo
booleano está activo a menos que su valor sea `false`. Los mismos nombres
existen como propiedades en camelCase del elemento
(`element.playOnHover = true`); asignar una propiedad no reescribe el atributo.
Un elemento con `slot="fallback"` es el fallback. El elemento despacha
`emoji-load`, `emoji-error` y `playback-end` como eventos con burbujeo y
`composed`.

Hasta que el elemento está definido no tiene tamaño. Agrega
`FLUENT_EMOJI_PRE_UPGRADE_CSS`, exportado desde la misma entrada, al CSS de tu
página para reservar el espacio a partir del atributo `size` (en píxeles) y
evitar un desplazamiento del diseño.

<a id="angular-solid-and-preact"></a>

## Angular, Solid y Preact

Estos usan `<fluent-emoji>` mediante su propia sintaxis de plantillas; consulta
las guías prácticas de [Angular](../how-to/use-with-angular.md),
[Solid](../how-to/use-with-solid.md) y [Preact](../how-to/use-with-preact.md).
Lo mismo aplica a Lit, Alpine y htmx: importa `animated-fluent-emojis/element` y
escribe la etiqueta.

<a id="without-a-framework"></a>

## Sin un framework

`createEmoji` renderiza en cualquier nodo del DOM y devuelve un controlador. Es
el núcleo sin framework de cada adaptador. Importarlo no toca el DOM.

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

Sus opciones son las props de abajo, con `className`, `style` y `attributes`
para el span raíz, los callbacks `onLoad`, `onError` y `onPlaybackEnd`, y un
`fallback` que es un nodo, una función que devuelve un nodo, o `null`.
