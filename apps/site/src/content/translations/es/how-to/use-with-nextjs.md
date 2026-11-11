---
title: Usa con Next.js
sourceHash: 6f92dff657703a74
---

Renderiza `Emoji` en el App Router, también desde Server Components.

## Importa la hoja de estilos una sola vez

La hoja de estilos contiene los keyframes de la animación. Sin ella, los emojis
se renderizan como sprite sheets estáticos. Impórtala una sola vez, en el layout
raíz:

```jsx
import "animated-fluent-emojis/style.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Usa Emoji en un Server Component

El bundle empieza con `"use client";`, así que un Server Component puede
importar `Emoji` directamente, sin un archivo envoltorio:

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

En el servidor, `Emoji` renderiza un marcador vacío del tamaño final, así que el
layout no se desplaza. El emoji aparece tras la hidratación, porque el manifest
se obtiene en el navegador en el primer render, nunca al importar. Funciones
como `onLoad` u `onPlaybackEnd` no se pueden pasar desde un Server Component; en
ese caso, renderiza el emoji desde un módulo de cliente.

## Configura y precarga desde un módulo de cliente

`configureEmojis` y `preloadEmojis` se ejecutan en el navegador, así que
llámalas desde un módulo que empiece con `"use client"`, no desde un Server
Component. Basta con un componente pequeño montado en el layout raíz:

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

Renderiza `<EmojiSetup />` en el layout, por encima del contenido. Quita la
línea de `configureEmojis` para conservar el sitio de assets predeterminado.
Llámala antes de que se renderice el primer `Emoji`; consulta
[autoaloja los assets](self-host-the-assets.md) para la Content Security Policy
que acompaña a un origen personalizado, y
[precarga para un selector](preload-for-a-picker.md) para precargar ids
específicos.

## Lookup

`animated-fluent-emojis/lookup` no tiene React ni el banner `"use client"`, así
que también funciona en Server Components y en route handlers. Consulta
[lookup](../guide/lookup.md).
