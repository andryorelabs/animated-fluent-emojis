---
title: Lookup
sourceHash: 27d4efa631898e63
---

`animated-fluent-emojis/lookup`은 React에 의존하지 않으며 manifest를 `Emoji`와
공유하므로, 함께 추가해도 부담이 적습니다. 모든 함수는 manifest를 로드하며,
로드할 수 없으면 reject하지 않고 `undefined`나 빈 배열로 resolve합니다.

```js
import { extractEmojis, findEmojiByUnicode, searchEmojis } from "animated-fluent-emojis/lookup";

await findEmojiByUnicode("👍🏽"); // { id: 'yes', skinTone: 'medium' }
await extractEmojis("Hi 👋 there"); // [{ id, text, index, length }]
await searchEmojis("party", { limit: 5 }); // [{ id }]
```

- `findEmojiByUnicode(text)`는 emoji 하나를 찾고 단일 피부색 modifier를
  `skinTone`으로 매핑합니다. 서로 다른 피부색이 섞이면 기본 emoji로
  resolve됩니다. `©`나 `™` 같은 기호는 일치하려면 emoji variation
  selector(U+FE0F)가 필요하지만, ZWJ 시퀀스는 variation selector가 없어도
  일치합니다(minimally qualified).
- 여러 catalog 항목이 같은 glyph를 공유하면 lookup은 대표 emoji를 반환합니다.
  glyph의 코드 포인트가 접두사로 붙은 id, 없으면 검토된 override, 그것도 없으면
  catalog 순서의 첫 항목입니다. 예를 들어 `❤️`는 같은 glyph를 재사용하는 변형이
  아니라 하트로 resolve됩니다. 피부색이 있으면 피부색이 있는 형제 항목으로
  돌아갑니다.
- `extractEmojis(text)`는 텍스트에서 catalog의 모든 emoji를 ZWJ 시퀀스를 온전히
  유지한 채 오프셋과 길이와 함께 찾습니다. `Intl.Segmenter`가 없으면 코드 포인트
  그룹화로 대체하며, 두 함수 모두 reject하지 않습니다.
- `searchEmojis(query, { limit })`는 대소문자를 무시하고 설명과 일치시킵니다.
  `limit`의 기본값은 20이며, 양수가 아닌 `limit`은 제한 없음을 의미하지만 `0`은
  아무것도 반환하지 않습니다.
