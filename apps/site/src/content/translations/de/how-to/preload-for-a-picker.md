---
title: Für einen Picker vorladen
sourceHash: 727a2637d064bf30
---

Wärme das Manifest und die Sprite Sheets auf, bevor sich ein Emoji-Picker
öffnet, damit die Emojis ohne sichtbaren Ladevorgang erscheinen.

## Das Manifest frühzeitig aufwärmen

`preloadEmojis` ohne Argumente beginnt, das Manifest zu laden, bevor ein `Emoji`
gerendert wird. Es wird nie abgelehnt, daher genügt `void`:

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

Rufe es auf, wenn die Person den Picker wahrscheinlich öffnet, zum Beispiel beim
Hover oder Fokus auf den Auslöser-Button, oder wenn die App-Shell gemountet
wird.

## Die Sprite Sheets aufwärmen, die du zeigen wirst

Übergib IDs, um ihre Sprite Sheets anzufordern, sobald das Manifest bereit ist.
Übergib `skinTone`, um bei Emojis mit Hautfarben die Variante aufzuwärmen, die
die Person sehen wird:

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

Wärme nur die IDs auf, die du zuerst rendern wirst. Ein Picker mit Hunderten von
Emojis sollte nicht alle vorladen; Sprite Sheets werden lazy (`loading="lazy"`)
geladen, wenn sie sich dem Viewport nähern. `skinTone` ist eines von
`'default'`, `'light'`, `'medium-light'`, `'medium'`, `'medium-dark'` oder
`'dark'`.

## Zuerst die Asset Site konfigurieren

Wenn du [eine selbst gehostete Asset Site](self-host-the-assets.md) verwendest,
rufe `configureEmojis` vor `preloadEmojis` auf. Eine Änderung der Asset Site
nach einem Preload setzt das Manifest zurück, die aufgewärmten Anfragen sind
dann vergeudet.

## Wenn das Netzwerk ausfällt

Die Manifest-Anfrage gibt nach 15 Sekunden auf. Ein fehlgeschlagenes Manifest
wird beim nächsten Aufruf von `preloadEmojis`, beim nächsten Mount oder beim
Wiederverbinden des Browsers erneut versucht, ein erneuter Aufruf vom Auslöser
aus ist also unbedenklich. Siehe [Preloading](../guide/assets.md#preloading) und
[Fallback](../guide/behavior.md#fallback).
