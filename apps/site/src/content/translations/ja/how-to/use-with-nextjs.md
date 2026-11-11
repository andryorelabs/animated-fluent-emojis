---
title: Next.js で使う
sourceHash: 6f92dff657703a74
---

App Router で `Emoji` をレンダリングします。Server Component からも使えます。

## スタイルシートを一度だけインポートする

スタイルシートにはアニメーションのキーフレームが含まれています。これがないと、絵文字は静的なスプライトシートとして表示されます。ルートレイアウトで一度だけインポートします。

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

## Server Component で Emoji を使う

バンドルは `"use client";` で始まるため、Server
Component からラッパーファイルなしで `Emoji` を直接インポートできます。

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

サーバー上では、`Emoji`
は最終的なサイズの空のプレースホルダーをレンダリングするので、レイアウトはずれません。絵文字はハイドレーション後に表示されます。マニフェストはインポート時ではなく、最初のレンダリング時にブラウザーで取得されるためです。`onLoad`
や `onPlaybackEnd` などの関数は Server
Component から渡せません。その場合は、クライアントモジュールから絵文字をレンダリングしてください。

## クライアントモジュールで設定とプリロードを行う

`configureEmojis` と `preloadEmojis` はブラウザーで実行されるため、Server
Componentではなく、`"use client"`
で始まるモジュールから呼び出します。ルートレイアウトにマウントする小さなコンポーネントで十分です。

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

レイアウトのコンテンツの上に `<EmojiSetup />`
をレンダリングします。デフォルトのアセットサイトを使うなら、`configureEmojis`
の行を削除してください。最初の `Emoji`
がレンダリングされる前に呼び出します。カスタムオリジンに対応する Content
Security
Policy は[アセットをセルフホストする](self-host-the-assets.md)、特定の id のプリロードは[ピッカー向けにプリロードする](preload-for-a-picker.md)を参照してください。

## Lookup

`animated-fluent-emojis/lookup` には React も `"use client"`
バナーもないため、Server
Component やルートハンドラーでも動作します。[lookup](../guide/lookup.md)を参照してください。
