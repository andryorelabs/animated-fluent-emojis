---
title: Utiliser avec Preact
sourceHash: 690f9a4ab5451009
---

Il y a deux façons d'utiliser des emojis dans Preact : l'élément
`<fluent-emoji>`, ou l'adaptateur React via `preact/compat`.

## L'élément

Importez l'entrée de l'élément une seule fois. Elle enregistre `<fluent-emoji>`
et n'a besoin d'aucune feuille de style :

```tsx
import "animated-fluent-emojis/element";
```

Le paquet étend les types JSX de `preact` avec les attributs en kebab-case de
l'élément :

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

Le fallback se transmet comme enfant avec `slot="fallback"`. Pour réagir à
`emoji-load`, `emoji-error` ou `playback-end`, appelez `addEventListener` sur
l'élément depuis un `ref` :

```tsx
import { useEffect, useRef } from "preact/hooks";

export function Greeting() {
  const emoji = useRef<HTMLElementTagNameMap["fluent-emoji"]>(null);

  useEffect(() => {
    const element = emoji.current;
    const onEnd = () => {
      console.log("done");
    };
    element?.addEventListener("playback-end", onEnd);
    return () => element?.removeEventListener("playback-end", onEnd);
  }, []);

  return (
    <fluent-emoji id="1f44b_wavinghand" ref={emoji}>
      <span slot="fallback">👋</span>
    </fluent-emoji>
  );
}
```

Les attributs, propriétés et événements sont listés dans le
[guide d'utilisation](../guide/frameworks.md#plain-html).

## L'adaptateur React

Faites de `react` et `react-dom` des alias de `preact/compat` dans votre
bundler, puis utilisez l'adaptateur React comme documenté dans le
[guide d'utilisation](../guide/frameworks.md#react).
