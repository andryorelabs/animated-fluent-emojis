---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup` 不依赖 React，并与 `Emoji`
共用 manifest，因此在其旁边添加它的成本很低。每个函数都会加载 manifest，在无法加载时 resolve 为
`undefined` 或空数组，永远不会 reject：

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)` 解析单个表情，并将单个肤色修饰符映射为
  `skinTone`；混合肤色会解析为基础表情。`©` 或 `™`
  这类符号需要表情变体选择符（U+FE0F）才能匹配，而 ZWJ 序列即使缺少变体选择符也能匹配（minimally
  qualified）。
- 当多个目录条目共用同一个字形时，lookup 会返回规范表情：优先是以该字形码点作为 id 前缀的条目，其次是经过审核的覆盖项，再其次是目录顺序中的第一个条目。例如，
  `❤️`
  会解析为 heart，而不是复用该字形的某个变体。带有肤色时，它会回退到一个具有肤色的同级条目。
- `extractEmojis(text)`
  会找出文本中的每个目录表情，保持 ZWJ 序列完整，并给出其偏移量和长度。没有
  `Intl.Segmenter`
  时，它会回退到按码点分组的实现，且这两个函数都永远不会 reject。
- `searchEmojis(query, { limit })` 匹配描述，忽略大小写；`limit`
  默认为 20；不是正数的 `limit` 表示不限制，但 `0` 除外，它不返回任何结果。
