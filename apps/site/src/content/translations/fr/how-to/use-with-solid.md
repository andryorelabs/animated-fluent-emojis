---
title: Utiliser avec Solid
sourceHash: 7d4f24852e28d756
---

Affichez des emojis dans Solid grâce à l'élément `<fluent-emoji>`. Il n'existe
pas d'adaptateur Solid natif.

## Enregistrer l'élément

Importez l'entrée de l'élément une seule fois, par exemple dans votre module
d'entrée. Elle enregistre `<fluent-emoji>` et n'a besoin d'aucune feuille de
style :

```tsx
import "animated-fluent-emojis/element";
```

## Utiliser la balise

Le paquet étend les types JSX de `solid-js` avec les attributs en kebab-case de
l'élément. Utilisez `on:` pour écouter ses événements : Solid les attache
directement à l'élément :

```tsx
export function Greeting() {
  return (
    <fluent-emoji
      id="1f44b_wavinghand"
      size={64}
      play-on-hover
      on:playback-end={() => {
        console.log("done");
      }}
    />
  );
}
```

Le fallback se transmet comme enfant avec `slot="fallback"`, et `ref` vous donne
l'élément :

```tsx
<fluent-emoji
  id="1f44b_wavinghand"
  ref={(element) => {
    element.playing = false;
  }}
>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Les attributs, propriétés et événements sont listés dans le
[guide d'utilisation](../guide/frameworks.md#plain-html).
