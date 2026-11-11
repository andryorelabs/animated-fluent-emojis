---
title: Usare con Angular
sourceHash: 45537066a981f484
---

Mostra le emoji in Angular tramite l'elemento `<fluent-emoji>`. Non esiste un
adattatore Angular nativo; l'elemento funziona in qualsiasi versione di Angular
che supporti i custom element.

## Registra l'elemento

Importa l'entry dell'elemento una sola volta, per esempio in `main.ts`. L'import
registra `<fluent-emoji>`. L'elemento porta con sé i propri stili in uno shadow
root, quindi non c'è nessun foglio di stile da importare:

```ts
import "animated-fluent-emojis/element";
```

## Consenti il tag nei tuoi componenti

Angular rifiuta i tag sconosciuti, a meno che il componente non consenta i
custom element:

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

## Collega le proprietà e ascolta gli eventi

Usa il binding delle proprietà per i valori dinamici, così Angular imposta le
proprietà dell'elemento invece di riscrivere gli attributi. Gli eventi sono
`emoji-load`, `emoji-error` e `playback-end`:

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Attributi, proprietà ed eventi sono elencati nella
[guida all'uso](../guide/frameworks.md#plain-html). Per riservare lo spazio
prima che l'elemento venga aggiornato, aggiungi `FLUENT_EMOJI_PRE_UPGRADE_CSS`
al tuo CSS globale. Per il comportamento di caricamento, fallback e riproduzione
consulta il resto della [guida all'uso](../usage.md).
