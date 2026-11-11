---
title: Solução de problemas
sourceHash: c3ad7fa99dc76181
---

Problemas agrupados pelo que você vê, cada um com a causa no código e uma
solução. Para a API completa, consulte o [guia de uso](usage.md).

- [O emoji aparece, mas nunca anima](#o-emoji-aparece-mas-nunca-anima)
- [Nada é renderizado, ou só o fallback aparece](#nada-é-renderizado-ou-só-o-fallback-aparece)
- [O manifest é bloqueado pela CSP ou o navegador está offline](#o-manifest-é-bloqueado-pela-csp-ou-o-navegador-está-offline)
- [O Next.js informa um erro para configureEmojis ou Emoji](#o-nextjs-informa-um-erro-para-configureemojis-ou-emoji)
- [ERR_PACKAGE_PATH_NOT_EXPORTED ou um erro de require](#err_package_path_not_exported-ou-um-erro-de-require)
- [Testes que renderizam Emoji falham ou nunca animam no jsdom](#testes-que-renderizam-emoji-falham-ou-nunca-animam-no-jsdom)
- [bun run test falha porque falta o Chromium](#bun-run-test-falha-porque-falta-o-chromium)
- [Veja também](#veja-também)

## O emoji aparece, mas nunca anima

**Sintoma:** O poster frame é renderizado no tamanho certo, mas nunca é
reproduzido, e também não reage a `playOnHover`.

**Causa:** O keyframe `emoji-play` e as regras de hover ficam em
`src/components/Emoji.module.css`, que é distribuído como a exportação separada
`style.css`. O nome da animação `emoji-play` e o seu keyframe vêm ambos da
classe `.emojiImage` dessa folha de estilo. O estilo inline de
`useEmojiAnimation` só define a duração, o timing `steps()` e o estado de pausa;
sem a folha de estilo, nada nomeia uma animação e o sprite sheet fica no poster
frame. Consulte [CSS](architecture.md#css).

Outros casos têm a mesma aparência e não são bugs:

- O usuário prefere movimento reduzido. Nesse caso `autoPlay` é ignorado e o
  emoji fica parado no poster frame; só `playing` o sobrescreve.
- O emoji está fora da tela, a aba está oculta ou a imagem ainda não carregou. O
  autoplay espera pelas três condições.

**Solução:** Importe a folha de estilo uma vez, na raiz do app:

```js
import "animated-fluent-emojis/style.css";
```

Se você a importou e o emoji continua parado, verifique a configuração de
movimento reduzido do sistema operacional.

## Nada é renderizado, ou só o fallback aparece

**Sintoma:** `Emoji` não renderiza nada, uma caixa vazia, ou o seu nó `fallback`
em vez da animação.

**Causa:** `Emoji` lê sua entrada do manifest store (`useEmojiStyle`), que
termina em um de quatro estados:

- `loading`: um placeholder vazio, `aria-hidden`, do tamanho final. O manifest é
  buscado no primeiro uso, com um timeout de 15 segundos.
- `missing`: o id não está no manifest. Renderiza `fallback`, ou nada, e não
  chama `onError`. Em desenvolvimento, registra `Unknown emoji id "<id>".` uma
  vez por id. Um erro de digitação ou um id de outra versão é a causa usual.
- `error`: a requisição do manifest falhou, expirou ou respondeu com um status
  que não é 2xx. O store registra `Error fetching emoji data:` com o motivo no
  console, chama `onError` sem um evento e renderiza `fallback`, ou nada. O
  glifo de fallback precisa do manifest, então não aparece nesse estado.
- `ready`, mas a requisição do sprite sheet falha: o glifo de fallback é
  renderizado (rotulado com `alt`), ou o seu `fallback`, e `onError` recebe o
  evento da imagem.

**Solução:** Abra o console e a aba de rede e procure as linhas acima.

- Id desconhecido: use um id conhecido. `EmojiId` os autocompleta, e a
  exportação `lookup` pode pesquisá-los (consulte [Lookup](guide/lookup.md)).
- Manifest com falha: confirme que `<asset site>/v1/manifest.slim.json` responde
  200 a partir do navegador. Um carregamento com falha é repetido na próxima
  montagem, em `preloadEmojis` e quando o navegador volta a ficar online.
- Passe um `fallback` se o emoji nunca puder deixar um buraco no layout.
  Consulte [Fallback](guide/behavior.md#fallback).

## O manifest é bloqueado pela CSP ou o navegador está offline

**Sintoma:** O console mostra uma violação de Content Security Policy, um erro
de rede ou `Failed to fetch the emoji manifest (<status>)`, e todo `Emoji` usa o
fallback.

**Causa:** O manifest é requisitado com `fetch` em
`<assetSiteUrl>/v1/manifest.slim.json` (`fetchManifest` em
`src/utils/emoji-manifest.ts`), e os sprite sheets são carregados como imagens
da mesma origem. Uma política sem essa origem em `connect-src` bloqueia o
manifest, e uma sem ela em `img-src` bloqueia os sprites. Offline, o fetch é
rejeitado e o store entra em `error`, e tenta de novo quando o navegador dispara
`online`. `configureEmojis` com um `assetSiteUrl` personalizado muda a origem
que você precisa permitir.

**Solução:** Permita a origem do asset site, por padrão
`https://animated-fluent-emojis-cdn.andryore.dev`, em `connect-src` e `img-src`.
As diretivas exatas estão nos [requisitos de CSP](security.md#csp-requirements).
Se você hospeda por conta própria, permita a sua origem e chame
`configureEmojis` antes de o primeiro `Emoji` ser renderizado. Consulte
[Asset site](guide/assets.md#asset-site).

## O Next.js informa um erro para configureEmojis ou Emoji

**Sintoma:** O Next.js falha o build ou a página com um erro dizendo que uma
função está sendo chamada a partir do servidor, citando `configureEmojis` ou
`preloadEmojis`.

**Causa:** O bundle publicado começa com um banner `"use client";` (consulte
[Build output](architecture.md#build-output)). Isso permite que um Server
Component importe e renderize `<Emoji>`, que se torna um client component, mas
então toda exportação do bundle é uma referência de cliente. Chamar
`configureEmojis` ou `preloadEmojis` como função dentro de um Server Component
pede ao servidor que execute código de cliente. O manifest store também vive na
memória do navegador, então a chamada não chegaria ao cliente de qualquer forma.
A exportação `lookup` não tem o banner, então pode ser importada no servidor.

**Solução:** Chame `configureEmojis` e `preloadEmojis` a partir de um módulo que
comece com `"use client"`, e importe `style.css` uma vez no layout raiz.
Consulte
[Next.js e server components](../README.md#nextjs-and-server-components) e o
[guia de uso](usage.md).

## ERR_PACKAGE_PATH_NOT_EXPORTED ou um erro de require

**Sintoma:** `ERR_PACKAGE_PATH_NOT_EXPORTED` ("No "exports" main defined"),
`Cannot find module` ou `ERR_REQUIRE_ESM` ao carregar o pacote a partir de
CommonJS.

**Causa:** O pacote é somente ESM. O `package.json` define `"type": "module"` e
um mapa `exports` com as condições `types` e `import`, sem condição `require`
nem campo `main`. Uma chamada `require('animated-fluent-emojis')` falha enquanto
o Node resolve o mapa de exports, antes de verificar se o arquivo é ESM, então
`ERR_PACKAGE_PATH_NOT_EXPORTED` é o erro usual e `ERR_REQUIRE_ESM` aparece
apenas em algumas ferramentas. Consulte
[ADR 0003](adr/0003-esm-only-and-vite-8.md).

**Solução:** Use a sintaxe `import`, a partir de um arquivo ESM ou de um
bundler. Toda toolchain React mantida (Vite, Next.js, Remix, webpack moderno) já
faz isso. Em um arquivo CommonJS, carregue-o com um `import()` dinâmico. Para o
Jest, que carrega CommonJS por padrão, mude para o modo ESM dele ou para um
runner com suporte nativo a ESM, como o Vitest.

## Testes que renderizam Emoji falham ou nunca animam no jsdom

**Sintoma:** Um teste do seu próprio componente falha por uma requisição de rede
não tratada ou por um erro de console vindo de `Emoji`, ou uma asserção de
animação nunca passa no jsdom.

**Causa:** Dois limites separados.

- **A requisição do manifest.** A primeira renderização de `Emoji` busca
  `<assetSiteUrl>/v1/manifest.slim.json`. Sem um mock, ela vai à rede ou falha,
  e todo `Emoji` termina no estado `error`. O store também é estado do módulo,
  então um manifest carregado ou com falha passa de um teste para outro no mesmo
  arquivo.
- **Animação.** O autoplay espera até a imagem do sprite carregar, e o jsdom não
  carrega imagens por padrão, então a execução fica pausada. Também não há um
  motor de animação CSS, então `animationend` nunca é disparado sozinho e
  `onPlaybackEnd` não é chamado. `IntersectionObserver` e `matchMedia` não
  existem no jsdom, o que o componente trata: o emoji conta como visível na tela
  e como não preferindo movimento reduzido.

**Solução:** Faça um mock da requisição do manifest e reinicie o módulo entre os
testes. Este repositório faz isso com MSW em `src/utils/emoji-manifest.test.ts`:

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest` é o formato compacto do slim manifest; o fixture usado aqui é
`src/test/manifest-fixture.ts`. Chame `vi.resetModules()` em `afterEach` e
importe o componente de novo a cada teste para obter um store novo. Faça
asserções sobre o `img` renderizado e seus estilos de animação inline, e não
dependa de `animationend`. Para reprodução real, use um runner de navegador como
o Vitest Browser Mode, como este repositório faz nos testes de componentes.

## bun run test falha porque falta o Chromium

**Sintoma:** Para quem contribui: `bun run test` falha na inicialização com um
erro do Playwright dizendo que o executável do Chromium não existe.

**Causa:** Os testes de componentes e hooks rodam no Chromium headless por meio
do Vitest Browser Mode e do Playwright, e o `bun install` não baixa o navegador.
Consulte [Testing](development.md#testing).

**Solução:** Instale-o uma vez:

```sh
bunx playwright install chromium
```

## Veja também

- [Guia de uso](usage.md): props, comportamento do fallback, preload e o asset
  site.
- [Design de segurança](security.md): os requisitos de CSP e o modelo de
  ameaças.
- [Arquitetura](architecture.md): o manifest store, o CSS e o build output.
- [Desenvolvimento](development.md): configuração e testes.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): por que o pacote é somente ESM.
