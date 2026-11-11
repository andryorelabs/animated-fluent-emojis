# Frameworks

One package, one import path per framework. `configureEmojis` and
`preloadEmojis` are framework-free and stay at `animated-fluent-emojis`; see
[Preloading](assets.md#preloading) and [Asset site](assets.md#asset-site). Every
adapter shares one playback core and passes one conformance suite, so props
behave the same everywhere. See
[ADR 0014](../adr/0014-multi-framework-support.md).

The React, Vue and Svelte adapters and `createEmoji` read their keyframes from
`animated-fluent-emojis/style.css`; import it once. `<fluent-emoji>` and the
Astro component carry their own styles.

## React

Import `Emoji` from the React subpath:

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

Migrating from 0.6 or earlier: the root `Emoji` export was deprecated in 0.6 and
removed in 0.7. Change the import path, nothing else; props and behavior are
identical. The `EmojiProps` type moved to `animated-fluent-emojis/react` too.
`configureEmojis` and `preloadEmojis` stay at `animated-fluent-emojis`. React 18
and 19 are supported, and `react` and `react-dom` are optional peers.

## Vue

Vue 3.3 or later. `Emoji` takes the [props](props.md) in camelCase. The
`fallback` slot replaces the image, and the events are `load`, `error` and
`playbackEnd`. Other attributes such as `class`, `style` and `data-*` go to the
root span.

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

On the server, and while hydrating, it renders an empty placeholder of the final
size, so it works in Nuxt.

## Svelte

Svelte 5. `Emoji` takes the [props](props.md); `fallback` is a snippet, and
`class`, `style` and `attributes` go to the root span. The callbacks are
`onLoad`, `onError` and `onPlaybackEnd`.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

It renders a placeholder on the server and the emoji after hydration, so it
works in SvelteKit. The package export has a `svelte` condition that points at
the component source.

## Astro

Astro 5 or later. The component renders the emoji markup at build time, so the
sprite is in the HTML before any script runs, and a small script starts playback
in the browser. It brings its own styles; there is no stylesheet to import. The
`fallback` named slot is rendered when the id is unknown or the image fails.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

Props are the [shared ones](props.md), minus the callbacks, with `class` and a
string `style`. The root span dispatches `emoji-load`, `emoji-error` and
`playback-end` as bubbling DOM events instead of callbacks. The browser script
also runs again on `astro:page-load`, so view transitions keep working.

## Plain HTML

Importing `animated-fluent-emojis/element` registers `<fluent-emoji>`. It needs
no stylesheet: the keyframes live in its shadow root.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Attributes mirror the props in kebab-case: `id`, `size`, `play-on-hover`,
`animation-iterations`, `auto-play`, `playing`, `skin-tone` and `alt`. A boolean
attribute is on unless its value is `false`. The same names exist as camelCase
properties on the element (`element.playOnHover = true`); setting a property
does not rewrite the attribute. An element with `slot="fallback"` is the
fallback. The element dispatches `emoji-load`, `emoji-error` and `playback-end`
as bubbling, composed events.

Until the element is defined it has no size. Add `FLUENT_EMOJI_PRE_UPGRADE_CSS`,
exported from the same entry, to your page CSS to reserve the footprint from the
`size` attribute (in pixels) and avoid a layout shift.

## Angular, Solid and Preact

These use `<fluent-emoji>` through their own template syntax; see the how-to
guides for [Angular](../how-to/use-with-angular.md),
[Solid](../how-to/use-with-solid.md) and [Preact](../how-to/use-with-preact.md).
The same applies to Lit, Alpine and htmx: import
`animated-fluent-emojis/element` and write the tag.

## Without a framework

`createEmoji` renders into any DOM node and returns a controller. It is the
framework-free core of every adapter. Importing it touches no DOM.

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

Its options are the [props](props.md), with `className`, `style` and
`attributes` for the root span, `onLoad`, `onError` and `onPlaybackEnd`
callbacks, and a `fallback` that is a node, a function returning a node, or
`null`.
