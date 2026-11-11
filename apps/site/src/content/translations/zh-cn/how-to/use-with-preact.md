---
title: 在 Preact 中使用
sourceHash: 690f9a4ab5451009
---

在 Preact 中使用 emoji 有两种方式：`<fluent-emoji>` 元素，或通过 `preact/compat`
使用 React 适配器。

## 元素

只需导入一次元素入口。它会注册 `<fluent-emoji>`，无需样式表：

```tsx
import "animated-fluent-emojis/element";
```

该包为 `preact` 的 JSX 类型补充了元素的 kebab-case attribute：

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

fallback 作为带有 `slot="fallback"` 的子元素传入。若要响应
`emoji-load`、`emoji-error` 或 `playback-end`，请通过 `ref` 在元素上调用
`addEventListener`：

```tsx
import { useEffect, useRef } from "preact/hooks";

export function Greeting() {
  const emoji = useRef<HTMLElementTagNameMap["fluent-emoji"]>(null);

  useEffect(() => {
    const element = emoji.current;
    const onEnd = () => {
      console.log("done");
    };
    element?.addEventListener("playback-end", onEnd);
    return () => element?.removeEventListener("playback-end", onEnd);
  }, []);

  return (
    <fluent-emoji id="1f44b_wavinghand" ref={emoji}>
      <span slot="fallback">👋</span>
    </fluent-emoji>
  );
}
```

attribute、属性和事件的完整列表见[使用指南](../guide/frameworks.md#plain-html)。

## React 适配器

在打包工具中把 `react` 和 `react-dom` 别名到
`preact/compat`，然后按[使用指南](../guide/frameworks.md#react)中的说明使用 React 适配器。
