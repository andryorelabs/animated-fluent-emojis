---
title: ピッカー向けにプリロードする
sourceHash: 727a2637d064bf30
---

絵文字ピッカーが開く前にマニフェストとスプライトシートをウォームアップして、読み込みを感じさせずに絵文字を表示します。

## マニフェストを早めにウォームアップする

引数なしの `preloadEmojis` は、`Emoji`
がレンダリングされる前にマニフェストの取得を開始します。reject されることはないので、`void`
で十分です。

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

ユーザーがピッカーを開きそうなタイミングで呼び出します。たとえば、トリガーボタンのホバーやフォーカス時、またはアプリシェルのマウント時です。

## 表示するスプライトシートをウォームアップする

id を渡すと、マニフェストの準備ができた時点でそのスプライトシートをリクエストします。スキントーンのある絵文字では、`skinTone`
を渡して、ユーザーが目にするバリアントをウォームアップします。

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

最初にレンダリングする id だけをウォームアップしてください。数百の絵文字があるピッカーで、すべてをプリロードすべきではありません。スプライトシートはビューポートに近づくと遅延読み込み（`loading="lazy"`）されます。
`skinTone` は
`'default'`、`'light'`、`'medium-light'`、`'medium'`、`'medium-dark'`、 `'dark'`
のいずれかです。

## 先にアセットサイトを設定する

[セルフホストしたアセットサイト](self-host-the-assets.md)を使う場合は、`preloadEmojis`
の前に `configureEmojis`
を呼び出します。プリロードの後にアセットサイトを変更するとマニフェストがリセットされ、ウォームアップしたリクエストが無駄になります。

## ネットワークが失敗したとき

マニフェストのリクエストは 15 秒で諦めます。失敗したマニフェストは、次の
`preloadEmojis`
の呼び出し、次のマウント、またはブラウザがオンラインに戻ったときに再試行されるため、トリガーから再度呼び出しても安全です。[プリロード](../guide/assets.md#preloading)と
[フォールバック](../guide/behavior.md#fallback)を参照してください。
