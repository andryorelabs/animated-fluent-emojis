---
title: Angular で使う
sourceHash: 45537066a981f484
---

Angular では `<fluent-emoji>`
要素を通して絵文字をレンダリングします。Angular 向けのネイティブアダプターはありません。この要素は、カスタム要素に対応している Angular のどのバージョンでも動作します。

## 要素を登録する

要素のエントリを一度だけインポートします。たとえば `main.ts`
で行います。インポートすると `<fluent-emoji>` が登録されます。要素は shadow
root 内に独自のスタイルを持つため、インポートするスタイルシートはありません。

```ts
import "animated-fluent-emojis/element";
```

## コンポーネントでタグを許可する

コンポーネントでカスタム要素を許可しないと、Angular は未知のタグを拒否します。

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

## プロパティをバインドしてイベントを待ち受ける

動的な値にはプロパティバインディングを使うと、Angularは属性を書き換えるのではなく要素のプロパティを設定します。イベントは
`emoji-load`、`emoji-error`、`playback-end` です。

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

属性、プロパティ、イベントは[使い方ガイド](../guide/frameworks.md#plain-html)に一覧があります。要素がアップグレードされる前に占有領域を確保するには、グローバル CSS に
`FLUENT_EMOJI_PRE_UPGRADE_CSS`
を追加します。読み込み、フォールバック、再生の挙動については、[使い方ガイド](../usage.md)の残りの部分を参照してください。
