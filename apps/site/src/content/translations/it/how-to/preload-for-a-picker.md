---
title: Precaricare per un picker
sourceHash: 727a2637d064bf30
---

Scalda il manifest e gli sprite sheet prima che si apra un picker di emoji, così
le emoji compaiono senza un caricamento visibile.

## Scalda il manifest in anticipo

`preloadEmojis` senza argomenti avvia il recupero del manifest prima che venga
renderizzato qualsiasi `Emoji`. Non viene mai rifiutata, quindi `void` basta:

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

Chiamala quando è probabile che l'utente apra il picker, per esempio al
passaggio del mouse o al focus sul pulsante che lo apre, oppure quando monta la
shell dell'app.

## Scalda gli sprite sheet che mostrerai

Passa degli id per richiedere i relativi sprite sheet non appena il manifest è
pronto. Passa `skinTone` per scaldare la variante che l'utente vedrà, per le
emoji che hanno tonalità della pelle:

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

Scalda solo gli id che renderizzerai per primi. Un picker con centinaia di emoji
non dovrebbe precaricarle tutte; gli sprite sheet vengono caricati in modo lazy
(`loading="lazy"`) man mano che si avvicinano al viewport. `skinTone` è uno tra
`'default'`, `'light'`, `'medium-light'`, `'medium'`, `'medium-dark'` o
`'dark'`.

## Configura prima l'asset site

Se usi [un asset site in self-hosting](self-host-the-assets.md), chiama
`configureEmojis` prima di `preloadEmojis`. Cambiare l'asset site dopo un
precaricamento reimposta il manifest, quindi le richieste già scaldate vanno
sprecate.

## Quando la rete fallisce

La richiesta del manifest si arrende dopo 15 secondi. Un manifest fallito viene
ritentato alla successiva chiamata a `preloadEmojis`, al mount successivo o
quando il browser torna online, quindi richiamarla dal pulsante è sicuro. Vedi
[precaricamento](../guide/assets.md#preloading) e
[fallback](../guide/behavior.md#fallback).
