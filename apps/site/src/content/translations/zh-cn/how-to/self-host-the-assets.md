---
title: 自行托管资源
sourceHash: 1fa3d7fdc9a470b6
---

从你自己控制的源提供 manifest 和 sprite sheet，并让 `Emoji`
指向它。当你无法在内容安全策略中放行第三方源，或不想依赖默认的 asset
site 时，请使用这种方式。术语遵循 [`GLOSSARY.md`](../../GLOSSARY.md)。

## 构建站点

asset site 由 `apps/assets` 生成到
`apps/assets/dist-assets/`，生成的内容都不会提交到仓库。在仓库的克隆中运行
`bun run assets:build`（它需要 `ffmpeg`，参见[开发](../development.md)），然后把
`apps/assets/dist-assets/` 的内容发布到任意静态主机。请保留 `v1/`
目录结构，以及主机支持时的 `_headers` 文件，因为它会把内容寻址的 sprite 缓存为
`immutable`。目录结构的说明见[架构](../architecture.md#asset-layout-v1)。

若要像本项目一样发布到 Cloudflare
Pages，请参照[设置资源托管](set-up-asset-hosting.md)。

## 让组件指向它

在第一个 `Emoji` 渲染之前调用一次 `configureEmojis`。URL 末尾的斜杠会被忽略：

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

如果在 manifest 已被请求之后才调用它，manifest 会被重置，并在开发环境中给出警告。参见使用指南的
[asset site](../guide/assets.md#asset-site) 一节。

## 设置内容安全策略

在两条指令中都放行你的源。manifest 通过 fetch 获取，sprite sheet 则通过 `<img>`
加载：

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

sprite 的 URL 是 `<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`，HD
sprite sheet 会在扩展名前加上 `@2x`，所以一个源就能覆盖两者。框架适配器不会注入
`<style>` 元素，因此不需要 `style-src` 许可；`<fluent-emoji>` 元素会在其 shadow
root 中添加一个，所以需要。设计思路及其限制见[安全](../security.md#csp-requirements)。

## 验证

打开页面并查看网络面板，确认 manifest 请求发往你的源上的
`/v1/manifest.slim.json`，并且没有任何请求发往
`animated-fluent-emojis-cdn.andryore.dev`。被拦截的请求会在控制台中显示为 CSP 违规，此时 emoji 会渲染其后备内容；参见
[fallback](../guide/behavior.md#fallback)。
