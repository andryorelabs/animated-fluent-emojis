---
title: Assets
sourceHash: 375cf7e40f14709c
---

<a id="images-and-hd-sprite-sheets"></a>

## 图片与 HD sprite sheet

sprite sheet 以 `loading="lazy"` 和 `decoding="async"` 加载。拥有 HD sprite
sheet（200px 帧）的表情还会获得基于宽度的 `srcSet`（`100w` 和 `200w`），其
`sizes` 设为渲染尺寸（字符串类型的 `size` 则为
`auto`），因此浏览器会在高密度显示器上选用 `@2x` sheet。

<a id="preloading"></a>

## 预加载

`preloadEmojis` 会在任何 `Emoji`
渲染之前开始获取 manifest，并且在传入 id 时，于 manifest 就绪后请求它们的 sprite
sheet。它永远不会 reject：

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone` 用于为有肤色的表情选择要预热的变体。

## Asset site

默认情况下，manifest 和 sprite sheet 来自
`https://animated-fluent-emojis-cdn.andryore.dev`。之前的地址
`https://animated-fluent-emojis.pages.dev`
仍然可用。若要从你自己的副本提供它们，请在第一个 `Emoji` 渲染之前调用一次
`configureEmojis`：

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
