---
title: Angular에서 사용하기
sourceHash: 45537066a981f484
---

Angular에서는 `<fluent-emoji>` 요소로 emoji를 렌더링합니다. Angular 전용
adapter는 없습니다. 이 요소는 custom element를 지원하는 모든 Angular 버전에서
동작합니다.

## 요소 등록하기

요소 엔트리를 한 번만 import하세요. 예를 들어 `main.ts`에서 import합니다.
import하면 `<fluent-emoji>`가 등록됩니다. 요소는 shadow root 안에 자체 스타일을
가지고 있으므로 따로 import할 스타일시트는 없습니다.

```ts
import "animated-fluent-emojis/element";
```

## 컴포넌트에서 태그 허용하기

컴포넌트에서 custom element를 허용하지 않으면 Angular는 알 수 없는 태그를
거부합니다.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-greeting",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover />`,
})
export class GreetingComponent {}
```

## property 바인딩과 이벤트 수신

동적인 값에는 property 바인딩을 사용하세요. 그러면 Angular가 attribute를 다시
쓰는 대신 요소의 property를 설정합니다. 이벤트는 `emoji-load`, `emoji-error`,
`playback-end`입니다.

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

attribute, property, 이벤트의 전체 목록은
[사용 가이드](../guide/frameworks.md#plain-html)에 있습니다. 요소가
업그레이드되기 전에 공간을 확보하려면 전역 CSS에
`FLUENT_EMOJI_PRE_UPGRADE_CSS`를 추가하세요. 로딩, fallback, 재생 동작은
[사용 가이드](../usage.md)의 나머지 부분을 참고하세요.
