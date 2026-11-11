---
title: Usa con Preact
sourceHash: 690f9a4ab5451009
---

Hay dos formas de usar emojis en Preact: el elemento `<fluent-emoji>`, o el
adaptador de React mediante `preact/compat`.

## El elemento

Importa la entrada del elemento una sola vez. Registra `<fluent-emoji>` y no
necesita hoja de estilos:

```tsx
import "animated-fluent-emojis/element";
```

El paquete amplía los tipos JSX de `preact` con los atributos en kebab-case del
elemento:

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

El fallback se pasa como hijo con `slot="fallback"`. Para reaccionar a
`emoji-load`, `emoji-error` o `playback-end`, llama a `addEventListener` en el
elemento desde un `ref`:

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

Los atributos, propiedades y eventos están listados en la
[guía de uso](../guide/frameworks.md#plain-html).

## El adaptador de React

Define `react` y `react-dom` como alias de `preact/compat` en tu bundler y luego
usa el adaptador de React como se documenta en la
[guía de uso](../guide/frameworks.md#react).
