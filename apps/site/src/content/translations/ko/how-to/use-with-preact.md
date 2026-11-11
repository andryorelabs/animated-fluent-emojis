---
title: Preact에서 사용하기
sourceHash: 690f9a4ab5451009
---

Preact에서 emoji를 사용하는 방법은 두 가지입니다. `<fluent-emoji>` 요소를
사용하거나, `preact/compat`을 통해 React adapter를 사용하는 것입니다.

## 요소

요소 엔트리를 한 번만 import하세요. `<fluent-emoji>`가 등록되며 스타일시트는
필요 없습니다.

```tsx
import "animated-fluent-emojis/element";
```

패키지는 요소의 kebab-case attribute로 `preact`의 JSX 타입을 확장합니다.

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

fallback은 `slot="fallback"`이 지정된 자식으로 전달하세요. `emoji-load`,
`emoji-error`, `playback-end`에 반응하려면 `ref`로 얻은 요소에서
`addEventListener`를 호출하세요.

```tsx
import { useEffect, useRef } from "preact/hooks";

export function Greeting() {
  const emoji = useRef<HTMLElementTagNameMap["fluent-emoji"]>(null);

  useEffect(() => {
    const element = emoji.current;
    const onEnd = () => {
      console.log("done");
    };
    element?.addEventListener("playback-end", onEnd);
    return () => element?.removeEventListener("playback-end", onEnd);
  }, []);

  return (
    <fluent-emoji id="1f44b_wavinghand" ref={emoji}>
      <span slot="fallback">👋</span>
    </fluent-emoji>
  );
}
```

attribute, property, 이벤트의 전체 목록은
[사용 가이드](../guide/frameworks.md#plain-html)에 있습니다.

## React adapter

번들러에서 `react`와 `react-dom`을 `preact/compat`의 alias로 설정한 다음,
[사용 가이드](../guide/frameworks.md#react)에 설명된 대로 React adapter를
사용하세요.
