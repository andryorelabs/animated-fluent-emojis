---
title: 故障排查
sourceHash: c3ad7fa99dc76181
---

问题按你看到的现象分组，每个问题都给出代码层面的原因和修复方法。完整 API 请参阅[使用指南](usage.md)。

- [emoji 能显示但始终不播放动画](#emoji-能显示但始终不播放动画)
- [什么都没渲染，或只显示后备内容](#什么都没渲染或只显示后备内容)
- [manifest 被 CSP 拦截，或浏览器处于离线状态](#manifest-被-csp-拦截或浏览器处于离线状态)
- [Next.js 在 configureEmojis 或 Emoji 上报错](#nextjs-在-configureemojis-或-emoji-上报错)
- [ERR_PACKAGE_PATH_NOT_EXPORTED 或 require 错误](#err_package_path_not_exported-或-require-错误)
- [渲染 Emoji 的测试在 jsdom 中失败或始终不播放动画](#渲染-emoji-的测试在-jsdom-中失败或始终不播放动画)
- [bun run test 因缺少 Chromium 而失败](#bun-run-test-因缺少-chromium-而失败)
- [另请参阅](#另请参阅)

## emoji 能显示但始终不播放动画

**现象：** 海报帧以正确的尺寸渲染，但始终不播放，对 `playOnHover` 也没有反应。

**原因：** `emoji-play` 关键帧和悬停规则位于
`src/components/Emoji.module.css`，该文件作为单独的 `style.css`
导出发布。`emoji-play` 动画名称及其关键帧都来自该样式表中的 `.emojiImage`
类。`useEmojiAnimation` 注入的内联样式只设置时长、`steps()`
时间函数和暂停状态，因此没有样式表时，没有任何地方指定动画，sprite
sheet 就停留在海报帧。参见 [CSS](architecture.md#css)。

还有一些情况看起来相同，但并不是 bug：

- 用户偏好减少动态效果。此时 `autoPlay` 会被忽略，emoji 停留在海报帧；只有
  `playing` 可以覆盖这一行为。
- emoji 在屏幕之外、标签页处于隐藏状态，或图片尚未加载完成。自动播放会等待这三个条件全部满足。

**修复：** 在应用的根部导入一次样式表：

```js
import "animated-fluent-emojis/style.css";
```

如果你已经导入了，emoji 仍然静止，请检查操作系统的“减少动态效果”设置。

## 什么都没渲染，或只显示后备内容

**现象：** `Emoji`
没有渲染动画，而是什么都不渲染、渲染一个空盒子，或渲染你提供的 `fallback` 节点。

**原因：** `Emoji`
从 manifest 存储（`useEmojiStyle`）读取自己的条目，该存储会处于以下四种状态之一：

- `loading`：一个最终尺寸的空 `aria-hidden`
  占位元素。manifest 在首次使用时获取，超时时间为 15 秒。
- `missing`：id 不在 manifest 中。它会渲染
  `fallback`，或什么都不渲染，并且不会调用
  `onError`。在开发环境中，每个 id 会记录一次
  `Unknown emoji id "<id>".`。常见原因是拼写错误，或使用了其他版本的 id。
- `error`：manifest 请求失败、超时或返回了非 2xx 状态。存储会在控制台记录
  `Error fetching emoji data:` 及原因，在不带事件的情况下调用 `onError`，并渲染
  `fallback`，或什么都不渲染。后备字形依赖 manifest，因此在这种状态下不会出现。
- `ready`，但 sprite sheet 请求失败：渲染后备字形（带有 `alt` 标签）或你的
  `fallback`，并且 `onError` 会收到图片事件。

**修复：** 打开控制台和网络面板，查找上述日志。

- 未知 id：使用已知的 id。`EmojiId` 会自动补全它们，也可以用 `lookup`
  导出来搜索（参见 [Lookup](guide/lookup.md)）。
- manifest 请求失败：确认浏览器访问 `<asset site>/v1/manifest.slim.json`
  返回 200。失败的加载会在下一次挂载、调用 `preloadEmojis`
  以及浏览器重新联网时重试。
- 如果 emoji 绝不能在布局中留下空洞，请传入 `fallback`。参见
  [Fallback](guide/behavior.md#fallback)。

## manifest 被 CSP 拦截，或浏览器处于离线状态

**现象：** 控制台显示内容安全策略（CSP）违规、网络错误或
`Failed to fetch the emoji manifest (<status>)`，并且每个 `Emoji`
都回退到后备内容。

**原因：** manifest 通过 `fetch` 从 `<assetSiteUrl>/v1/manifest.slim.json`
请求（位于 `src/utils/emoji-manifest.ts` 的 `fetchManifest`），sprite
sheet 则作为图片从同一源加载。如果策略的 `connect-src`
中没有该源，manifest 会被拦截；`img-src`
中没有该源，则 sprite 会被拦截。离线时，fetch 会 reject，存储进入 `error`
状态，并在浏览器触发 `online` 后重试一次。使用自定义 `assetSiteUrl` 调用
`configureEmojis` 会改变你需要放行的源。

**修复：** 在 `connect-src` 和 `img-src` 中放行 asset site 的源，默认是
`https://animated-fluent-emojis-cdn.andryore.dev`。具体指令见
[CSP 要求](security.md#csp-requirements)。如果你自行托管，请改为放行你自己的源，并在第一个
`Emoji` 渲染之前调用 `configureEmojis`。参见
[Asset site](guide/assets.md#asset-site)。

## Next.js 在 configureEmojis 或 Emoji 上报错

**现象：** Next.js 的构建或页面失败，报错称某个函数正在从服务器端被调用，并指明
`configureEmojis` 或 `preloadEmojis`。

**原因：** 发布的 bundle 以 `"use client";`
声明开头（参见[构建输出](architecture.md#build-output)）。这使 Server
Component 可以导入并渲染
`<Emoji>`，它会变成客户端组件，但 bundle 的每一个导出随之都成为客户端引用。在 Server
Component 中把 `configureEmojis` 或 `preloadEmojis`
当作函数调用，就是要求服务器运行客户端代码。manifest 存储也位于浏览器内存中，所以这个调用本来也无法到达客户端。`lookup`
导出没有这条声明，因此可以在服务器端导入。

**修复：** 在以 `"use client"` 开头的模块中调用 `configureEmojis` 和
`preloadEmojis`，并在根布局中导入一次 `style.css`。参见
[Next.js 与服务器组件](../README.md#nextjs-and-server-components)和[使用指南](usage.md)。

## ERR_PACKAGE_PATH_NOT_EXPORTED 或 require 错误

**现象：** 从 CommonJS 加载该包时出现 `ERR_PACKAGE_PATH_NOT_EXPORTED`（“No
"exports" main defined”）、`Cannot find module` 或 `ERR_REQUIRE_ESM`。

**原因：** 该包只支持 ESM。`package.json` 设置了 `"type": "module"` 和带有
`types`、`import` 条件的 `exports` 映射，没有 `require` 条件，也没有 `main`
字段。`require('animated-fluent-emojis')`
调用在 Node 解析 exports 映射时就会失败，早于检查文件是否为 ESM，因此最常见的错误是
`ERR_PACKAGE_PATH_NOT_EXPORTED`，`ERR_REQUIRE_ESM` 只会在部分工具中出现。参见
[ADR 0003](adr/0003-esm-only-and-vite-8.md)。

**修复：** 在 ESM 文件或打包器中使用 `import`
语法。所有主流维护中的 React 工具链（Vite、Next.js、Remix、现代 webpack）本来就是这样做的。在 CommonJS 文件中，请使用动态
`import()`
加载。对于默认加载 CommonJS 的 Jest，请切换到它的 ESM 模式，或改用原生支持 ESM 的运行器，例如 Vitest。

## 渲染 Emoji 的测试在 jsdom 中失败或始终不播放动画

**现象：** 你自己组件的测试因未处理的网络请求或 `Emoji`
的控制台错误而失败，或者动画断言在 jsdom 中始终无法通过。

**原因：** 这是两个相互独立的限制。

- **manifest 获取。** 第一次渲染 `Emoji` 会获取
  `<assetSiteUrl>/v1/manifest.slim.json`。没有 mock 时它会访问网络或失败，每个
  `Emoji` 都会进入 `error`
  状态。存储还是模块级状态，因此在同一个文件中，已加载或已失败的 manifest 会在测试之间延续。
- **动画。**
  自动播放要等到 sprite 图片加载完成，而 jsdom 默认不加载图片，所以播放一直处于暂停。也没有 CSS 动画引擎，因此
  `animationend` 不会自行触发，`onPlaybackEnd` 也不会被调用。jsdom 中没有
  `IntersectionObserver` 和
  `matchMedia`，组件对此做了处理：emoji 被视为在屏幕内，并且不偏好减少动态效果。

**修复：** mock 掉 manifest 请求，并在测试之间重置模块。本仓库在
`src/utils/emoji-manifest.test.ts` 中用 MSW 实现了这一点：

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest` 是紧凑的 slim manifest 结构；这里使用的夹具是
`src/test/manifest-fixture.ts`。在 `afterEach` 中调用
`vi.resetModules()`，并在每个测试中重新导入组件，以获得全新的存储。请断言渲染出的
`img` 及其内联动画样式，不要依赖 `animationend`。若要测试真实播放，请使用 Vitest
Browser Mode 这样的浏览器运行器，本仓库的组件测试就是这样做的。

## bun run test 因缺少 Chromium 而失败

**现象：** 面向贡献者：`bun run test`
在启动时失败，Playwright 报错称 Chromium 可执行文件不存在。

**原因：** 组件和 hook 测试通过 Vitest Browser
Mode 和 Playwright 在无头 Chromium 中运行，而 `bun install`
不会下载浏览器。参见[测试](development.md#testing)。

**修复：** 只需安装一次：

```sh
bunx playwright install chromium
```

## 另请参阅

- [使用指南](usage.md)：props、后备行为、预加载和 asset site。
- [安全设计](security.md)：CSP 要求和威胁模型。
- [架构](architecture.md)：manifest 存储、CSS 和构建输出。
- [开发](development.md)：环境搭建与测试。
- [ADR 0003](adr/0003-esm-only-and-vite-8.md)：为什么该包只支持 ESM。
