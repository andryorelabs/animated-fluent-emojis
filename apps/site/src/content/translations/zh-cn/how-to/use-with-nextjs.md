---
title: 在 Next.js 中使用
sourceHash: 6f92dff657703a74
---

在 App Router 中渲染 `Emoji`，包括在 Server Component 中。

## 导入一次样式表

样式表包含动画关键帧。没有它，emoji 只会渲染为静态 sprite
sheet。请在根 layout 中导入一次：

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

## 在 Server Component 中使用 Emoji

该 bundle 以 `"use client";` 开头，因此 Server Component 可以直接导入
`Emoji`，无需包装文件：

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

在服务端，`Emoji`
会渲染一个最终尺寸的空占位，因此布局不会发生偏移。emoji 在 hydration 之后出现，因为 manifest 是在首次渲染时由浏览器获取的，而不是在导入时。`onLoad`
或 `onPlaybackEnd` 这类函数无法从 Server
Component 传入；这种情况下请在客户端模块中渲染 emoji。

## 在客户端模块中配置和预加载

`configureEmojis` 和 `preloadEmojis` 在浏览器中运行，因此请从以 `"use client"`
开头的模块调用它们，而不是从 Server
Component 调用。在根 layout 中挂载一个小组件即可：

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

在 layout 中把 `<EmojiSetup />` 渲染在内容上方。删除 `configureEmojis`
这一行即可保持默认的 asset site。请在第一个 `Emoji`
渲染之前调用它；自定义 origin 搭配的 Content Security
Policy 见[自行托管 asset](self-host-the-assets.md)，预加载指定 id 见[为选择器预加载](preload-for-a-picker.md)。

## Lookup

`animated-fluent-emojis/lookup` 不含 React，也没有 `"use client"`
声明，因此在 Server Component 和路由处理程序中同样可用。参见
[lookup](../guide/lookup.md)。
