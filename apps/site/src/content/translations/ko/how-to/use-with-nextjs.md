---
title: Next.js에서 사용하기
sourceHash: 6f92dff657703a74
---

App Router에서 `Emoji`를 렌더링합니다. Server Component에서도 동작합니다.

## 스타일시트를 한 번만 import하기

스타일시트에는 애니메이션 keyframe이 들어 있습니다. 이것이 없으면 emoji는 정적인
sprite sheet로 보입니다. 루트 레이아웃에서 한 번만 import하세요.

```jsx
import "animated-fluent-emojis/style.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Server Component에서 Emoji 사용하기

번들이 `"use client";`로 시작하므로, 래퍼 파일 없이 Server Component에서
`Emoji`를 바로 import할 수 있습니다.

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

서버에서 `Emoji`는 최종 크기의 비어 있는 플레이스홀더를 렌더링하므로 레이아웃이
밀리지 않습니다. emoji는 hydration 이후에 나타납니다. manifest는 import 시점이
아니라 첫 렌더링 때 브라우저에서 가져오기 때문입니다. `onLoad`나 `onPlaybackEnd`
같은 함수는 Server Component에서 전달할 수 없습니다. 그런 경우에는 클라이언트
모듈에서 emoji를 렌더링하세요.

## 클라이언트 모듈에서 설정과 프리로드하기

`configureEmojis`와 `preloadEmojis`는 브라우저에서 실행되므로 Server Component가
아니라 `"use client"`로 시작하는 모듈에서 호출하세요. 루트 레이아웃에 마운트하는
작은 컴포넌트면 충분합니다.

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

레이아웃 콘텐츠 위에 `<EmojiSetup />`를 렌더링하세요. 기본 asset site를
사용한다면 `configureEmojis` 줄을 제거하세요. 첫 `Emoji`가 렌더링되기 전에
호출해야 합니다. 사용자 지정 origin에 맞는 Content Security Policy는
[asset 자체 호스팅하기](self-host-the-assets.md)를, 특정 id의 프리로드는
[피커를 위해 프리로드하기](preload-for-a-picker.md)를 참고하세요.

## Lookup

`animated-fluent-emojis/lookup`에는 React도 `"use client"` 배너도 없으므로
Server Component와 route handler에서도 동작합니다.
[lookup](../guide/lookup.md)을 참고하세요.
