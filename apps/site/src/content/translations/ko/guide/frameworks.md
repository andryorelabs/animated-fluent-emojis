---
title: Frameworks
sourceHash: a1c57a5023d0a080
---

패키지 하나에 프레임워크별 import 경로가 하나씩 있습니다. `configureEmojis`와
`preloadEmojis`는 프레임워크와 무관하며 `animated-fluent-emojis`에 그대로
있습니다. [프리로드](assets.md#preloading)와
[Asset site](assets.md#asset-site)를 참고하세요. 모든 adapter는 하나의 재생
코어를 공유하고 하나의 conformance suite를 통과하므로 props는 어디서나 똑같이
동작합니다. [ADR 0014](../adr/0014-multi-framework-support.md)를 참고하세요.

React, Vue, Svelte adapter와 `createEmoji`는 키프레임을
`animated-fluent-emojis/style.css`에서 읽으므로 한 번 import해야 합니다.
`<fluent-emoji>`와 Astro 컴포넌트는 자체 스타일을 포함합니다.

## React

React 하위 경로에서 `Emoji`를 import하세요.

```jsx
import { Emoji } from "animated-fluent-emojis/react";
import "animated-fluent-emojis/style.css";
```

0.6 이하에서 마이그레이션하는 경우: 루트 `Emoji` export는 0.6에서 더 이상
사용되지 않게(deprecated) 되었고 0.7에서 제거되었습니다. import 경로만 바꾸면
되며, props와 동작은 동일합니다. `EmojiProps` 타입도
`animated-fluent-emojis/react`로 옮겨졌습니다. `configureEmojis`와
`preloadEmojis`는 `animated-fluent-emojis`에 그대로 있습니다. React 18과 19를
지원하며, `react`와 `react-dom`은 선택적 peer입니다.

## Vue

Vue 3.3 이상이 필요합니다. `Emoji`는 아래 props를 camelCase로 받습니다.
`fallback` 슬롯은 이미지를 대체하며, 이벤트는 `load`, `error`,
`playbackEnd`입니다. `class`, `style`, `data-*` 같은 다른 속성은 루트 span에
전달됩니다.

```vue
<script setup lang="ts">
import { Emoji } from "animated-fluent-emojis/vue";

import "animated-fluent-emojis/style.css";

const handlePlaybackEnd = () => {
  console.log("done");
};
</script>

<template>
  <Emoji id="1f44b_wavinghand" :size="64" play-on-hover @playback-end="handlePlaybackEnd">
    <template #fallback><span>👋</span></template>
  </Emoji>
</template>
```

서버와 하이드레이션 중에는 최종 크기의 빈 플레이스홀더를 렌더링하므로 Nuxt에서도
동작합니다.

## Svelte

Svelte 5가 필요합니다. `Emoji`는 아래 props를 받으며, `fallback`은 snippet이고
`class`, `style`, `attributes`는 루트 span에 전달됩니다. 콜백은 `onLoad`,
`onError`, `onPlaybackEnd`입니다.

```svelte
<script lang="ts">
  import { Emoji } from 'animated-fluent-emojis/svelte'

  import 'animated-fluent-emojis/style.css'
</script>

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  {#snippet fallback()}<span>👋</span>{/snippet}
</Emoji>
```

서버에서는 플레이스홀더를, 하이드레이션 이후에는 emoji를 렌더링하므로
SvelteKit에서도 동작합니다. 패키지 export에는 컴포넌트 소스를 가리키는 `svelte`
조건이 있습니다.

## Astro

Astro 5 이상이 필요합니다. 컴포넌트는 빌드 시점에 emoji 마크업을 렌더링하므로
스크립트가 실행되기 전에 이미 sprite sheet가 HTML에 들어 있고, 작은 스크립트가
브라우저에서 재생을 시작합니다. 자체 스타일을 포함하므로 import할 스타일시트가
없습니다. id를 알 수 없거나 이미지가 실패하면 `fallback` 이름 있는 슬롯이
렌더링됩니다.

```astro
---
import Emoji from "animated-fluent-emojis/astro";
---

<Emoji id="1f44b_wavinghand" size={64} playOnHover>
  <span slot="fallback">👋</span>
</Emoji>
```

props는 아래에 나온 것과 같지만 콜백은 없고, `class`와 문자열 `style`이
추가됩니다. 루트 span은 콜백 대신 `emoji-load`, `emoji-error`, `playback-end`를
버블링되는 DOM 이벤트로 발생시킵니다. 브라우저 스크립트는
`astro:page-load`에서도 다시 실행되므로 뷰 전환(view transitions)도 계속
동작합니다.

<a id="plain-html"></a>

## 일반 HTML

`animated-fluent-emojis/element`를 import하면 `<fluent-emoji>`가 등록됩니다.
스타일시트는 필요 없으며, 키프레임은 shadow root 안에 있습니다.

```html
<script type="module">
  import "animated-fluent-emojis/element";
</script>

<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

속성은 props를 kebab-case로 그대로 반영합니다. `id`, `size`, `play-on-hover`,
`animation-iterations`, `auto-play`, `playing`, `skin-tone`, `alt`입니다.
boolean 속성은 값이 `false`가 아니면 켜진 것입니다. 같은 이름이 요소의 camelCase
프로퍼티로도 있으며(`element.playOnHover = true`), 프로퍼티를 설정해도 속성은
다시 쓰이지 않습니다. `slot="fallback"`이 있는 요소가 fallback입니다. 요소는
`emoji-load`, `emoji-error`, `playback-end`를 버블링되고 composed 되는 이벤트로
발생시킵니다.

요소가 정의되기 전에는 크기가 없습니다. 같은 진입점에서 export되는
`FLUENT_EMOJI_PRE_UPGRADE_CSS`를 페이지 CSS에 추가하면 `size` 속성(픽셀)으로
공간을 확보해 레이아웃 시프트를 피할 수 있습니다.

## Angular, Solid, Preact

이들은 각자의 템플릿 문법으로 `<fluent-emoji>`를 사용합니다.
[Angular](../how-to/use-with-angular.md), [Solid](../how-to/use-with-solid.md),
[Preact](../how-to/use-with-preact.md) how-to 가이드를 참고하세요. Lit, Alpine,
htmx도 마찬가지로 `animated-fluent-emojis/element`를 import하고 태그를 작성하면
됩니다.

## 프레임워크 없이

`createEmoji`는 임의의 DOM 노드에 렌더링하고 컨트롤러를 반환합니다. 모든
adapter의 프레임워크 독립 코어입니다. import해도 DOM을 건드리지 않습니다.

```js
import { createEmoji } from "animated-fluent-emojis";
import "animated-fluent-emojis/style.css";

const controller = createEmoji(document.querySelector("#slot"), {
  id: "1f44b_wavinghand",
  size: 64,
  fallback: () => document.createTextNode("👋"),
});

controller.update({ playing: false });
controller.destroy();
```

옵션은 아래 props에 더해, 루트 span을 위한 `className`, `style`, `attributes`,
`onLoad`, `onError`, `onPlaybackEnd` 콜백, 그리고 노드, 노드를 반환하는 함수
또는 `null`인 `fallback`입니다.
