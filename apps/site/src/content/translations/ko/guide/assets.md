---
title: Assets
sourceHash: 375cf7e40f14709c
---

## 이미지와 HD sprite sheet

sprite sheet는 `loading="lazy"`와 `decoding="async"`로 로드됩니다. HD sprite
sheet(200px 프레임)가 있는 emoji에는 너비 기반 `srcSet`(`100w`와 `200w`)도
추가되며 `sizes`는 렌더링된 크기(문자열 `size`는 `auto`)로 설정되므로,
브라우저는 고밀도 디스플레이에서 `@2x` sheet를 선택합니다.

<a id="preloading"></a>

## 프리로드

`preloadEmojis`는 어떤 `Emoji`가 렌더링되기 전에 manifest 가져오기를 시작하고,
id가 주어지면 준비되는 즉시 해당 sprite sheet를 요청합니다. reject되지 않습니다.

```js
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
void preloadEmojis(["1f44b_wavinghand", "1f525_fire"], { skinTone: "medium" });
```

`skinTone`은 피부색이 있는 emoji에서 미리 준비할 변형을 선택합니다.

## Asset site

기본적으로 manifest와 sprite sheet는
`https://animated-fluent-emojis-cdn.andryore.dev`에서 가져옵니다. 이전 주소인
`https://animated-fluent-emojis.pages.dev`도 계속 동작합니다. 자체 사본에서
제공하려면 첫 `Emoji`가 렌더링되기 전에 `configureEmojis`를 한 번 호출하세요.

```js
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```
