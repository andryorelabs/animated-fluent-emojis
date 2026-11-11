---
title: 为选择器预加载
sourceHash: 727a2637d064bf30
---

在 emoji 选择器打开之前预热 manifest 和 sprite
sheet，这样 emoji 出现时就不会有可见的加载过程。

## 提前预热 manifest

不带参数的 `preloadEmojis` 会在任何 `Emoji`
渲染之前开始获取 manifest。它永远不会 reject，所以只写 `void` 就够了：

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

请在用户可能打开选择器的时候调用它，例如触发按钮被悬停或获得焦点时，或者应用外壳挂载时。

## 预热你将要显示的 sprite sheet

传入 id，即可在 manifest 就绪后请求它们的 sprite sheet。对于带肤色的 emoji，传入
`skinTone` 可以预热用户将看到的变体：

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

只预热你最先渲染的 id。包含数百个 emoji 的选择器不应该全部预加载；sprite
sheet 会在接近视口时懒加载（`loading="lazy"`）。`skinTone` 是
`'default'`、`'light'`、`'medium-light'`、`'medium'`、`'medium-dark'` 或
`'dark'` 之一。

## 先配置 asset site

如果你使用[自行托管的 asset site](self-host-the-assets.md)，请在 `preloadEmojis`
之前调用 `configureEmojis`。在预加载之后更改 asset
site 会重置 manifest，已预热的请求就白费了。

## 网络失败时

manifest 请求在 15 秒后放弃。失败的 manifest 会在下一次调用
`preloadEmojis`、下一次挂载，或浏览器重新联网时重试，所以从触发按钮再次调用它是安全的。参见[预加载](../guide/assets.md#preloading)和
[fallback](../guide/behavior.md#fallback)。
