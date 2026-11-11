---
title: Устранение неполадок
sourceHash: c3ad7fa99dc76181
---

Проблемы сгруппированы по тому, что вы видите. Для каждой указаны причина в коде
и способ исправления. Полное API описано в
[руководстве по использованию](usage.md).

- [Эмодзи отображается, но не анимируется](#эмодзи-отображается-но-не-анимируется)
- [Ничего не отображается или виден только fallback](#ничего-не-отображается-или-виден-только-fallback)
- [Manifest заблокирован CSP или браузер офлайн](#manifest-заблокирован-csp-или-браузер-офлайн)
- [Next.js сообщает об ошибке для configureEmojis или Emoji](#nextjs-сообщает-об-ошибке-для-configureemojis-или-emoji)
- [ERR_PACKAGE_PATH_NOT_EXPORTED или ошибка require](#err_package_path_not_exported-или-ошибка-require)
- [Тесты с Emoji падают или не анимируются в jsdom](#тесты-с-emoji-падают-или-не-анимируются-в-jsdom)
- [bun run test падает из-за отсутствия Chromium](#bun-run-test-падает-из-за-отсутствия-chromium)
- [См. также](#см-также)

## Эмодзи отображается, но не анимируется

**Симптом:** poster frame отображается в нужном размере, но не проигрывается и
не реагирует на `playOnHover`.

**Причина:** keyframe `emoji-play` и правила наведения находятся в
`src/components/Emoji.module.css`, который поставляется отдельным экспортом
`style.css`. Имя анимации `emoji-play` и её keyframe приходят из класса
`.emojiImage` этой таблицы стилей. Встроенный стиль из `useEmojiAnimation`
задаёт только длительность, тайминг `steps()` и состояние паузы, поэтому без
таблицы стилей ни одна анимация не назначена, и sprite sheet остаётся на poster
frame. См. [CSS](architecture.md#css).

Другие случаи выглядят так же и ошибками не являются:

- Пользователь предпочитает уменьшенное движение. Тогда `autoPlay` игнорируется,
  и эмодзи остаётся на poster frame; переопределяет это только `playing`.
- Эмодзи находится за пределами экрана, вкладка скрыта или изображение ещё не
  загрузилось. Автовоспроизведение ждёт всех трёх условий.

**Решение:** один раз импортируйте таблицу стилей в корне приложения:

```js
import "animated-fluent-emojis/style.css";
```

Если вы её импортировали, а эмодзи всё равно неподвижно, проверьте настройку
уменьшенного движения в операционной системе.

## Ничего не отображается или виден только fallback

**Симптом:** `Emoji` ничего не отрисовывает, показывает пустой блок или ваш узел
`fallback` вместо анимации.

**Причина:** `Emoji` берёт свою запись из хранилища manifest (`useEmojiStyle`),
которое находится в одном из четырёх состояний:

- `loading`: пустой placeholder с `aria-hidden` итогового размера. Manifest
  загружается при первом использовании с таймаутом 15 секунд.
- `missing`: id отсутствует в manifest. Отрисовывается `fallback` или ничего, а
  `onError` не вызывается. В режиме разработки один раз для каждого id пишется
  `Unknown emoji id "<id>".`. Обычная причина: опечатка или id из другой версии.
- `error`: запрос manifest завершился ошибкой, превысил таймаут или получил
  ответ не 2xx. Хранилище пишет в консоль `Error fetching emoji data:` с
  причиной, вызывает `onError` без события и отрисовывает `fallback` или ничего.
  Fallback glyph зависит от manifest, поэтому в этом состоянии он не
  показывается.
- `ready`, но запрос sprite sheet завершился ошибкой: отрисовывается fallback
  glyph (с подписью `alt`) или ваш `fallback`, а `onError` получает событие
  изображения.

**Решение:** откройте консоль и вкладку сети и найдите описанные выше строки.

- Неизвестный id: используйте известный id. `EmojiId` подсказывает их при
  автодополнении, а экспорт `lookup` позволяет их искать (см.
  [Lookup](guide/lookup.md)).
- Сбой manifest: убедитесь, что `<asset site>/v1/manifest.slim.json` отвечает
  200 из браузера. Неудачная загрузка повторяется при следующем монтировании,
  при вызове `preloadEmojis` и когда браузер снова подключается к сети.
- Передайте `fallback`, если эмодзи не должно оставлять дыру в вёрстке. См.
  [Fallback](guide/behavior.md#fallback).

## Manifest заблокирован CSP или браузер офлайн

**Симптом:** в консоли видно нарушение Content Security Policy, сетевую ошибку
или `Failed to fetch the emoji manifest (<status>)`, и каждый `Emoji` переходит
на fallback.

**Причина:** manifest запрашивается через `fetch` с
`<assetSiteUrl>/v1/manifest.slim.json` (`fetchManifest` в
`src/utils/emoji-manifest.ts`), а sprite sheets загружаются как изображения с
того же origin. Политика без этого origin в `connect-src` блокирует manifest, а
без него в `img-src` блокирует спрайты. В офлайне fetch отклоняется, и хранилище
переходит в `error`, а затем повторяет попытку, когда браузер генерирует
`online`. `configureEmojis` с собственным `assetSiteUrl` меняет origin, который
нужно разрешить.

**Решение:** разрешите origin asset site, по умолчанию
`https://animated-fluent-emojis-cdn.andryore.dev`, в `connect-src` и `img-src`.
Точные директивы приведены в [требованиях к CSP](security.md#csp-requirements).
Если вы размещаете ресурсы у себя, разрешите вместо этого свой origin и вызовите
`configureEmojis` до первого рендера `Emoji`. См.
[Asset site](guide/assets.md#asset-site).

## Next.js сообщает об ошибке для configureEmojis или Emoji

**Симптом:** Next.js прерывает сборку или страницу с ошибкой о том, что функция
вызывается с сервера, и называет `configureEmojis` или `preloadEmojis`.

**Причина:** опубликованный бандл начинается с баннера `"use client";` (см.
[Build output](architecture.md#build-output)). Благодаря этому Server Component
может импортировать и отрисовывать `<Emoji>`, который становится клиентским
компонентом, но каждый экспорт бандла при этом превращается в клиентскую ссылку.
Вызов `configureEmojis` или `preloadEmojis` как функции внутри Server Component
просит сервер выполнить клиентский код. К тому же хранилище manifest живёт в
памяти браузера, так что вызов всё равно не дошёл бы до клиента. У экспорта
`lookup` баннера нет, поэтому его можно импортировать на сервере.

**Решение:** вызывайте `configureEmojis` и `preloadEmojis` из модуля, который
начинается с `"use client"`, а `style.css` импортируйте один раз в корневом
layout. См.
[Next.js и server components](../README.md#nextjs-and-server-components) и
[руководство по использованию](usage.md).

## ERR_PACKAGE_PATH_NOT_EXPORTED или ошибка require

**Симптом:** `ERR_PACKAGE_PATH_NOT_EXPORTED` ("No "exports" main defined"),
`Cannot find module` или `ERR_REQUIRE_ESM` при загрузке пакета из CommonJS.

**Причина:** пакет работает только как ESM. В `package.json` задано
`"type": "module"` и карта `exports` с условиями `types` и `import`, без условия
`require` и поля `main`. Вызов `require('animated-fluent-emojis')` падает, пока
Node разбирает карту exports, ещё до проверки, является ли файл ESM, поэтому
обычная ошибка здесь `ERR_PACKAGE_PATH_NOT_EXPORTED`, а `ERR_REQUIRE_ESM`
встречается только в некоторых инструментах. См.
[ADR 0003](adr/0003-esm-only-and-vite-8.md).

**Решение:** используйте синтаксис `import` в ESM-файле или в сборщике. Так уже
работают все поддерживаемые инструменты React (Vite, Next.js, Remix, современный
webpack). В файле CommonJS загружайте пакет через динамический `import()`. Для
Jest, который по умолчанию загружает CommonJS, переключитесь на его режим ESM
или на раннер с нативной поддержкой ESM, например Vitest.

## Тесты с Emoji падают или не анимируются в jsdom

**Симптом:** тест вашего компонента падает из-за необработанного сетевого
запроса или ошибки консоли от `Emoji`, либо проверка анимации в jsdom никогда не
проходит.

**Причина:** два независимых ограничения.

- **Запрос manifest.** Первый рендер `Emoji` запрашивает
  `<assetSiteUrl>/v1/manifest.slim.json`. Без мока запрос уходит в сеть или
  падает, и каждый `Emoji` оказывается в состоянии `error`. Хранилище к тому же
  является состоянием модуля, поэтому загруженный или неудавшийся manifest
  переносится между тестами одного файла.
- **Анимация.** Автовоспроизведение ждёт загрузки изображения спрайта, а jsdom
  по умолчанию изображения не загружает, поэтому воспроизведение остаётся на
  паузе. CSS-движка анимаций там тоже нет, так что `animationend` сам не
  срабатывает, и `onPlaybackEnd` не вызывается. В jsdom отсутствуют
  `IntersectionObserver` и `matchMedia`, и компонент это учитывает: эмодзи
  считается находящимся на экране, а уменьшенное движение не предпочитаемым.

**Решение:** замокайте запрос manifest и сбрасывайте модуль между тестами. Этот
репозиторий делает это через MSW в `src/utils/emoji-manifest.test.ts`:

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest` имеет компактную форму slim manifest; используемая здесь
фикстура находится в `src/test/manifest-fixture.ts`. Вызывайте
`vi.resetModules()` в `afterEach` и импортируйте компонент заново в каждом
тесте, чтобы получить свежее хранилище. Проверяйте отрисованный `img` и его
встроенные стили анимации и не полагайтесь на `animationend`. Для настоящего
воспроизведения используйте браузерный раннер, например Vitest Browser Mode, как
этот репозиторий делает для тестов компонентов.

## bun run test падает из-за отсутствия Chromium

**Симптом:** для контрибьюторов: `bun run test` падает при запуске с ошибкой
Playwright о том, что исполняемый файл Chromium не существует.

**Причина:** тесты компонентов и хуков выполняются в headless Chromium через
Vitest Browser Mode и Playwright, а `bun install` браузер не скачивает. См.
[Testing](development.md#testing).

**Решение:** установите его один раз:

```sh
bunx playwright install chromium
```

## См. также

- [Руководство по использованию](usage.md): props, поведение fallback,
  предзагрузка и asset site.
- [Дизайн безопасности](security.md): требования к CSP и модель угроз.
- [Архитектура](architecture.md): хранилище manifest, CSS и build output.
- [Разработка](development.md): настройка окружения и тестирование.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): почему пакет работает только как
  ESM.
