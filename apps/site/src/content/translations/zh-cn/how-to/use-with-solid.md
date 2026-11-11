---
title: 在 Solid 中使用
sourceHash: 7d4f24852e28d756
---

在 Solid 中通过 `<fluent-emoji>` 元素渲染 emoji。Solid 没有原生适配器。

## 注册元素

只需导入一次元素入口，例如在入口模块中。它会注册 `<fluent-emoji>`，无需样式表：

```tsx
import "animated-fluent-emojis/element";
```

## 使用标签

该包为 `solid-js` 的 JSX 类型补充了元素的 kebab-case attribute。使用 `on:`
监听元素的事件，Solid 会把监听器直接附加到元素上：

```tsx
export function Greeting() {
  return (
    <fluent-emoji
      id="1f44b_wavinghand"
      size={64}
      play-on-hover
      on:playback-end={() => {
        console.log("done");
      }}
    />
  );
}
```

fallback 作为带有 `slot="fallback"` 的子元素传入，`ref` 可以拿到该元素：

```tsx
<fluent-emoji
  id="1f44b_wavinghand"
  ref={(element) => {
    element.playing = false;
  }}
>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

attribute、属性和事件的完整列表见[使用指南](../guide/frameworks.md#plain-html)。
