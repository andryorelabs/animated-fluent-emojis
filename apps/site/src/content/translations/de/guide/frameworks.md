---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

Ein Paket, ein Importpfad pro Framework. `configureEmojis` und `preloadEmojis`
sind frameworkunabhängig und bleiben unter `animated-fluent-emojis`; siehe
[Vorladen](assets.md#preloading) und [Asset site](assets.md#asset-site). Alle
Adapter teilen sich einen gemeinsamen Wiedergabekern und bestehen dieselbe
Konformitätssuite, sodass sich die Props überall gleich verhalten. Siehe
[ADR 0014](../adr/0014-multi-framework-support.md).

Die Adapter für React, Vue und Svelte sowie `createEmoji` lesen ihre Keyframes
aus `animated-fluent-emojis/style.css`; importiere sie einmal. `<fluent-emoji>`
und die Astro-Komponente bringen ihre eigenen Styles mit.

## React

Importiere `Emoji` aus dem React-Subpfad:

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

Migration von 0.6 oder früher: Der Root-Export `Emoji` wurde in 0.6 als veraltet
markiert und in 0.7 entfernt. Ändere den Importpfad, sonst nichts; Props und
Verhalten sind identisch. Der Typ `EmojiProps` ist ebenfalls nach
`animated-fluent-emojis/react` umgezogen. `configureEmojis` und `preloadEmojis`
bleiben unter `animated-fluent-emojis`. React 18 und 19 werden unterstützt, und
`react` und `react-dom` sind optionale Peers.

## Vue

Vue 3.3 oder neuer. `Emoji` akzeptiert die folgenden Props in camelCase. Der
`fallback`-Slot ersetzt das Bild, und die Events sind `load`, `error` und
`playbackEnd`. Weitere Attribute wie `class`, `style` und `data-*` gehen an das
Root-Span.

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

Auf dem Server und während der Hydration rendert es einen leeren Platzhalter in
der endgültigen Größe und funktioniert daher in Nuxt.

## Svelte

Svelte 5. `Emoji` akzeptiert die folgenden Props; `fallback` ist ein Snippet,
und `class`, `style` und `attributes` gehen an das Root-Span. Die Callbacks sind
`onLoad`, `onError` und `onPlaybackEnd`.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

Es rendert auf dem Server einen Platzhalter und nach der Hydration das Emoji,
sodass es in SvelteKit funktioniert. Der Paket-Export hat eine
`svelte`-Condition, die auf den Komponenten-Quellcode zeigt.

## Astro

Astro 5 oder neuer. Die Komponente rendert das Emoji-Markup zur Build-Zeit,
sodass das Sprite bereits im HTML steckt, bevor ein Skript läuft, und ein
kleines Skript startet die Wiedergabe im Browser. Sie bringt ihre eigenen Styles
mit; es gibt kein Stylesheet zu importieren. Der benannte Slot `fallback` wird
gerendert, wenn die ID unbekannt ist oder das Bild fehlschlägt.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

Die Props sind die unten genannten, ohne die Callbacks, mit `class` und einem
`style` als String. Das Root-Span sendet `emoji-load`, `emoji-error` und
`playback-end` als aufsteigende (bubbling) DOM-Events statt als Callbacks. Das
Browser-Skript läuft außerdem bei `astro:page-load` erneut, sodass View
Transitions weiter funktionieren.

<a id="plain-html"></a>

## Reines HTML

Der Import von `animated-fluent-emojis/element` registriert `<fluent-emoji>`. Es
braucht kein Stylesheet: Die Keyframes liegen in seinem Shadow Root.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Die Attribute spiegeln die Props in kebab-case: `id`, `size`, `play-on-hover`,
`animation-iterations`, `auto-play`, `playing`, `skin-tone` und `alt`. Ein
boolesches Attribut ist aktiv, es sei denn, sein Wert ist `false`. Dieselben
Namen existieren als camelCase-Properties am Element
(`element.playOnHover = true`); das Setzen einer Property schreibt das Attribut
nicht um. Ein Element mit `slot="fallback"` ist der Fallback. Das Element sendet
`emoji-load`, `emoji-error` und `playback-end` als aufsteigende, composed
Events.

Bis das Element definiert ist, hat es keine Größe. Füge
`FLUENT_EMOJI_PRE_UPGRADE_CSS`, exportiert aus demselben Entry, zum CSS deiner
Seite hinzu, um anhand des Attributs `size` (in Pixeln) den Platz zu reservieren
und einen Layout-Shift zu vermeiden.

<a id="angular-solid-and-preact"></a>

## Angular, Solid und Preact

Diese verwenden `<fluent-emoji>` über ihre eigene Template-Syntax; siehe die
How-to-Anleitungen für [Angular](../how-to/use-with-angular.md),
[Solid](../how-to/use-with-solid.md) und [Preact](../how-to/use-with-preact.md).
Das Gleiche gilt für Lit, Alpine und htmx: Importiere
`animated-fluent-emojis/element` und schreibe das Tag.

<a id="without-a-framework"></a>

## Ohne Framework

`createEmoji` rendert in jeden DOM-Knoten und gibt einen Controller zurück. Es
ist der frameworkunabhängige Kern aller Adapter. Sein Import greift nicht auf
das DOM zu.

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

Seine Optionen sind die unten genannten Props, mit `className`, `style` und
`attributes` für das Root-Span, den Callbacks `onLoad`, `onError` und
`onPlaybackEnd` sowie einem `fallback`, der ein Knoten, eine Funktion, die einen
Knoten zurückgibt, oder `null` sein kann.
