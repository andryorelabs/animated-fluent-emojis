---
title: アセット
sourceHash: 375cf7e40f14709c
---

## Images and HD sprite sheets

sprite sheet は `loading="lazy"` と `decoding="async"` で読み込まれます。HD
sprite sheet（200px フレーム）を持つ絵文字には、幅ベースの `srcSet`（`100w` と
`200w`）も付き、`sizes` にはレンダリングされるサイズが設定されます（文字列の
`size` の場合は `auto`）。これにより、高密度ディスプレイではブラウザーが `@2x`
のシートを選びます。

## Preloading

`preloadEmojis` は、どの `Emoji`
がレンダリングされるよりも前に manifest の取得を開始し、id が渡された場合は、準備ができた時点でそれらの sprite
sheet をリクエストします。reject されることはありません。

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone`
は、スキントーンを持つ絵文字について、ウォームアップするバリエーションを選びます。

## Asset site

デフォルトでは、manifest と sprite sheet は
`https://animated-fluent-emojis-cdn.andryore.dev`
から取得されます。以前のアドレスである
`https://animated-fluent-emojis.pages.dev`
も引き続き使えます。独自のコピーから配信するには、最初の `Emoji`
がレンダリングされる前に、`configureEmojis` を一度だけ呼び出します。

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
