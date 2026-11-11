---
title: Размещение ресурсов у себя
sourceHash: 1fa3d7fdc9a470b6
---

Раздавайте manifest и sprite sheets с origin, который вы контролируете, и
направьте `Emoji` на него. Это нужно, когда вы не можете разрешить сторонний
origin в своей Content Security Policy или не хотите зависеть от asset site по
умолчанию. Термины соответствуют [`GLOSSARY.md`](../../GLOSSARY.md).

## Соберите сайт

Asset site генерирует `apps/assets` в `apps/assets/dist-assets/`; ничего из
созданного не коммитится. В клоне репозитория выполните `bun run assets:build`
(нужен `ffmpeg`, см. [разработку](../development.md)) и опубликуйте содержимое
`apps/assets/dist-assets/` на любом статическом хостинге. Сохраните структуру
`v1/` и файл `_headers`, если хостинг его поддерживает, потому что он кеширует
спрайты с адресацией по содержимому как `immutable`. Структура описана в
[архитектуре](../architecture.md#asset-layout-v1).

Чтобы опубликовать на Cloudflare Pages так, как это делает этот проект, следуйте
[настройке хостинга ресурсов](set-up-asset-hosting.md).

## Направьте компонент на него

Вызовите `configureEmojis` один раз, до первого рендера `Emoji`. Завершающий
слэш в URL игнорируется:

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

Если вызвать его после запроса manifest, manifest сбрасывается, а в режиме
разработки появляется предупреждение. См. раздел
[Asset site](../guide/assets.md#asset-site) руководства по использованию.

## Настройте Content Security Policy

Разрешите свой origin в обеих директивах. Manifest загружается через fetch, а
sprite sheets через `<img>`:

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

URL спрайта выглядит как
`<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`, а для HD sprite
sheet перед расширением добавляется `@2x`, так что один origin покрывает оба
случая. Адаптеры фреймворков не добавляют элемент `<style>`, поэтому им не нужно
разрешение `style-src`; элемент `<fluent-emoji>` добавляет его в свой shadow
root, и ему оно нужно. Дизайн и его ограничения описаны в
[безопасности](../security.md#csp-requirements).

## Проверьте

Откройте страницу с панелью сети и убедитесь, что запрос manifest идёт на
`/v1/manifest.slim.json` вашего origin и ни один запрос не уходит на
`animated-fluent-emojis-cdn.andryore.dev`. Заблокированный запрос виден в
консоли как нарушение CSP, а эмодзи показывает свой fallback; см.
[Fallback](../guide/behavior.md#fallback).
