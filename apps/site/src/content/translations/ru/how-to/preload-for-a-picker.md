---
title: Предзагрузка для пикера
sourceHash: 727a2637d064bf30
---

Прогрейте manifest и sprite sheets до открытия пикера эмодзи, чтобы эмодзи
появлялись без заметной загрузки.

## Прогрейте manifest заранее

`preloadEmojis` без аргументов начинает загрузку manifest ещё до рендера любого
`Emoji`. Он никогда не отклоняется, поэтому достаточно `void`:

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

Вызывайте его, когда пользователь, вероятно, откроет пикер: например, при
наведении или фокусе на кнопку-триггер либо при монтировании оболочки
приложения.

## Прогрейте sprite sheets, которые вы покажете

Передайте id, чтобы запросить их sprite sheets, когда manifest готов. Для эмодзи
с оттенками кожи передайте `skinTone`, чтобы прогреть вариант, который увидит
пользователь:

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

Прогревайте только те id, которые отрисуете первыми. Пикер с сотнями эмодзи не
должен предзагружать их все; sprite sheets загружаются лениво (`loading="lazy"`)
по мере приближения к области просмотра. `skinTone` принимает одно из значений
`'default'`, `'light'`, `'medium-light'`, `'medium'`, `'medium-dark'` или
`'dark'`.

## Сначала настройте asset site

Если вы используете [собственный asset site](self-host-the-assets.md), вызовите
`configureEmojis` перед `preloadEmojis`. Смена asset site после предзагрузки
сбрасывает manifest, и прогретые запросы пропадают впустую.

## Когда сеть отказывает

Запрос manifest прекращается через 15 секунд. Неудачный manifest повторно
запрашивается при следующем вызове `preloadEmojis`, при следующем монтировании
или когда браузер снова подключается к сети, поэтому повторный вызов из триггера
безопасен. См. [Предзагрузка](../guide/assets.md#preloading) и
[Fallback](../guide/behavior.md#fallback).
