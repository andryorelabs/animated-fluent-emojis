---
title: Solid で使う
sourceHash: 7d4f24852e28d756
---

Solid では `<fluent-emoji>`
要素を通して絵文字をレンダリングします。Solid向けのネイティブアダプターはありません。

## 要素を登録する

要素のエントリを一度だけインポートします。たとえばエントリモジュールで行います。`<fluent-emoji>`
が登録され、スタイルシートは不要です。

```tsx
import "animated-fluent-emojis/element";
```

## タグを使う

パッケージは、要素のケバブケースの属性で `solid-js`
の JSX 型を拡張します。イベントの待ち受けには `on:`
を使います。Solid はこれを要素に直接アタッチします。

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

フォールバックは `slot="fallback"` を付けた子要素として渡し、`ref`
から要素を取得できます。

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

属性、プロパティ、イベントは[使い方ガイド](../guide/frameworks.md#plain-html)に一覧があります。
