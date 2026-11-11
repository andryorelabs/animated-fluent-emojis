---
title: Usar com Preact
sourceHash: 690f9a4ab5451009
---

Há duas formas de usar emojis no Preact: o elemento `<fluent-emoji>` ou o
adaptador React por meio de `preact/compat`.

## O elemento

Importe o entry do elemento uma vez. Ele registra `<fluent-emoji>` e não precisa
de folha de estilo:

```tsx
import "animated-fluent-emojis/element";
```

O pacote estende os tipos JSX do `preact` com os atributos em kebab-case do
elemento:

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

O fallback entra como filho com `slot="fallback"`. Para reagir a `emoji-load`,
`emoji-error` ou `playback-end`, chame `addEventListener` no elemento a partir
de uma `ref`:

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

Atributos, propriedades e eventos estão listados no
[guia de uso](../guide/frameworks.md#plain-html).

## O adaptador React

Crie um alias de `react` e `react-dom` para `preact/compat` no seu bundler e
depois use o adaptador React conforme documentado no
[guia de uso](../guide/frameworks.md#react).
