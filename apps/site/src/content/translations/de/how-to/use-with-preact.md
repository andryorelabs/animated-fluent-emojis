---
title: Mit Preact verwenden
sourceHash: 690f9a4ab5451009
---

Es gibt zwei Wege, Emojis in Preact zu verwenden: das Element `<fluent-emoji>`
oder den React-Adapter über `preact/compat`.

## Das Element

Importiere den Element-Einstiegspunkt einmalig. Er registriert `<fluent-emoji>`
und braucht kein Stylesheet:

```tsx
import "animated-fluent-emojis/element";
```

Das Paket erweitert die `preact`-JSX-Typen um die Kebab-Case-Attribute des
Elements:

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

Der Fallback kommt als Kind mit `slot="fallback"` hinein. Um auf `emoji-load`,
`emoji-error` oder `playback-end` zu reagieren, rufe `addEventListener` über ein
`ref` am Element auf:

```tsx
import { useEffect, useRef } from "preact/hooks";

export function Greeting() {
  const emoji = useRef<HTMLElementTagNameMap["fluent-emoji"]>(null);

  useEffect(() => {
    const element = emoji.current;
    const onEnd = () => {
      console.log("done");
    };
    element?.addEventListener("playback-end", onEnd);
    return () => element?.removeEventListener("playback-end", onEnd);
  }, []);

  return (
    <fluent-emoji id="1f44b_wavinghand" ref={emoji}>
      <span slot="fallback">👋</span>
    </fluent-emoji>
  );
}
```

Attribute, Properties und Events sind im
[Nutzungsleitfaden](../guide/frameworks.md#plain-html) aufgeführt.

## Der React-Adapter

Lege in deinem Bundler `react` und `react-dom` als Alias auf `preact/compat`
fest und verwende dann den React-Adapter wie im
[Nutzungsleitfaden](../guide/frameworks.md#react) beschrieben.
