---
title: トラブルシューティング
sourceHash: c3ad7fa99dc76181
---

問題は目に見える症状ごとにまとめ、それぞれにコード上の原因と対処法を載せています。APIの全体像は[使い方ガイド](usage.md)を参照してください。

- [絵文字は表示されるがアニメーションしない](#絵文字は表示されるがアニメーションしない)
- [何も表示されない、またはフォールバックだけが表示される](#何も表示されないまたはフォールバックだけが表示される)
- [マニフェストが CSP にブロックされる、またはブラウザがオフラインである](#マニフェストが-csp-にブロックされるまたはブラウザがオフラインである)
- [Next.js が configureEmojis または Emoji でエラーを報告する](#nextjs-が-configureemojis-または-emoji-でエラーを報告する)
- [ERR_PACKAGE_PATH_NOT_EXPORTED または require エラー](#err_package_path_not_exported-または-require-エラー)
- [Emoji をレンダリングするテストが jsdom で失敗する、またはアニメーションしない](#emoji-をレンダリングするテストが-jsdom-で失敗するまたはアニメーションしない)
- [Chromium がなく bun run test が失敗する](#chromium-がなく-bun-run-test-が失敗する)
- [関連情報](#関連情報)

## 絵文字は表示されるがアニメーションしない

**症状:**
ポスターフレームは正しいサイズで表示されますが、再生されず、`playOnHover`
にも反応しません。

**原因:** `emoji-play` キーフレームとホバーのルールは
`src/components/Emoji.module.css` にあり、これは別のエクスポート `style.css`
として配布されます。`emoji-play`
というアニメーション名とそのキーフレームは、どちらもこのスタイルシートの
`.emojiImage` クラスに由来します。`useEmojiAnimation`
が付けるインラインスタイルが設定するのは、継続時間、`steps()`
のタイミング、一時停止の状態だけです。そのためスタイルシートがないと、アニメーションを指定するものがなく、スプライトシートはポスターフレームのままになります。
[CSS](architecture.md#css)を参照してください。

見た目は同じでも、バグではないケースもあります。

- ユーザーがモーションの低減を希望している場合。このとき `autoPlay`
  は無視され、絵文字はポスターフレームで静止します。上書きできるのは `playing`
  だけです。
- 絵文字が画面外にある、タブが非表示である、または画像がまだ読み込まれていない場合。自動再生は、この 3 つの条件がそろうまで待ちます。

**対処法:** スタイルシートを、アプリのルートで一度だけインポートします。

```js
import "animated-fluent-emojis/style.css";
```

インポート済みなのに絵文字が静止したままなら、オペレーティングシステムのモーション低減の設定を確認してください。

## 何も表示されない、またはフォールバックだけが表示される

**症状:** `Emoji`
が何もレンダリングしない、空のボックスになる、またはアニメーションの代わりに
`fallback` ノードが表示されます。

**原因:** `Emoji`
はマニフェストストア（`useEmojiStyle`）から自分のエントリを読み取ります。ストアは次の 4 つの状態のいずれかになります。

- `loading`: 最終サイズの、空で `aria-hidden`
  のプレースホルダー。マニフェストは初回の使用時に取得され、タイムアウトは 15 秒です。
- `missing`: その id がマニフェストにありません。`fallback`、なければ何もレンダリングせず、
  `onError` も呼びません。開発中は、id ごとに一度だけ `Unknown emoji id "<id>".`
  をログに出します。タイプミスや、別バージョンの id が通常の原因です。
- `error`: マニフェストのリクエストが失敗した、タイムアウトした、または 2xx 以外のステータスが返りました。ストアは理由とともに
  `Error fetching emoji data:` をコンソールに出力し、イベントなしで `onError`
  を呼び、`fallback`、なければ何もレンダリングしません。フォールバックのグリフにはマニフェストが必要なので、この状態では表示されません。
- `ready`
  だがスプライトシートのリクエストが失敗した場合: フォールバックのグリフ（`alt`
  のラベル付き）、または `fallback` がレンダリングされ、`onError`
  には画像イベントが渡されます。

**対処法:** コンソールとネットワークタブを開き、上記の行を探します。

- 不明な id: 有効な id を使います。`EmojiId` が候補を補完し、`lookup`
  エクスポートで検索できます（[Lookup](guide/lookup.md)を参照）。
- マニフェストの失敗: ブラウザから `<asset site>/v1/manifest.slim.json`
  が 200 を返すことを確認します。失敗した読み込みは、次のマウント時、`preloadEmojis`
  の呼び出し時、ブラウザがオンラインに戻ったときに再試行されます。
- 絵文字がレイアウトに穴を空けてはならない場合は、`fallback` を渡します。
  [Fallback](guide/behavior.md#fallback)を参照してください。

## マニフェストが CSP にブロックされる、またはブラウザがオフラインである

**症状:** コンソールに Content Security Policy 違反、ネットワークエラー、または
`Failed to fetch the emoji manifest (<status>)` が表示され、すべての `Emoji`
がフォールバックになります。

**原因:** マニフェストは `fetch` で `<assetSiteUrl>/v1/manifest.slim.json`
（`src/utils/emoji-manifest.ts` の
`fetchManifest`）から取得され、スプライトシートは同じオリジンから画像として読み込まれます。
`connect-src` にそのオリジンがないポリシーはマニフェストをブロックし、`img-src`
にないポリシーはスプライトをブロックします。オフラインでは fetch が拒否され、ストアは
`error` 状態になり、ブラウザが `online`
を発火すると再試行します。`configureEmojis` でカスタムの `assetSiteUrl`
を指定すると、許可が必要なオリジンも変わります。

**対処法:** アセットサイトのオリジン（デフォルトは
`https://animated-fluent-emojis-cdn.andryore.dev`）を、`connect-src` と
`img-src` で許可します。正確なディレクティブは
[CSP の要件](security.md#csp-requirements)にあります。セルフホストする場合は、代わりに自分のオリジンを許可し、最初の
`Emoji` がレンダリングされる前に `configureEmojis`
を呼び出してください。[Asset site](guide/assets.md#asset-site)を参照してください。

## Next.js が configureEmojis または Emoji でエラーを報告する

**症状:**
Next.js がビルドまたはページで、サーバーから関数が呼び出されているというエラーを出し、
`configureEmojis` または `preloadEmojis` を名指しします。

**原因:** 公開されるバンドルは `"use client";`
バナーで始まります（[ビルド出力](architecture.md#build-output)を参照）。これにより Server
Component から `<Emoji>`
をインポートしてレンダリングでき、クライアントコンポーネントになりますが、バンドルのすべてのエクスポートはクライアント参照になります。Server
Component の中で `configureEmojis` や `preloadEmojis`
を関数として呼ぶと、サーバーにクライアントコードの実行を求めることになります。マニフェストストアはブラウザのメモリ上にもあるため、そもそも呼び出しはクライアントに届きません。
`lookup` エクスポートにはバナーがないので、サーバーでインポートできます。

**対処法:** `configureEmojis` と `preloadEmojis` は、`"use client"`
で始まるモジュールから呼び出し、`style.css`
はルートレイアウトで一度だけインポートします。
[Next.js とサーバーコンポーネント](../README.md#nextjs-and-server-components)と
[使い方ガイド](usage.md)を参照してください。

## ERR_PACKAGE_PATH_NOT_EXPORTED または require エラー

**症状:**
CommonJS からパッケージを読み込むときに、`ERR_PACKAGE_PATH_NOT_EXPORTED` （"No
"exports" main defined"）、`Cannot find module`、または `ERR_REQUIRE_ESM`
が出ます。

**原因:** このパッケージは ESM 専用です。`package.json` は `"type": "module"`
と、`types` と `import` の条件を持つ `exports` マップを設定しており、`require`
条件も `main` フィールドもありません。`require('animated-fluent-emojis')`
の呼び出しは、ファイルが ESM かどうかを確認する前に、Node が exports マップを解決する段階で失敗します。そのため通常のエラーは
`ERR_PACKAGE_PATH_NOT_EXPORTED` で、`ERR_REQUIRE_ESM`
が出るのは一部のツールだけです。
[ADR 0003](adr/0003-esm-only-and-vite-8.md)を参照してください。

**対処法:** ESM ファイルまたはバンドラーから `import`
構文を使います。メンテナンスされている React のツールチェーン（Vite、Next.js、Remix、最新の webpack）はすべて、すでにそうしています。CommonJS ファイルでは、動的な
`import()`
で読み込みます。デフォルトで CommonJS を読み込む Jest では、ESM モードに切り替えるか、Vitest のようにネイティブ ESM をサポートするランナーに切り替えてください。

## Emoji をレンダリングするテストが jsdom で失敗する、またはアニメーションしない

**症状:** 自分のコンポーネントのテストが、未処理のネットワークリクエストや
`Emoji`
からのコンソールエラーで失敗する、または jsdom でアニメーションのアサーションが通りません。

**原因:** 2 つの別々の制約があります。

- **マニフェストの fetch。** 最初の `Emoji` のレンダリングで
  `<assetSiteUrl>/v1/manifest.slim.json`
  を取得します。モックがないとネットワークに出るか失敗し、すべての `Emoji` が
  `error`
  状態になります。ストアはモジュールの状態でもあるため、読み込み済みまたは失敗したマニフェストは、同じファイル内のテスト間で引き継がれます。
- **アニメーション。**
  自動再生はスプライト画像が読み込まれるまで待ちますが、jsdomはデフォルトでは画像を読み込まないため、実行は一時停止のままです。CSSアニメーションエンジンもないので、`animationend`
  は自然には発火せず、`onPlaybackEnd` も呼ばれません。jsdom には
  `IntersectionObserver` と `matchMedia`
  がありませんが、コンポーネントはこれを処理します。絵文字は画面内にあり、モーション低減を希望していないものとして扱われます。

**対処法:**
マニフェストのリクエストをモックし、テスト間でモジュールをリセットします。このリポジトリでは、`src/utils/emoji-manifest.test.ts`
で MSW を使っています。

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest`
はコンパクトなスリムマニフェストの形です。ここで使っているフィクスチャは
`src/test/manifest-fixture.ts` です。`afterEach` で `vi.resetModules()`
を呼び、テストごとにコンポーネントを再度インポートして、新しいストアを得ます。レンダリングされた
`img` とそのインラインのアニメーションスタイルに対してアサートし、`animationend`
には頼らないでください。実際の再生には、このリポジトリのコンポーネントテストと同じく、Vitest
Browser Mode のようなブラウザランナーを使います。

## Chromium がなく bun run test が失敗する

**症状:** コントリビューター向け: `bun run test`
が起動時に、Chromium の実行ファイルが存在しないという Playwright のエラーで失敗します。

**原因:** コンポーネントとフックのテストは、Vitest Browser
Mode と Playwright を通じてヘッドレス Chromium で実行され、`bun install`
はブラウザをダウンロードしません。
[テスト](development.md#testing)を参照してください。

**対処法:** 一度だけインストールします。

```sh
bunx playwright install chromium
```

## 関連情報

- [使い方ガイド](usage.md):
  props、フォールバックの動作、プリロード、アセットサイト。
- [セキュリティ設計](security.md): CSP の要件と脅威モデル。
- [アーキテクチャ](architecture.md): マニフェストストア、CSS、ビルド出力。
- [開発](development.md): セットアップとテスト。
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): このパッケージが ESM 専用である理由。
