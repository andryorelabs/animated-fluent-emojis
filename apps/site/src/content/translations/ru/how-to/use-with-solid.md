---
title: Использование с Solid
sourceHash: 7d4f24852e28d756
---

В Solid эмодзи рендерятся через элемент `<fluent-emoji>`. Нативного адаптера для
Solid нет.

## Зарегистрируйте элемент

Импортируйте точку входа элемента один раз, например в модуле входа. Она
регистрирует `<fluent-emoji>`, и таблица стилей не нужна:

```tsx
import "animated-fluent-emojis/element";
```

## Используйте тег

Пакет дополняет типы JSX из `solid-js` атрибутами элемента в kebab-case. Для
событий используйте `on:`: Solid подключает их непосредственно к элементу:

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

Fallback передаётся дочерним элементом с `slot="fallback"`, а `ref` даёт доступ
к элементу:

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

Атрибуты, свойства и события перечислены в
[руководстве по использованию](../guide/frameworks.md#plain-html).
