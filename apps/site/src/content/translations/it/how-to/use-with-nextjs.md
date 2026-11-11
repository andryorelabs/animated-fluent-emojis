---
title: Usare con Next.js
sourceHash: 6f92dff657703a74
---

Mostra `Emoji` nell'App Router, anche dai Server Component.

## Importa il foglio di stile una sola volta

Il foglio di stile contiene i keyframe dell'animazione. Senza di esso le emoji
vengono mostrate come sprite sheet statici. Importalo una sola volta, nel layout
radice:

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

## Usa Emoji in un Server Component

Il bundle inizia con `"use client";`, quindi un Server Component può importare
`Emoji` direttamente, senza un file wrapper:

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

Sul server, `Emoji` mostra un segnaposto vuoto della dimensione finale, così il
layout non si sposta. L'emoji compare dopo l'idratazione, perché il manifest
viene recuperato nel browser al primo render, mai all'import. Funzioni come
`onLoad` o `onPlaybackEnd` non possono essere passate da un Server Component; in
quel caso mostra l'emoji da un modulo client.

## Configura e precarica da un modulo client

`configureEmojis` e `preloadEmojis` vengono eseguite nel browser, quindi
chiamale da un modulo che inizia con `"use client"`, non da un Server Component.
Basta un piccolo componente montato nel layout radice:

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

Mostra `<EmojiSetup />` nel layout, sopra il contenuto. Elimina la riga
`configureEmojis` per mantenere l'asset site predefinito. Chiamala prima che
venga mostrato il primo `Emoji`; vedi
[ospitare gli asset](self-host-the-assets.md) per la Content Security Policy che
accompagna un'origine personalizzata, e
[precaricare per un selettore](preload-for-a-picker.md) per precaricare id
specifici.

## Lookup

`animated-fluent-emojis/lookup` non usa React né il banner `"use client"`,
quindi funziona anche nei Server Component e nei route handler. Vedi
[lookup](../guide/lookup.md).
