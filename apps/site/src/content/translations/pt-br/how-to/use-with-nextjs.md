---
title: Usar com Next.js
sourceHash: 6f92dff657703a74
---

Renderize `Emoji` no App Router, inclusive a partir de Server Components.

## Importe a folha de estilo uma vez

A folha de estilo traz os keyframes da animação. Sem ela, os emojis são
renderizados como sprite sheets estáticos. Importe-a uma vez, no layout raiz:

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

## Use Emoji em um Server Component

O bundle começa com `"use client";`, então um Server Component pode importar
`Emoji` diretamente, sem um arquivo intermediário:

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

No servidor, `Emoji` renderiza um placeholder vazio do tamanho final, para que o
layout não se desloque. O emoji aparece após a hidratação, porque o manifest é
buscado no navegador na primeira renderização, nunca na importação. Funções como
`onLoad` ou `onPlaybackEnd` não podem ser passadas a partir de um Server
Component; nesse caso, renderize o emoji a partir de um módulo cliente.

## Configure e pré-carregue a partir de um módulo cliente

`configureEmojis` e `preloadEmojis` rodam no navegador, então chame-as a partir
de um módulo que comece com `"use client"`, não de um Server Component. Um
pequeno componente montado no layout raiz é suficiente:

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

Renderize `<EmojiSetup />` no layout, acima do conteúdo. Remova a linha
`configureEmojis` para manter o asset site padrão. Chame-a antes de o primeiro
`Emoji` ser renderizado; veja
[hospede os assets por conta própria](self-host-the-assets.md) para a Content
Security Policy que acompanha uma origem personalizada, e
[pré-carregue para um seletor](preload-for-a-picker.md) para pré-carregar ids
específicos.

## Lookup

`animated-fluent-emojis/lookup` não tem React nem o banner `"use client"`, então
também funciona em Server Components e route handlers. Veja
[lookup](../guide/lookup.md).
