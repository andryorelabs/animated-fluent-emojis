---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

Один пакет, один путь импорта на каждый фреймворк. `configureEmojis` и
`preloadEmojis` не зависят от фреймворков и остаются в `animated-fluent-emojis`;
см. [Предзагрузка](assets.md#preloading) и [Asset site](assets.md#asset-site).
Все адаптеры используют одно ядро воспроизведения и проходят один набор тестов
на соответствие, поэтому props везде ведут себя одинаково. См.
[ADR 0014](../adr/0014-multi-framework-support.md).

Адаптеры React, Vue и Svelte, а также `createEmoji` берут keyframes из
`animated-fluent-emojis/style.css`; импортируйте его один раз. `<fluent-emoji>`
и компонент Astro приносят свои стили.

## React

Импортируйте `Emoji` из подпути React:

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

Миграция с версии 0.6 и ранее: экспорт `Emoji` из корня был объявлен устаревшим
в 0.6 и удалён в 0.7. Измените путь импорта, больше ничего: props и поведение
идентичны. Тип `EmojiProps` тоже переехал в `animated-fluent-emojis/react`.
`configureEmojis` и `preloadEmojis` остаются в `animated-fluent-emojis`.
Поддерживаются React 18 и 19, а `react` и `react-dom` являются необязательными
peer-зависимостями.

## Vue

Vue 3.3 или новее. `Emoji` принимает приведённые ниже props в camelCase. Слот
`fallback` заменяет изображение, а события: `load`, `error` и `playbackEnd`.
Остальные атрибуты, такие как `class`, `style` и `data-*`, попадают на корневой
span.

```vue
<script setup lang="ts">
import { Emoji } from "animated-fluent-emojis/vue";

import "animated-fluent-emojis/style.css";

const handlePlaybackEnd = () => {
  console.log("done");
};
</script>

<template>
  <Emoji id="1f44b_wavinghand" :size="64" play-on-hover @playback-end="handlePlaybackEnd">
    <template #fallback><span>👋</span></template>
  </Emoji>
</template>
```

На сервере и во время гидратации компонент рендерит пустой плейсхолдер итогового
размера, поэтому он работает в Nuxt.

## Svelte

Svelte 5. `Emoji` принимает приведённые ниже props; `fallback` является snippet,
а `class`, `style` и `attributes` попадают на корневой span. Колбэки: `onLoad`,
`onError` и `onPlaybackEnd`.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

На сервере он рендерит плейсхолдер, а эмодзи появляется после гидратации,
поэтому он работает в SvelteKit. В экспорте пакета есть условие `svelte`,
указывающее на исходный код компонента.

## Astro

Astro 5 или новее. Компонент рендерит разметку эмодзи во время сборки, поэтому
спрайт оказывается в HTML ещё до запуска любого скрипта, а небольшой скрипт
запускает воспроизведение в браузере. Он приносит свои стили; импортировать
таблицу стилей не нужно. Именованный слот `fallback` рендерится, когда id
неизвестен или изображение не загрузилось.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

Props те же, что описаны ниже, кроме колбэков, плюс `class` и `style` в виде
строки. Вместо колбэков корневой span отправляет `emoji-load`, `emoji-error` и
`playback-end` как всплывающие DOM-события. Скрипт в браузере также запускается
повторно при `astro:page-load`, поэтому view transitions продолжают работать.

<a id="plain-html"></a>

## Обычный HTML

Импорт `animated-fluent-emojis/element` регистрирует `<fluent-emoji>`. Таблица
стилей не нужна: keyframes находятся в его shadow root.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Атрибуты повторяют props в kebab-case: `id`, `size`, `play-on-hover`,
`animation-iterations`, `auto-play`, `playing`, `skin-tone` и `alt`. Булев
атрибут включён, если его значение не равно `false`. Те же имена существуют как
camelCase-свойства элемента (`element.playOnHover = true`); установка свойства
не переписывает атрибут. Элемент с `slot="fallback"` является fallback. Элемент
отправляет `emoji-load`, `emoji-error` и `playback-end` как всплывающие
composed-события.

Пока элемент не определён, у него нет размера. Добавьте в CSS страницы
`FLUENT_EMOJI_PRE_UPGRADE_CSS`, экспортируемый из той же точки входа, чтобы
зарезервировать место по атрибуту `size` (в пикселях) и избежать сдвига вёрстки.

<a id="angular-solid-and-preact"></a>

## Angular, Solid и Preact

Они используют `<fluent-emoji>` через собственный синтаксис шаблонов; см. how-to
руководства для [Angular](../how-to/use-with-angular.md),
[Solid](../how-to/use-with-solid.md) и [Preact](../how-to/use-with-preact.md).
То же относится к Lit, Alpine и htmx: импортируйте
`animated-fluent-emojis/element` и пишите тег.

<a id="without-a-framework"></a>

## Без фреймворка

`createEmoji` рендерит в любой DOM-узел и возвращает контроллер. Это ядро
каждого адаптера, не зависящее от фреймворков. Его импорт не затрагивает DOM.

```js
import { createEmoji } from "animated-fluent-emojis";
import "animated-fluent-emojis/style.css";

const controller = createEmoji(document.querySelector("#slot"), {
  id: "1f44b_wavinghand",
  size: 64,
  fallback: () => document.createTextNode("👋"),
});

controller.update({ playing: false });
controller.destroy();
```

Его опции — это props, описанные ниже, плюс `className`, `style` и `attributes`
для корневого span, колбэки `onLoad`, `onError` и `onPlaybackEnd` и `fallback`,
который может быть узлом, функцией, возвращающей узел, или `null`.
