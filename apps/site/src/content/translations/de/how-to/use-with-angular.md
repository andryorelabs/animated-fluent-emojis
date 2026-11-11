---
title: Mit Angular verwenden
sourceHash: 45537066a981f484
---

Binde Emojis in Angular über das Element `<fluent-emoji>` ein. Es gibt keinen
nativen Angular-Adapter; das Element funktioniert in jeder Angular-Version, die
Custom Elements unterstützt.

## Das Element registrieren

Importiere den Element-Einstiegspunkt einmalig, zum Beispiel in `main.ts`. Der
Import registriert `<fluent-emoji>`. Das Element bringt seine Styles in einem
Shadow Root mit, du musst also kein Stylesheet importieren:

```ts
import "animated-fluent-emojis/element";
```

## Den Tag in deinen Komponenten erlauben

Angular lehnt unbekannte Tags ab, solange die Komponente keine Custom Elements
erlaubt:

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

## Properties binden und Events abonnieren

Verwende Property-Bindings für dynamische Werte, damit Angular die Properties
des Elements setzt, statt Attribute neu zu schreiben. Die Events sind
`emoji-load`, `emoji-error` und `playback-end`:

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Attribute, Properties und Events sind im
[Nutzungsleitfaden](../guide/frameworks.md#plain-html) aufgeführt. Um den
Platzbedarf zu reservieren, bevor das Element aktualisiert wird, füge
`FLUENT_EMOJI_PRE_UPGRADE_CSS` zu deinem globalen CSS hinzu. Zum Verhalten beim
Laden, zum Fallback und zur Wiedergabe siehe den Rest des
[Nutzungsleitfadens](../usage.md).
