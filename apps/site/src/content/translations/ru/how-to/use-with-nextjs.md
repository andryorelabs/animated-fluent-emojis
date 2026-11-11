---
title: Использование с Next.js
sourceHash: 6f92dff657703a74
---

Рендерьте `Emoji` в App Router, в том числе из Server Components.

## Импортируйте таблицу стилей один раз

Таблица стилей содержит keyframes анимации. Без неё эмодзи рендерятся как
статичные sprite sheets. Импортируйте её один раз, в корневом layout:

```jsx
import "animated-fluent-emojis/style.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Используйте Emoji в Server Component

Бандл начинается с `"use client";`, поэтому Server Component может импортировать
`Emoji` напрямую, без файла-обёртки:

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

На сервере `Emoji` рендерит пустой плейсхолдер итогового размера, поэтому
вёрстка не сдвигается. Эмодзи появляется после гидратации, потому что manifest
загружается в браузере при первом рендере, а не при импорте. Функции вроде
`onLoad` или `onPlaybackEnd` нельзя передать из Server Component; в этом случае
рендерите эмодзи из клиентского модуля.

## Настройка и предзагрузка из клиентского модуля

`configureEmojis` и `preloadEmojis` выполняются в браузере, поэтому вызывайте их
из модуля, который начинается с `"use client"`, а не из Server Component.
Достаточно небольшого компонента, подключённого в корневом layout:

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

Отрисуйте `<EmojiSetup />` в layout выше содержимого. Уберите строку
`configureEmojis`, чтобы оставить asset site по умолчанию. Вызывайте её до
первого рендера `Emoji`; о Content Security Policy для собственного origin
читайте в [хостинге ресурсов у себя](self-host-the-assets.md), а о предзагрузке
конкретных id, в [предзагрузке для пикера](preload-for-a-picker.md).

## Lookup

`animated-fluent-emojis/lookup` не содержит React и баннера `"use client"`,
поэтому работает и в Server Components, и в route handlers. См.
[lookup](../guide/lookup.md).
