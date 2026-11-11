---
title: 피커를 위해 프리로드하기
sourceHash: 727a2637d064bf30
---

emoji 피커가 열리기 전에 manifest와 sprite sheet를 미리 준비해 두면, 눈에 띄는
로딩 없이 emoji가 나타납니다.

## manifest를 일찍 준비하기

인수 없이 호출한 `preloadEmojis`는 어떤 `Emoji`가 렌더링되기 전에 manifest
가져오기를 시작합니다. reject되는 일이 없으므로 `void`만으로 충분합니다.

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

사용자가 피커를 열 가능성이 높은 시점에 호출하세요. 예를 들어 트리거 버튼에
호버하거나 포커스할 때, 또는 앱 셸이 마운트될 때입니다.

## 보여 줄 sprite sheet 준비하기

manifest가 준비되면 sprite sheet를 요청하도록 id를 전달하세요. 스킨 톤이 있는
emoji에서 사용자가 보게 될 변형을 미리 준비하려면 `skinTone`을 전달합니다.

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

가장 먼저 렌더링할 id만 미리 준비하세요. 수백 개의 emoji가 있는 피커라면 전부
프리로드하면 안 됩니다. sprite sheet는 뷰포트에 가까워질 때 지연
로딩(`loading="lazy"`)됩니다. `skinTone`은 `'default'`, `'light'`,
`'medium-light'`, `'medium'`, `'medium-dark'`, `'dark'` 중 하나입니다.

## 먼저 asset site 설정하기

[자체 호스팅한 asset site](self-host-the-assets.md)를 사용한다면
`preloadEmojis`보다 먼저 `configureEmojis`를 호출하세요. 프리로드 후에 asset
site를 바꾸면 manifest가 초기화되어, 미리 준비한 요청이 낭비됩니다.

## 네트워크가 실패할 때

manifest 요청은 15초 후에 포기합니다. 실패한 manifest는 다음 `preloadEmojis`
호출, 다음 마운트, 또는 브라우저가 다시 온라인이 될 때 재시도되므로, 트리거에서
다시 호출해도 안전합니다. [프리로드](../guide/assets.md#preloading)와
[fallback](../guide/behavior.md#fallback)을 참고하세요.
