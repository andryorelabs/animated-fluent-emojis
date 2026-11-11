---
title: Preact で使う
sourceHash: 690f9a4ab5451009
---

Preact で絵文字を使う方法は二つあります。`<fluent-emoji>`
要素を使う方法と、`preact/compat` 経由で React アダプターを使う方法です。

## 要素

要素のエントリを一度だけインポートします。`<fluent-emoji>`
が登録され、スタイルシートは不要です。

```tsx
import "animated-fluent-emojis/element";
```

パッケージは、要素のケバブケースの属性で `preact` の JSX 型を拡張します。

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

フォールバックは `slot="fallback"`
を付けた子要素として渡します。`emoji-load`、`emoji-error`、`playback-end`
に反応するには、`ref` から要素に対して `addEventListener` を呼び出します。

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

属性、プロパティ、イベントは[使い方ガイド](../guide/frameworks.md#plain-html)に一覧があります。

## React アダプター

バンドラーで `react` と `react-dom` を `preact/compat`
のエイリアスにしてから、[使い方ガイド](../guide/frameworks.md#react)の説明どおりに React アダプターを使います。
