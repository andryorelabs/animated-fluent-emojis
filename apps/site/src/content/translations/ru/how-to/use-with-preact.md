---
title: Использование с Preact
sourceHash: 690f9a4ab5451009
---

В Preact эмодзи можно использовать двумя способами: через элемент
`<fluent-emoji>` или через адаптер React и `preact/compat`.

## Элемент

Импортируйте точку входа элемента один раз. Она регистрирует `<fluent-emoji>`, и
таблица стилей не нужна:

```tsx
import "animated-fluent-emojis/element";
```

Пакет дополняет типы JSX из `preact` атрибутами элемента в kebab-case:

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

Fallback передаётся дочерним элементом с `slot="fallback"`. Чтобы реагировать на
`emoji-load`, `emoji-error` или `playback-end`, вызовите `addEventListener` у
элемента через `ref`:

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

Атрибуты, свойства и события перечислены в
[руководстве по использованию](../guide/frameworks.md#plain-html).

## Адаптер React

Настройте в сборщике алиасы `react` и `react-dom` на `preact/compat`, затем
используйте адаптер React, как описано в
[руководстве по использованию](../guide/frameworks.md#react).
