---
title: Использование с Angular
sourceHash: 45537066a981f484
---

В Angular эмодзи рендерятся через элемент `<fluent-emoji>`. Нативного адаптера
для Angular нет; элемент работает в любой версии Angular, которая поддерживает
custom elements.

## Зарегистрируйте элемент

Импортируйте точку входа элемента один раз, например в `main.ts`. Импорт
регистрирует `<fluent-emoji>`. Элемент хранит собственные стили в shadow root,
поэтому импортировать таблицу стилей не нужно:

```ts
import "animated-fluent-emojis/element";
```

## Разрешите тег в компонентах

Angular отклоняет неизвестные теги, если компонент не разрешает custom elements:

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

## Привяжите свойства и слушайте события

Для динамических значений используйте привязку свойств: тогда Angular
устанавливает свойства элемента, а не переписывает атрибуты. События:
`emoji-load`, `emoji-error` и `playback-end`.

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Атрибуты, свойства и события перечислены в
[руководстве по использованию](../guide/frameworks.md#plain-html). Чтобы
зарезервировать место до обновления элемента, добавьте
`FLUENT_EMOJI_PRE_UPGRADE_CSS` в глобальный CSS. О загрузке, fallback и
воспроизведении читайте в остальной части
[руководства по использованию](../usage.md).
