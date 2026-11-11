---
title: Assets
sourceHash: 375cf7e40f14709c
---

<a id="images-and-hd-sprite-sheets"></a>

## Images et sprite sheets HD

Les sprite sheets sont chargés avec `loading="lazy"` et `decoding="async"`. Les
emojis qui disposent d'un sprite sheet HD (images de 200px) reçoivent en outre
un `srcSet` basé sur la largeur (`100w` et `200w`) avec `sizes` égal à la taille
rendue (`auto` pour un `size` de type chaîne), de sorte que le navigateur
choisit le sheet `@2x` sur les écrans haute densité.

<a id="preloading"></a>

## Préchargement

`preloadEmojis` commence à récupérer le manifest avant qu'aucun `Emoji` ne soit
rendu et, lorsqu'on lui donne des ids, demande leurs sprite sheets une fois
qu'il est prêt. Il ne rejette jamais :

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` choisit la variante préchauffée pour les emojis qui ont des teintes
de peau.

## Asset site

Par défaut, le manifest et les sprite sheets proviennent de
`https://animated-fluent-emojis-cdn.andryore.dev`. L'ancienne adresse,
`https://animated-fluent-emojis.pages.dev`, continue de fonctionner. Pour les
servir depuis votre propre copie, appelez `configureEmojis` une fois, avant le
rendu du premier `Emoji` :

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
