---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

パッケージは 1 つで、フレームワークごとにインポートパスが 1 つあります。`configureEmojis`
と `preloadEmojis` はフレームワークに依存せず、`animated-fluent-emojis`
に置かれています。[Preloading](assets.md#preloading) と
[Asset site](assets.md#asset-site)
を参照してください。すべてのアダプターは 1 つの再生コアを共有し、1 つの適合性スイートに合格しているため、props はどこでも同じように動作します。[ADR 0014](../adr/0014-multi-framework-support.md)
を参照してください。

React、Vue、Svelte のアダプターと `createEmoji` は、キーフレームを
`animated-fluent-emojis/style.css`
から読み込みます。一度だけインポートしてください。`<fluent-emoji>`
と Astro コンポーネントは、独自のスタイルを内包しています。

## React

React のサブパスから `Emoji` をインポートします。

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

0.6 以前からの移行：ルートの `Emoji`
エクスポートは 0.6 で非推奨となり、0.7 で削除されました。インポートパスを変更するだけで、ほかに変更は不要です。props と動作は同一です。`EmojiProps`
型も `animated-fluent-emojis/react` に移動しました。`configureEmojis` と
`preloadEmojis` は `animated-fluent-emojis` に残っています。React
18 と 19 に対応しており、`react` と `react-dom` はオプションの peer です。

## Vue

Vue 3.3 以降が必要です。`Emoji`
は、以下の props を camelCase で受け取ります。`fallback`
スロットは画像を置き換え、イベントは `load`、`error`、`playbackEnd`
です。`class`、`style`、`data-*`
などのその他の属性は、ルートの span に渡されます。

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

サーバー上とハイドレーション中は、最終的なサイズの空のプレースホルダーをレンダリングするため、Nuxt でも動作します。

## Svelte

Svelte 5 が必要です。`Emoji` は以下の props を受け取ります。`fallback`
は snippet で、`class`、`style`、`attributes`
はルートの span に渡されます。コールバックは
`onLoad`、`onError`、`onPlaybackEnd` です。

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

サーバーではプレースホルダーを、ハイドレーション後には絵文字をレンダリングするため、SvelteKit でも動作します。パッケージのエクスポートには、コンポーネントのソースを指す
`svelte` condition があります。

## Astro

Astro
5 以降が必要です。コンポーネントはビルド時に絵文字のマークアップをレンダリングするため、スクリプトが実行される前から sprite が HTML に含まれます。そして、小さなスクリプトがブラウザーで再生を開始します。独自のスタイルを内包しているので、インポートするスタイルシートはありません。`fallback`
という名前付きスロットは、id が不明な場合や画像の読み込みに失敗した場合にレンダリングされます。

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

props は以下のものからコールバックを除いたもので、`class` と文字列の `style`
があります。ルートの span は、コールバックの代わりに
`emoji-load`、`emoji-error`、`playback-end`
を、バブリングする DOM イベントとしてディスパッチします。ブラウザースクリプトは
`astro:page-load`
でも再実行されるため、ビュートランジションも引き続き動作します。

## Plain HTML

`animated-fluent-emojis/element` をインポートすると、`<fluent-emoji>`
が登録されます。スタイルシートは不要で、キーフレームはシャドウルートの中にあります。

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

属性は props をケバブケースで反映したものです。`id`、`size`、`play-on-hover`、`animation-iterations`、`auto-play`、`playing`、`skin-tone`、`alt`
があります。真偽値の属性は、値が `false`
でない限りオンです。同じ名前が、要素の camelCase プロパティとしても存在します（`element.playOnHover = true`）。プロパティを設定しても、属性は書き換えられません。`slot="fallback"`
を持つ要素が fallback になります。要素は
`emoji-load`、`emoji-error`、`playback-end`
を、バブリングし composed なイベントとしてディスパッチします。

要素が定義されるまでは、サイズがありません。同じエントリーからエクスポートされている
`FLUENT_EMOJI_PRE_UPGRADE_CSS` をページの CSS に追加すると、`size`
属性（ピクセル単位）から占有領域を確保でき、レイアウトシフトを防げます。

## Angular, Solid and Preact

これらは、それぞれのテンプレート構文を通じて `<fluent-emoji>`
を使います。[Angular](../how-to/use-with-angular.md)、[Solid](../how-to/use-with-solid.md)、[Preact](../how-to/use-with-preact.md)
のハウツーガイドを参照してください。Lit、Alpine、htmx も同様で、`animated-fluent-emojis/element`
をインポートしてタグを書きます。

## Without a framework

`createEmoji`
は任意の DOM ノードにレンダリングし、コントローラーを返します。これはすべてのアダプターに共通する、フレームワーク非依存のコアです。インポートしても DOM には一切触れません。

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

オプションは以下の props に加えて、ルートの span 用の
`className`、`style`、`attributes`、`onLoad`、`onError`、`onPlaybackEnd`
のコールバック、そしてノード、ノードを返す関数、または `null` のいずれかを取る
`fallback` です。
