---
title: Utiliser avec Angular
sourceHash: 45537066a981f484
---

Affichez des emojis dans Angular grâce à l'élément `<fluent-emoji>`. Il n'existe
pas d'adaptateur Angular natif ; l'élément fonctionne avec toute version
d'Angular qui prend en charge les éléments personnalisés.

## Enregistrer l'élément

Importez l'entrée de l'élément une seule fois, par exemple dans `main.ts`. Son
import enregistre `<fluent-emoji>`. L'élément embarque ses propres styles dans
un shadow root, il n'y a donc aucune feuille de style à importer :

```ts
import "animated-fluent-emojis/element";
```

## Autoriser la balise dans vos composants

Angular rejette les balises inconnues, sauf si le composant autorise les
éléments personnalisés :

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

## Lier des propriétés et écouter des événements

Utilisez des liaisons de propriété pour les valeurs dynamiques, afin qu'Angular
définisse les propriétés de l'élément au lieu de réécrire les attributs. Les
événements sont `emoji-load`, `emoji-error` et `playback-end` :

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Les attributs, propriétés et événements sont listés dans le
[guide d'utilisation](../guide/frameworks.md#plain-html). Pour réserver l'espace
occupé avant la mise à niveau de l'élément, ajoutez
`FLUENT_EMOJI_PRE_UPGRADE_CSS` à votre CSS global. Pour le comportement du
chargement, du fallback et de la lecture, consultez le reste du
[guide d'utilisation](../usage.md).
