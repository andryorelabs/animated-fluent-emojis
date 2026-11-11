---
title: Solid에서 사용하기
sourceHash: 7d4f24852e28d756
---

Solid에서는 `<fluent-emoji>` 요소로 emoji를 렌더링합니다. Solid 전용 adapter는
없습니다.

## 요소 등록하기

요소 엔트리를 한 번만 import하세요. 예를 들어 엔트리 모듈에서 import합니다.
`<fluent-emoji>`가 등록되며 스타일시트는 필요 없습니다.

```tsx
import "animated-fluent-emojis/element";
```

## 태그 사용하기

패키지는 요소의 kebab-case attribute로 `solid-js`의 JSX 타입을 확장합니다.
이벤트를 수신하려면 `on:`을 사용하세요. Solid가 이를 요소에 직접 연결합니다.

```tsx
export function Greeting() {
  return (
    <fluent-emoji
      id="1f44b_wavinghand"
      size={64}
      play-on-hover
      on:playback-end={() => {
        console.log("done");
      }}
    />
  );
}
```

fallback은 `slot="fallback"`이 지정된 자식으로 전달하고, `ref`로 요소를 얻을 수
있습니다.

```tsx
<fluent-emoji
  id="1f44b_wavinghand"
  ref={(element) => {
    element.playing = false;
  }}
>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

attribute, property, 이벤트의 전체 목록은
[사용 가이드](../guide/frameworks.md#plain-html)에 있습니다.
