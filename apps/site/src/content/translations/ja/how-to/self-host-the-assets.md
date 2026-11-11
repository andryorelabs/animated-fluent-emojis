---
title: アセットをセルフホストする
sourceHash: 1fa3d7fdc9a470b6
---

マニフェストとスプライトシートを自分で管理するオリジンから配信し、`Emoji`
をそこに向けます。Content Security
Policy でサードパーティのオリジンを許可できない場合や、デフォルトのアセットサイトに依存したくない場合に使います。用語は
[`GLOSSARY.md`](../../GLOSSARY.md) に従います。

## サイトをビルドする

アセットサイトは `apps/assets` が `apps/assets/dist-assets/`
に生成します。生成物はコミットされません。リポジトリのクローンから
`bun run assets:build` を実行し（`ffmpeg`
が必要です。[開発](../development.md)を参照）、 `apps/assets/dist-assets/`
の内容を任意の静的ホストに公開します。`v1/`
のレイアウトを保ち、ホストが対応していれば `_headers`
ファイルも置いてください。コンテンツアドレス指定のスプライトを `immutable`
としてキャッシュするためです。レイアウトは[アーキテクチャ](../architecture.md#asset-layout-v1)で説明しています。

このプロジェクトと同じように Cloudflare Pages に公開するには、
[アセットホスティングのセットアップ](set-up-asset-hosting.md)に従ってください。

## コンポーネントをそこに向ける

最初の `Emoji` がレンダリングされる前に、`configureEmojis`
を一度呼び出します。URLの末尾のスラッシュは無視されます。

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

マニフェストがリクエストされた後に呼び出すと、マニフェストがリセットされ、開発中は警告が出ます。使い方ガイドの[アセットサイト](../guide/assets.md#asset-site)のセクションを参照してください。

## Content Security Policy を設定する

両方のディレクティブで自分のオリジンを許可します。マニフェストは fetch で取得され、スプライトシートは
`<img>` 経由で読み込まれます。

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

スプライトの URL は `<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`
で、HD スプライトシートでは拡張子の前に `@2x`
が付くため、1 つのオリジンで両方をカバーできます。フレームワークアダプターは
`<style>` 要素を注入しないので、`style-src` の許可は不要です。`<fluent-emoji>`
要素はシャドウルートに 1 つ追加するため、許可が必要です。設計とその制限は[セキュリティ](../security.md#csp-requirements)にあります。

## 確認する

ネットワークパネルを開いてページを表示し、マニフェストのリクエストが自分のオリジンの
`/v1/manifest.slim.json` に送られていること、そして
`animated-fluent-emojis-cdn.andryore.dev`
へのリクエストがないことを確認します。ブロックされたリクエストはコンソールに CSP 違反として表示され、絵文字はフォールバックをレンダリングします。
[フォールバック](../guide/behavior.md#fallback)を参照してください。
