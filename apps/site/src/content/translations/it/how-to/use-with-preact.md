---
title: Usare con Preact
sourceHash: 690f9a4ab5451009
---

Ci sono due modi per usare le emoji in Preact: l'elemento `<fluent-emoji>`, o
l'adattatore React tramite `preact/compat`.

## L'elemento

Importa l'entry dell'elemento una sola volta. Registra `<fluent-emoji>` e non
richiede nessun foglio di stile:

```tsx
import "animated-fluent-emojis/element";
```

Il pacchetto estende i tipi JSX di `preact` con gli attributi in kebab-case
dell'elemento:

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

Il fallback si inserisce come figlio con `slot="fallback"`. Per reagire a
`emoji-load`, `emoji-error` o `playback-end`, chiama `addEventListener`
sull'elemento da un `ref`:

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

Attributi, proprietà ed eventi sono elencati nella
[guida all'uso](../guide/frameworks.md#plain-html).

## L'adattatore React

Associa `react` e `react-dom` a `preact/compat` nel tuo bundler, poi usa
l'adattatore React come descritto nella
[guida all'uso](../guide/frameworks.md#react).
