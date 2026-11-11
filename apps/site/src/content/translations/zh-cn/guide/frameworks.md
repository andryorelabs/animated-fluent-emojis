---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

一个包，每个框架一个导入路径。`configureEmojis` 和 `preloadEmojis`
与框架无关，仍然从 `animated-fluent-emojis` 导入；参见
[Preloading](assets.md#preloading) 和
[Asset site](assets.md#asset-site)。所有适配器共用同一个播放核心，并通过同一套一致性测试，因此各处的 props 行为相同。参见
[ADR 0014](../adr/0014-multi-framework-support.md)。

React、Vue 和 Svelte 适配器以及 `createEmoji` 从
`animated-fluent-emojis/style.css` 读取关键帧；请只导入一次。`<fluent-emoji>`
和 Astro 组件自带样式。

## React

从 React 子路径导入 `Emoji`：

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

从 0.6 或更早版本迁移：根路径的 `Emoji`
导出在 0.6 中已弃用，并在 0.7 中移除。只需更改导入路径，其他无需改动；props 和行为完全相同。`EmojiProps`
类型也已移至 `animated-fluent-emojis/react`。`configureEmojis` 和
`preloadEmojis` 仍然位于 `animated-fluent-emojis`。支持 React 18 和 19，`react`
和 `react-dom` 是可选的 peer 依赖。

## Vue

需要 Vue 3.3 或更高版本。`Emoji`
接受下面的 props，使用 camelCase 写法。`fallback` 插槽会替换图片，事件有
`load`、`error` 和 `playbackEnd`。其他属性，例如 `class`、 `style` 和
`data-*`，会传给根 span。

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

在服务端以及水合（hydration）期间，它会渲染一个最终尺寸的空占位元素，因此可以在 Nuxt 中使用。

## Svelte

需要 Svelte 5。`Emoji` 接受下面的 props；`fallback`
是一个 snippet，`class`、`style` 和 `attributes` 会传给根 span。回调有
`onLoad`、`onError` 和 `onPlaybackEnd`。

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

它在服务端渲染占位元素，水合后再渲染表情，因此可以在 SvelteKit 中使用。该包的 export 带有
`svelte` 条件，指向组件源码。

## Astro

需要 Astro
5 或更高版本。组件在构建时渲染表情的标记，因此在任何脚本运行之前，sprite 就已在 HTML 中，随后一个很小的脚本在浏览器中启动播放。它自带样式，无需导入样式表。当 id 未知或图片加载失败时，会渲染具名插槽
`fallback`。

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

props 与下面列出的相同，但不含回调，并带有 `class` 和字符串类型的
`style`。根 span 以可冒泡的 DOM 事件而不是回调的形式派发
`emoji-load`、`emoji-error` 和 `playback-end`。浏览器脚本也会在
`astro:page-load` 时再次运行，因此视图过渡（view transitions）可以继续正常工作。

<a id="plain-html"></a>

## 纯 HTML

导入 `animated-fluent-emojis/element` 会注册
`<fluent-emoji>`。它不需要样式表：关键帧位于其 shadow root 中。

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

属性以 kebab-case 对应各个 props：`id`、`size`、`play-on-hover`、
`animation-iterations`、`auto-play`、`playing`、`skin-tone` 和
`alt`。布尔属性只要其值不是 `false`
就视为开启。元素上也有同名的 camelCase 属性（`element.playOnHover = true`）；设置属性不会改写对应的 attribute。带有
`slot="fallback"` 的元素就是 fallback。该元素以可冒泡且 composed 的事件派发
`emoji-load`、`emoji-error` 和 `playback-end`。

在元素被定义之前，它没有尺寸。请把同一入口导出的 `FLUENT_EMOJI_PRE_UPGRADE_CSS`
添加到页面 CSS 中，以根据 `size` 属性（单位为像素）预留占位空间，避免布局偏移。

<a id="angular-solid-and-preact"></a>

## Angular、Solid 和 Preact

它们通过各自的模板语法使用 `<fluent-emoji>`；请参阅 how-to 指南：
[Angular](../how-to/use-with-angular.md)、[Solid](../how-to/use-with-solid.md)
和 [Preact](../how-to/use-with-preact.md)。Lit、Alpine 和 htmx 同理：导入
`animated-fluent-emojis/element`，然后写上该标签即可。

<a id="without-a-framework"></a>

## 不使用框架

`createEmoji`
可以渲染到任意 DOM 节点并返回一个 controller。它是所有适配器的无框架核心。导入它不会触碰 DOM。

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

它的选项就是下面的 props，另有用于根 span 的 `className`、`style` 和
`attributes`， `onLoad`、`onError` 和 `onPlaybackEnd` 回调，以及
`fallback`，它可以是一个节点、一个返回节点的函数，或 `null`。
