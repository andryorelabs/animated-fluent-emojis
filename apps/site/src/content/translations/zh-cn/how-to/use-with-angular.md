---
title: 在 Angular 中使用
sourceHash: 45537066a981f484
---

在 Angular 中通过 `<fluent-emoji>`
元素渲染 emoji。Angular 没有原生适配器；该元素可用于任何支持自定义元素的 Angular 版本。

## 注册元素

只需导入一次元素入口，例如在 `main.ts` 中。导入后会注册
`<fluent-emoji>`。该元素的样式封装在自己的 shadow root 中，因此无需导入样式表：

```ts
import "animated-fluent-emojis/element";
```

## 在组件中允许该标签

除非组件允许自定义元素，否则 Angular 会拒绝未知标签：

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-greeting",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover />`,
})
export class GreetingComponent {}
```

## 绑定属性并监听事件

动态值请使用属性绑定，这样 Angular 会设置元素的属性，而不是重写 attribute。事件有
`emoji-load`、`emoji-error` 和 `playback-end`：

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

attribute、属性和事件的完整列表见[使用指南](../guide/frameworks.md#plain-html)。若要在元素升级之前预留占位空间，请把
`FLUENT_EMOJI_PRE_UPGRADE_CSS`
加入全局 CSS。关于加载、fallback 和播放行为，请参阅[使用指南](../usage.md)的其余部分。
