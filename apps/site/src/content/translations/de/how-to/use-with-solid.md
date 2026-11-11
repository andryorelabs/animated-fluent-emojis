---
title: Mit Solid verwenden
sourceHash: 7d4f24852e28d756
---

Binde Emojis in Solid über das Element `<fluent-emoji>` ein. Es gibt keinen
nativen Solid-Adapter.

## Das Element registrieren

Importiere den Element-Einstiegspunkt einmalig, zum Beispiel in deinem
Einstiegsmodul. Er registriert `<fluent-emoji>` und braucht kein Stylesheet:

```tsx
import "animated-fluent-emojis/element";
```

## Den Tag verwenden

Das Paket erweitert die `solid-js`-JSX-Typen um die Kebab-Case-Attribute des
Elements. Verwende `on:`, um dessen Events zu abonnieren; Solid hängt sie direkt
am Element an:

```tsx
export function Greeting() {
  return (
    <fluent-emoji
      id="1f44b_wavinghand"
      size={64}
      play-on-hover
      on:playback-end={() => {
        console.log("done");
      }}
    />
  );
}
```

Der Fallback kommt als Kind mit `slot="fallback"` hinein, und `ref` gibt dir das
Element:

```tsx
<fluent-emoji
  id="1f44b_wavinghand"
  ref={(element) => {
    element.playing = false;
  }}
>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Attribute, Properties und Events sind im
[Nutzungsleitfaden](../guide/frameworks.md#plain-html) aufgeführt.
