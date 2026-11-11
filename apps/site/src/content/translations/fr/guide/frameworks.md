---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

Un seul paquet, un chemin d'import par framework. `configureEmojis` et
`preloadEmojis` ne dépendent d'aucun framework et restent dans
`animated-fluent-emojis` ; voir [Préchargement](assets.md#preloading) et
[Asset site](assets.md#asset-site). Tous les adaptateurs partagent le même noyau
de lecture et passent la même suite de conformité, si bien que les props se
comportent partout de la même façon. Voir l'
[ADR 0014](../adr/0014-multi-framework-support.md).

Les adaptateurs React, Vue et Svelte ainsi que `createEmoji` lisent leurs
keyframes dans `animated-fluent-emojis/style.css` ; importez-le une seule fois.
`<fluent-emoji>` et le composant Astro embarquent leurs propres styles.

## React

Importez `Emoji` depuis le sous-chemin React :

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

Si vous migrez depuis la 0.6 ou une version antérieure : l'export `Emoji` de la
racine a été déprécié dans la 0.6 et supprimé dans la 0.7. Changez le chemin
d'import, rien d'autre ; les props et le comportement sont identiques. Le type
`EmojiProps` a lui aussi été déplacé vers `animated-fluent-emojis/react`.
`configureEmojis` et `preloadEmojis` restent dans `animated-fluent-emojis`.
React 18 et 19 sont pris en charge, et `react` et `react-dom` sont des peers
optionnels.

## Vue

Vue 3.3 ou version ultérieure. `Emoji` reçoit les props ci-dessous en camelCase.
Le slot `fallback` remplace l'image, et les événements sont `load`, `error` et
`playbackEnd`. Les autres attributs comme `class`, `style` et `data-*` sont
transmis au span racine.

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

Côté serveur, et pendant l'hydratation, il rend un espace réservé vide à la
taille finale, ce qui fonctionne donc avec Nuxt.

## Svelte

Svelte 5. `Emoji` reçoit les props ci-dessous ; `fallback` est un snippet, et
`class`, `style` et `attributes` sont transmis au span racine. Les callbacks
sont `onLoad`, `onError` et `onPlaybackEnd`.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

Il rend un espace réservé côté serveur et l'emoji après l'hydratation, ce qui
fonctionne donc avec SvelteKit. L'export du paquet comporte une condition
`svelte` qui pointe vers le code source du composant.

## Astro

Astro 5 ou version ultérieure. Le composant rend le balisage de l'emoji au
moment de la compilation : le sprite est donc déjà dans le HTML avant
l'exécution de tout script, et un petit script démarre la lecture dans le
navigateur. Il embarque ses propres styles ; aucune feuille de style à importer.
Le slot nommé `fallback` est rendu lorsque l'id est inconnu ou que l'image
échoue.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

Les props sont celles ci-dessous, sans les callbacks, avec `class` et un `style`
de type chaîne. Le span racine émet `emoji-load`, `emoji-error` et
`playback-end` sous forme d'événements DOM avec propagation (bubbling), à la
place des callbacks. Le script du navigateur s'exécute aussi de nouveau sur
`astro:page-load`, de sorte que les transitions de vue continuent de
fonctionner.

<a id="plain-html"></a>

## HTML simple

Importer `animated-fluent-emojis/element` enregistre `<fluent-emoji>`. Aucune
feuille de style n'est nécessaire : les keyframes vivent dans son shadow root.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Les attributs reflètent les props en kebab-case : `id`, `size`, `play-on-hover`,
`animation-iterations`, `auto-play`, `playing`, `skin-tone` et `alt`. Un
attribut booléen est actif sauf si sa valeur est `false`. Les mêmes noms
existent comme propriétés camelCase de l'élément (`element.playOnHover = true`)
; affecter une propriété ne réécrit pas l'attribut. Un élément avec
`slot="fallback"` est le fallback. L'élément émet `emoji-load`, `emoji-error` et
`playback-end` sous forme d'événements avec propagation et `composed`.

Tant que l'élément n'est pas défini, il n'a pas de taille. Ajoutez
`FLUENT_EMOJI_PRE_UPGRADE_CSS`, exporté depuis la même entrée, au CSS de votre
page pour réserver l'espace à partir de l'attribut `size` (en pixels) et éviter
un décalage de la mise en page.

<a id="angular-solid-and-preact"></a>

## Angular, Solid et Preact

Ils utilisent `<fluent-emoji>` via leur propre syntaxe de templates ; voir les
guides pratiques pour [Angular](../how-to/use-with-angular.md),
[Solid](../how-to/use-with-solid.md) et [Preact](../how-to/use-with-preact.md).
Il en va de même pour Lit, Alpine et htmx : importez
`animated-fluent-emojis/element` et écrivez la balise.

<a id="without-a-framework"></a>

## Sans framework

`createEmoji` effectue le rendu dans n'importe quel nœud du DOM et renvoie un
contrôleur. C'est le noyau sans framework de chaque adaptateur. L'importer ne
touche pas au DOM.

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

Ses options sont les props ci-dessous, avec `className`, `style` et `attributes`
pour le span racine, les callbacks `onLoad`, `onError` et `onPlaybackEnd`, et un
`fallback` qui est un nœud, une fonction qui renvoie un nœud, ou `null`.
