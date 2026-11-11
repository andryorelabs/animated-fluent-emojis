---
title: 문제 해결
sourceHash: c3ad7fa99dc76181
---

보이는 증상별로 문제를 묶고, 각각 코드상의 원인과 해결 방법을 적었습니다. 전체
API는 [사용 가이드](usage.md)를 참고하세요.

- [emoji는 보이지만 애니메이션이 재생되지 않을 때](#emoji는-보이지만-애니메이션이-재생되지-않을-때)
- [아무것도 렌더링되지 않거나 fallback만 보일 때](#아무것도-렌더링되지-않거나-fallback만-보일-때)
- [CSP가 manifest를 차단하거나 브라우저가 오프라인일 때](#csp가-manifest를-차단하거나-브라우저가-오프라인일-때)
- [Next.js가 configureEmojis 또는 Emoji에서 오류를 보고할 때](#nextjs가-configureemojis-또는-emoji에서-오류를-보고할-때)
- [ERR_PACKAGE_PATH_NOT_EXPORTED 또는 require 오류](#err_package_path_not_exported-또는-require-오류)
- [Emoji를 렌더링하는 테스트가 jsdom에서 실패하거나 애니메이션되지 않을 때](#emoji를-렌더링하는-테스트가-jsdom에서-실패하거나-애니메이션되지-않을-때)
- [Chromium이 없어서 bun run test가 실패할 때](#chromium이-없어서-bun-run-test가-실패할-때)
- [함께 보기](#함께-보기)

## emoji는 보이지만 애니메이션이 재생되지 않을 때

**증상:** 포스터 프레임은 올바른 크기로 렌더링되지만 재생되지 않고,
`playOnHover`에도 반응하지 않습니다.

**원인:** `emoji-play` 키프레임과 호버 규칙은
`src/components/Emoji.module.css`에 있으며, 이 파일은 별도의 `style.css`
export로 배포됩니다. `emoji-play` 애니메이션 이름과 그 키프레임은 모두 해당
스타일시트의 `.emojiImage` 클래스에서 옵니다. `useEmojiAnimation`의 인라인
스타일은 지속 시간, `steps()` 타이밍, 일시 정지 상태만 설정하므로, 스타일시트가
없으면 애니메이션을 지정하는 곳이 없어 sprite sheet가 포스터 프레임에 머뭅니다.
[CSS](architecture.md#css)를 참고하세요.

겉보기에는 같지만 버그가 아닌 경우도 있습니다.

- 사용자가 동작 줄이기를 선호합니다. 이 경우 `autoPlay`는 무시되고 emoji는
  포스터 프레임에 머뭅니다. `playing`만 이를 덮어씁니다.
- emoji가 화면 밖에 있거나, 탭이 숨겨져 있거나, 이미지가 아직 로드되지
  않았습니다. 자동 재생은 이 세 조건을 모두 기다립니다.

**해결:** 앱의 루트에서 스타일시트를 한 번 import하세요.

```js
import "animated-fluent-emojis/style.css";
```

이미 import했는데도 emoji가 멈춰 있다면 운영체제의 동작 줄이기 설정을
확인하세요.

## 아무것도 렌더링되지 않거나 fallback만 보일 때

**증상:** `Emoji`가 애니메이션 대신 아무것도 렌더링하지 않거나, 빈 상자, 또는
사용자가 지정한 `fallback` 노드를 렌더링합니다.

**원인:** `Emoji`는 manifest 스토어(`useEmojiStyle`)에서 항목을 읽으며, 스토어는
네 가지 상태 중 하나가 됩니다.

- `loading`: 최종 크기의 비어 있는 `aria-hidden` 플레이스홀더입니다. manifest는
  처음 사용할 때 가져오며, 타임아웃은 15초입니다.
- `missing`: id가 manifest에 없습니다. `fallback`을 렌더링하거나 아무것도
  렌더링하지 않으며 `onError`를 호출하지 않습니다. 개발 중에는 id당 한 번
  `Unknown emoji id "<id>".`를 로그로 남깁니다. 오타나 다른 버전의 id가 흔한
  원인입니다.
- `error`: manifest 요청이 실패했거나, 타임아웃되었거나, 2xx가 아닌 상태로
  응답했습니다. 스토어는 이유와 함께 `Error fetching emoji data:`를 콘솔에
  로그로 남기고, 이벤트 없이 `onError`를 호출하며, `fallback`을 렌더링하거나
  아무것도 렌더링하지 않습니다. fallback 글리프는 manifest가 필요하므로 이
  상태에서는 나타나지 않습니다.
- `ready`이지만 sprite sheet 요청이 실패한 경우: fallback 글리프(`alt`로
  레이블됨) 또는 사용자의 `fallback`을 렌더링하며, `onError`는 이미지 이벤트를
  받습니다.

**해결:** 콘솔과 네트워크 탭을 열고 위의 로그를 찾아보세요.

- 알 수 없는 id: 알려진 id를 사용하세요. `EmojiId`가 자동 완성해 주며, `lookup`
  export로 검색할 수도 있습니다([Lookup](guide/lookup.md) 참고).
- manifest 실패: 브라우저에서 `<asset site>/v1/manifest.slim.json`이 200으로
  응답하는지 확인하세요. 실패한 로드는 다음 마운트, `preloadEmojis`, 그리고
  브라우저가 다시 온라인이 될 때 재시도됩니다.
- emoji가 레이아웃에 빈 공간을 남기면 안 된다면 `fallback`을 전달하세요.
  [Fallback](guide/behavior.md#fallback)을 참고하세요.

## CSP가 manifest를 차단하거나 브라우저가 오프라인일 때

**증상:** 콘솔에 Content Security Policy 위반, 네트워크 오류 또는
`Failed to fetch the emoji manifest (<status>)`가 표시되고, 모든 `Emoji`가
fallback으로 대체됩니다.

**원인:** manifest는 `<assetSiteUrl>/v1/manifest.slim.json`에서 `fetch`로
요청하며 (`src/utils/emoji-manifest.ts`의 `fetchManifest`), sprite sheet는 같은
origin에서 이미지로 로드됩니다. `connect-src`에 해당 origin이 없는 정책은
manifest를 차단하고, `img-src`에 없는 정책은 sprite를 차단합니다. 오프라인이면
fetch가 reject되어 스토어가 `error` 상태가 되고, 브라우저가 `online`을
발생시키면 재시도합니다. 사용자 지정 `assetSiteUrl`과 함께 `configureEmojis`를
쓰면 허용해야 하는 origin이 바뀝니다.

**해결:** asset site origin(기본값은
`https://animated-fluent-emojis-cdn.andryore.dev`)을 `connect-src`와
`img-src`에서 허용하세요. 정확한 지시문은
[CSP 요구 사항](security.md#csp-requirements)에 있습니다. 자체 호스팅한다면 대신
자신의 origin을 허용하고, 첫 `Emoji`가 렌더링되기 전에 `configureEmojis`를
호출하세요. [Asset site](guide/assets.md#asset-site)를 참고하세요.

## Next.js가 configureEmojis 또는 Emoji에서 오류를 보고할 때

**증상:** Next.js가 서버에서 함수가 호출되고 있다는 오류로 빌드 또는 페이지를
실패시키며, `configureEmojis` 또는 `preloadEmojis`를 지목합니다.

**원인:** 배포된 번들은 `"use client";` 배너로
시작합니다([빌드 출력](architecture.md#build-output) 참고). 덕분에 Server
Component가 `<Emoji>`를 import해 렌더링할 수 있고, 이는 클라이언트 컴포넌트가
되지만, 번들의 모든 export는 클라이언트 참조가 됩니다. Server Component 안에서
`configureEmojis`나 `preloadEmojis`를 함수로 호출하면 서버에 클라이언트 코드를
실행하라고 요청하는 셈입니다. 게다가 manifest 스토어는 브라우저 메모리에
있으므로 그 호출은 어차피 클라이언트에 도달하지 못합니다. `lookup` export에는
배너가 없으므로 서버에서 import할 수 있습니다.

**해결:** `configureEmojis`와 `preloadEmojis`는 `"use client"`로 시작하는
모듈에서 호출하고, `style.css`는 루트 레이아웃에서 한 번 import하세요.
[Next.js와 서버 컴포넌트](../README.md#nextjs-and-server-components)와
[사용 가이드](usage.md)를 참고하세요.

## ERR_PACKAGE_PATH_NOT_EXPORTED 또는 require 오류

**증상:** CommonJS에서 패키지를 로드할 때 `ERR_PACKAGE_PATH_NOT_EXPORTED`("No
"exports" main defined"), `Cannot find module` 또는 `ERR_REQUIRE_ESM`이
발생합니다.

**원인:** 이 패키지는 ESM 전용입니다. `package.json`은 `"type": "module"`과
`types`, `import` 조건을 가진 `exports` 맵을 설정하며, `require` 조건이나 `main`
필드는 없습니다. `require('animated-fluent-emojis')` 호출은 Node가 파일이
ESM인지 확인하기 전에 exports 맵을 해석하는 단계에서 실패하므로, 보통
`ERR_PACKAGE_PATH_NOT_EXPORTED`가 발생하고 `ERR_REQUIRE_ESM`은 일부 도구에서만
나타납니다. [ADR 0003](adr/0003-esm-only-and-vite-8.md)을 참고하세요.

**해결:** ESM 파일이나 번들러에서 `import` 구문을 사용하세요. 유지보수되는 모든
React 툴체인(Vite, Next.js, Remix, 최신 webpack)은 이미 그렇게 합니다. CommonJS
파일에서는 동적 `import()`로 로드하세요. 기본적으로 CommonJS를 로드하는 Jest는
ESM 모드로 전환하거나, Vitest처럼 네이티브 ESM을 지원하는 러너로 바꾸세요.

## Emoji를 렌더링하는 테스트가 jsdom에서 실패하거나 애니메이션되지 않을 때

**증상:** 직접 만든 컴포넌트의 테스트가 처리되지 않은 네트워크 요청이나
`Emoji`의 콘솔 오류로 실패하거나, jsdom에서 애니메이션 assertion이 끝내 통과하지
않습니다.

**원인:** 서로 다른 두 가지 한계가 있습니다.

- **manifest fetch.** 첫 `Emoji` 렌더링은
  `<assetSiteUrl>/v1/manifest.slim.json`을 가져옵니다. mock이 없으면 네트워크를
  타거나 실패하며, 모든 `Emoji`가 `error` 상태로 끝납니다. 스토어는 모듈
  상태이기도 하므로, 로드되었거나 실패한 manifest가 한 파일 안의 테스트들 사이에
  이어집니다.
- **애니메이션.** 자동 재생은 sprite 이미지가 로드될 때까지 기다리는데, jsdom은
  기본적으로 이미지를 로드하지 않으므로 실행이 일시 정지된 채로 남습니다. CSS
  애니메이션 엔진도 없으므로 `animationend`가 저절로 발생하지 않고
  `onPlaybackEnd`도 호출되지 않습니다. jsdom에는 `IntersectionObserver`와
  `matchMedia`도 없는데, 컴포넌트가 이를 처리합니다. emoji는 화면 안에 있고 동작
  줄이기를 선호하지 않는 것으로 간주됩니다.

**해결:** manifest 요청을 mock하고 테스트 사이에 모듈을 초기화하세요. 이
저장소는 `src/utils/emoji-manifest.test.ts`에서 MSW로 처리합니다.

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest`는 압축된 slim manifest 형태이며, 여기서 사용한 fixture는
`src/test/manifest-fixture.ts`입니다. `afterEach`에서 `vi.resetModules()`를
호출하고 테스트마다 컴포넌트를 다시 import해 새 스토어를 얻으세요. 렌더링된
`img`와 그 인라인 애니메이션 스타일을 assert하고, `animationend`에 의존하지
마세요. 실제 재생이 필요하면 이 저장소가 컴포넌트 테스트에서 하듯 Vitest Browser
Mode 같은 브라우저 러너를 사용하세요.

## Chromium이 없어서 bun run test가 실패할 때

**증상:** 기여자 대상: `bun run test`가 시작 시 Chromium 실행 파일이 없다는
Playwright 오류와 함께 실패합니다.

**원인:** 컴포넌트와 훅 테스트는 Vitest Browser Mode와 Playwright를 통해
헤드리스 Chromium에서 실행되며, `bun install`은 브라우저를 다운로드하지
않습니다. [테스트](development.md#testing)를 참고하세요.

**해결:** 한 번만 설치하세요.

```sh
bunx playwright install chromium
```

## 함께 보기

- [사용 가이드](usage.md): props, fallback 동작, 프리로드, asset site.
- [보안 설계](security.md): CSP 요구 사항과 위협 모델.
- [아키텍처](architecture.md): manifest 스토어, CSS, 빌드 출력.
- [개발](development.md): 설정과 테스트.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): 패키지가 ESM 전용인 이유.
