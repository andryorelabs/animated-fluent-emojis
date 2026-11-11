---
title: Mit Next.js verwenden
sourceHash: 6f92dff657703a74
---

Binde `Emoji` im App Router ein, auch aus Server Components.

## Das Stylesheet einmal importieren

Das Stylesheet enthält die Animations-Keyframes. Ohne es werden Emojis als
statische Sprite Sheets dargestellt. Importiere es einmal, im Root-Layout:

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

## Emoji in einer Server Component verwenden

Das Bundle beginnt mit `"use client";`, daher kann eine Server Component `Emoji`
direkt importieren, ohne Wrapper-Datei:

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

Auf dem Server rendert `Emoji` einen leeren Platzhalter in der endgültigen
Größe, sodass sich das Layout nicht verschiebt. Das Emoji erscheint nach der
Hydration, denn das Manifest wird beim ersten Rendern im Browser geladen, nie
beim Import. Funktionen wie `onLoad` oder `onPlaybackEnd` können nicht aus einer
Server Component übergeben werden; rendere das Emoji in diesem Fall aus einem
Client-Modul.

## Aus einem Client-Modul konfigurieren und vorladen

`configureEmojis` und `preloadEmojis` laufen im Browser, rufe sie also aus einem
Modul auf, das mit `"use client"` beginnt, nicht aus einer Server Component.
Eine kleine Komponente, die im Root-Layout eingebunden wird, genügt:

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

Rendere `<EmojiSetup />` im Layout oberhalb des Inhalts. Lass die Zeile
`configureEmojis` weg, um die Standard-Asset-Site zu behalten. Rufe sie auf,
bevor das erste `Emoji` gerendert wird; siehe
[Die Assets selbst hosten](self-host-the-assets.md) für die Content Security
Policy, die zu einem eigenen Origin gehört, und
[Für einen Picker vorladen](preload-for-a-picker.md) zum Vorladen bestimmter
IDs.

## Lookup

`animated-fluent-emojis/lookup` enthält weder React noch ein
`"use client"`-Banner und funktioniert daher auch in Server Components und Route
Handlern. Siehe [Lookup](../guide/lookup.md).
