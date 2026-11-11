---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup` は React に依存せず、`Emoji`
と manifest を共有するため、`Emoji`
と併せて追加しても軽量です。すべての関数は manifest を読み込み、読み込めない場合は
`undefined` または空の配列で解決され、reject されることはありません。

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` は 1 つの絵文字を解決し、単一のスキントーン修飾子を
  `skinTone`
  にマッピングします。異なるトーンが混在する場合は、基本の絵文字に解決されます。`©`
  や `™`
  などの記号は、一致させるために絵文字バリエーションセレクター（U+FE0F）が必要ですが、ZWJ シーケンスは、バリエーションセレクターがなくても一致します（minimally
  qualified）。
- 複数のカタログエントリーが同じグリフを共有している場合、lookup は正規の絵文字を返します。つまり、グリフのコードポイントを接頭辞とする id、それがなければレビュー済みのオーバーライド、それもなければカタログ順で最初のエントリーです。たとえば
  `❤️`
  は、そのグリフを再利用しているバリアントではなく、ハートに解決されます。スキントーンを指定した場合は、トーンを持つ兄弟エントリーにフォールバックします。
- `extractEmojis(text)`
  は、テキスト内のカタログにあるすべての絵文字を、ZWJ シーケンスを分割せずに、オフセットと長さとともに見つけます。`Intl.Segmenter`
  がない場合は、コードポイントのグルーパーにフォールバックし、どちらの関数も reject されることはありません。
- `searchEmojis(query, { limit })`
  は、大文字と小文字を区別せずに説明文に一致させます。`limit`
  のデフォルトは 20 で、正の数でない `limit` は無制限を意味しますが、`0`
  だけは何も返しません。
