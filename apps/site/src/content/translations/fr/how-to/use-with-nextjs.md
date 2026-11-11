---
title: Utiliser avec Next.js
sourceHash: 6f92dff657703a74
---

Affichez `Emoji` dans l'App Router, y compris depuis des Server Components.

## Importer la feuille de style une seule fois

La feuille de style contient les keyframes d'animation. Sans elle, les emojis
s'affichent comme des sprite sheets statiques. Importez-la une seule fois, dans
le layout racine :

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

## Utiliser Emoji dans un Server Component

Le bundle commence par `"use client";`, un Server Component peut donc importer
`Emoji` directement, sans fichier intermédiaire :

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

Côté serveur, `Emoji` rend un espace réservé vide à sa taille finale, ce qui
évite tout décalage de la mise en page. L'emoji apparaît après l'hydratation,
car le manifest est récupéré dans le navigateur au premier rendu, jamais à
l'import. Les fonctions comme `onLoad` ou `onPlaybackEnd` ne peuvent pas être
transmises depuis un Server Component ; rendez alors l'emoji depuis un module
client.

## Configurer et précharger depuis un module client

`configureEmojis` et `preloadEmojis` s'exécutent dans le navigateur :
appelez-les depuis un module qui commence par `"use client"`, pas depuis un
Server Component. Un petit composant monté dans le layout racine suffit :

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

Rendez `<EmojiSetup />` dans le layout, au-dessus du contenu. Supprimez la ligne
`configureEmojis` pour conserver l'asset site par défaut. Appelez-la avant le
premier rendu de `Emoji` ; consultez
[héberger les assets soi-même](self-host-the-assets.md) pour la Content Security
Policy associée à une origine personnalisée, et
[précharger pour un sélecteur](preload-for-a-picker.md) pour précharger des ids
précis.

## Lookup

`animated-fluent-emojis/lookup` n'embarque ni React ni bannière `"use client"` ;
il fonctionne donc aussi dans les Server Components et les route handlers.
Consultez [lookup](../guide/lookup.md).
