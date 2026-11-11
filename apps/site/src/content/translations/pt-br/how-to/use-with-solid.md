---
title: Usar com Solid
sourceHash: 7d4f24852e28d756
---

Renderize emojis no Solid por meio do elemento `<fluent-emoji>`. Não existe um
adaptador nativo para Solid.

## Registre o elemento

Importe o entry do elemento uma vez, por exemplo no módulo de entrada da sua
aplicação. Ele registra `<fluent-emoji>` e não precisa de folha de estilo:

```tsx
import "animated-fluent-emojis/element";
```

## Use a tag

O pacote estende os tipos JSX do `solid-js` com os atributos em kebab-case do
elemento. Use `on:` para escutar os eventos dele, que o Solid anexa diretamente
ao elemento:

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

O fallback entra como filho com `slot="fallback"`, e `ref` dá acesso ao
elemento:

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

Atributos, propriedades e eventos estão listados no
[guia de uso](../guide/frameworks.md#plain-html).
