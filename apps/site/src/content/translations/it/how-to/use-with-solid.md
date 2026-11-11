---
title: Usare con Solid
sourceHash: 7d4f24852e28d756
---

Mostra le emoji in Solid tramite l'elemento `<fluent-emoji>`. Non esiste un
adattatore Solid nativo.

## Registra l'elemento

Importa l'entry dell'elemento una sola volta, per esempio nel modulo di ingresso
della tua app. Registra `<fluent-emoji>` e non richiede nessun foglio di stile:

```tsx
import "animated-fluent-emojis/element";
```

## Usa il tag

Il pacchetto estende i tipi JSX di `solid-js` con gli attributi in kebab-case
dell'elemento. Usa `on:` per ascoltarne gli eventi, che Solid collega
direttamente all'elemento:

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

Il fallback si inserisce come figlio con `slot="fallback"`, e `ref` ti dà
l'elemento:

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

Attributi, proprietà ed eventi sono elencati nella
[guida all'uso](../guide/frameworks.md#plain-html).
