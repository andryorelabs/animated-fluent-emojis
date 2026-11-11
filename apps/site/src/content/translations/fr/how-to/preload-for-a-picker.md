---
title: Précharger pour un sélecteur
sourceHash: 727a2637d064bf30
---

Préchauffez le manifest et les sprite sheets avant l'ouverture d'un sélecteur
d'emojis, afin que les emojis apparaissent sans chargement visible.

## Préchauffer le manifest tôt

`preloadEmojis` sans argument commence à récupérer le manifest avant qu'aucun
`Emoji` ne soit rendu. Il ne rejette jamais, donc `void` suffit :

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

Appelez-le lorsque l'utilisateur est susceptible d'ouvrir le sélecteur, par
exemple au survol ou au focus du bouton déclencheur, ou au montage de la coque
de l'application.

## Préchauffer les sprite sheets que vous afficherez

Passez des ids pour demander leurs sprite sheets dès que le manifest est prêt.
Passez `skinTone` pour préchauffer la variante que l'utilisateur verra, pour les
emojis qui ont des teintes de peau :

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

Ne préchauffez que les ids que vous rendrez en premier. Un sélecteur de
centaines d'emojis ne doit pas tous les précharger ; les sprite sheets se
chargent paresseusement (`loading="lazy"`) à mesure qu'elles approchent du
viewport. `skinTone` vaut `'default'`, `'light'`, `'medium-light'`, `'medium'`,
`'medium-dark'` ou `'dark'`.

## Configurer d'abord l'asset site

Si vous utilisez [un asset site auto-hébergé](self-host-the-assets.md), appelez
`configureEmojis` avant `preloadEmojis`. Changer l'asset site après un
préchargement réinitialise le manifest, et les requêtes préchauffées sont alors
gaspillées.

## Quand le réseau échoue

La requête du manifest abandonne après 15 secondes. Un manifest en échec est
retenté lors du prochain appel à `preloadEmojis`, au prochain montage ou lorsque
le navigateur revient en ligne ; l'appeler à nouveau depuis le déclencheur est
donc sans risque. Voir [préchargement](../guide/assets.md#preloading) et
[fallback](../guide/behavior.md#fallback).
