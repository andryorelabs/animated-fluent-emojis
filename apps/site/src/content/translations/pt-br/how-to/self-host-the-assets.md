---
title: Hospede os assets por conta própria
sourceHash: 1fa3d7fdc9a470b6
---

Sirva o manifest e os sprite sheets a partir de uma origem que você controla e
aponte `Emoji` para ela. Use isto quando você não pode permitir uma origem de
terceiros na sua Content Security Policy, ou quando não quer depender do asset
site padrão. Os termos seguem o [`GLOSSARY.md`](../../GLOSSARY.md).

## Gere o site

O asset site é gerado por `apps/assets` em `apps/assets/dist-assets/`; nada do
que ele produz é versionado. A partir de um clone do repositório, execute
`bun run assets:build` (precisa do `ffmpeg`, consulte
[desenvolvimento](../development.md)) e publique o conteúdo de
`apps/assets/dist-assets/` em qualquer host estático. Mantenha o layout `v1/`, e
o arquivo `_headers` quando o seu host o suportar, porque ele faz cache dos
sprites endereçados por conteúdo como `immutable`. O layout está descrito em
[arquitetura](../architecture.md#asset-layout-v1).

Para publicar no Cloudflare Pages como este projeto faz, siga
[configure a hospedagem de assets](set-up-asset-hosting.md).

## Aponte o componente para ele

Chame `configureEmojis` uma vez, antes de o primeiro `Emoji` ser renderizado.
Uma barra final na URL é ignorada:

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

Chamá-lo depois de o manifest ter sido requisitado reinicia o manifest e emite
um aviso em desenvolvimento. Consulte a seção
[asset site](../guide/assets.md#asset-site) do guia de uso.

## Defina a Content Security Policy

Permita a sua origem nas duas diretivas. O manifest é buscado com fetch, e os
sprite sheets são carregados por `<img>`:

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

A URL do sprite é `<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`,
com `@2x` antes da extensão para um sprite sheet HD, então uma só origem cobre
ambos. Os adaptadores de framework não injetam nenhum elemento `<style>`, então
não precisam de permissão em `style-src`; o elemento `<fluent-emoji>` adiciona
um ao seu shadow root e precisa. O design e seus limites estão em
[segurança](../security.md#csp-requirements).

## Verifique

Abra a página com o painel de rede e confirme que a requisição do manifest vai
para `/v1/manifest.slim.json` na sua origem, e que nenhuma requisição vai para
`animated-fluent-emojis-cdn.andryore.dev`. Uma requisição bloqueada aparece como
uma violação de CSP no console, e o emoji renderiza o seu fallback; consulte
[fallback](../guide/behavior.md#fallback).
