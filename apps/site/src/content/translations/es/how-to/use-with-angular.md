---
title: Usa con Angular
sourceHash: 45537066a981f484
---

Renderiza emojis en Angular mediante el elemento `<fluent-emoji>`. No hay un
adaptador nativo de Angular; el elemento funciona en cualquier versión de
Angular que admita elementos personalizados.

## Registra el elemento

Importa la entrada del elemento una sola vez, por ejemplo en `main.ts`. Al
importarla se registra `<fluent-emoji>`. El elemento lleva sus propios estilos
en un shadow root, así que no hay ninguna hoja de estilos que importar:

```ts
import "animated-fluent-emojis/element";
```

## Permite la etiqueta en tus componentes

Angular rechaza las etiquetas desconocidas a menos que el componente permita
elementos personalizados:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-greeting",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover />`,
})
export class GreetingComponent {}
```

## Enlaza propiedades y escucha eventos

Usa enlaces de propiedad para los valores dinámicos, de modo que Angular asigne
las propiedades del elemento en lugar de reescribir atributos. Los eventos son
`emoji-load`, `emoji-error` y `playback-end`:

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Los atributos, propiedades y eventos están listados en la
[guía de uso](../guide/frameworks.md#plain-html). Para reservar el espacio antes
de que el elemento se actualice, agrega `FLUENT_EMOJI_PRE_UPGRADE_CSS` a tu CSS
global. Para el comportamiento de carga, fallback y reproducción, consulta el
resto de la [guía de uso](../usage.md).
