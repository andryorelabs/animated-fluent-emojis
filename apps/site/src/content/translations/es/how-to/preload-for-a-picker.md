---
title: Precargar para un selector
sourceHash: 727a2637d064bf30
---

Calienta el manifest y los sprite sheets antes de que se abra un selector de
emojis, para que los emojis aparezcan sin una carga visible.

## Calienta el manifest con anticipación

`preloadEmojis` sin argumentos empieza a solicitar el manifest antes de que se
renderice cualquier `Emoji`. Nunca se rechaza, así que basta con `void`:

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

Llámalo cuando sea probable que el usuario abra el selector, por ejemplo al
pasar el cursor o al enfocar el botón que lo activa, o cuando se monta el shell
de la app.

## Calienta los sprite sheets que vas a mostrar

Pasa ids para solicitar sus sprite sheets cuando el manifest esté listo. Pasa
`skinTone` para calentar la variante que verá el usuario, en los emojis que
tienen tonos de piel:

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

Calienta solo los ids que vas a renderizar primero. Un selector con cientos de
emojis no debería precargarlos todos; los sprite sheets se cargan de forma
diferida (`loading="lazy"`) a medida que se acercan al viewport. `skinTone` es
uno de `'default'`, `'light'`, `'medium-light'`, `'medium'`, `'medium-dark'` o
`'dark'`.

## Configura primero el asset site

Si usas [un asset site propio](self-host-the-assets.md), llama a
`configureEmojis` antes que a `preloadEmojis`. Cambiar el asset site después de
una precarga reinicia el manifest, y las solicitudes calentadas se desperdician.

## Cuando falla la red

La solicitud del manifest se rinde tras 15 segundos. Un manifest fallido se
reintenta en la siguiente llamada a `preloadEmojis`, en el siguiente montaje o
cuando el navegador vuelve a estar en línea, así que es seguro volver a llamarlo
desde el botón. Consulta [precarga](../guide/assets.md#preloading) y
[fallback](../guide/behavior.md#fallback).
