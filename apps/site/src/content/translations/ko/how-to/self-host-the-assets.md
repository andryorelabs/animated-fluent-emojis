---
title: asset 자체 호스팅하기
sourceHash: 1fa3d7fdc9a470b6
---

직접 관리하는 origin에서 manifest와 sprite sheet를 제공하고, `Emoji`가 그곳을
가리키도록 설정하세요. Content Security Policy에서 서드파티 origin을 허용할 수
없거나 기본 asset site에 의존하고 싶지 않을 때 사용합니다. 용어는
[`GLOSSARY.md`](../../GLOSSARY.md)를 따릅니다.

## site 빌드하기

asset site는 `apps/assets`가 `apps/assets/dist-assets/`에 생성하며, 생성된
결과물은 커밋하지 않습니다. 저장소를 clone한 뒤 `bun run assets:build`를
실행하고(`ffmpeg`가 필요합니다. [개발](../development.md) 참고),
`apps/assets/dist-assets/`의 내용을 아무 정적 호스트에나 게시하세요. `v1/`
레이아웃을 유지하고, 호스트가 지원한다면 `_headers` 파일도 함께 유지하세요. 이
파일이 콘텐츠 주소 기반 sprite를 `immutable`로 캐시하기 때문입니다. 레이아웃은
[아키텍처](../architecture.md#asset-layout-v1)에 설명되어 있습니다.

이 프로젝트처럼 Cloudflare Pages에 게시하려면
[asset 호스팅 설정](set-up-asset-hosting.md)을 따르세요.

## 컴포넌트가 그곳을 가리키게 하기

첫 `Emoji`가 렌더링되기 전에 `configureEmojis`를 한 번 호출하세요. URL 끝의
슬래시는 무시됩니다.

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

manifest가 이미 요청된 뒤에 호출하면 manifest가 초기화되고, 개발 중에는 경고가
표시됩니다. 사용 가이드의 [asset site](../guide/assets.md#asset-site) 섹션을
참고하세요.

## Content Security Policy 설정하기

두 지시문 모두에서 사용자의 origin을 허용하세요. manifest는 fetch로 가져오고,
sprite sheet는 `<img>`를 통해 로드됩니다.

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

sprite URL은 `<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`이며, HD
sprite sheet는 확장자 앞에 `@2x`가 붙습니다. 따라서 하나의 origin으로 둘 다
처리됩니다. 프레임워크 어댑터는 `<style>` 요소를 주입하지 않으므로 `style-src`
허용이 필요 없습니다. `<fluent-emoji>` 요소는 shadow root에 하나를 추가하므로
허용이 필요합니다. 설계와 한계는 [보안](../security.md#csp-requirements)에
있습니다.

## 확인하기

네트워크 패널을 열어 페이지를 확인하세요. manifest 요청이 사용자의 origin의
`/v1/manifest.slim.json`으로 가는지, 그리고
`animated-fluent-emojis-cdn.andryore.dev`로 가는 요청이 없는지 확인합니다.
차단된 요청은 콘솔에 CSP 위반으로 표시되고, emoji는 fallback을 렌더링합니다.
[fallback](../guide/behavior.md#fallback)을 참고하세요.
