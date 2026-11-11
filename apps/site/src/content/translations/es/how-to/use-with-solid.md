---
title: Usa con Solid
sourceHash: 7d4f24852e28d756
---

Renderiza emojis en Solid mediante el elemento `<fluent-emoji>`. No hay un
adaptador nativo de Solid.

## Registra el elemento

Importa la entrada del elemento una sola vez, por ejemplo en el módulo de
entrada. Registra `<fluent-emoji>` y no necesita hoja de estilos:

```tsx
import "animated-fluent-emojis/element";
```

## Usa la etiqueta

El paquete amplía los tipos JSX de `solid-js` con los atributos en kebab-case
del elemento. Usa `on:` para escuchar sus eventos, que Solid asocia directamente
al elemento:

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

El fallback se pasa como hijo con `slot="fallback"`, y `ref` te da el elemento:

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

Los atributos, propiedades y eventos están listados en la
[guía de uso](../guide/frameworks.md#plain-html).
