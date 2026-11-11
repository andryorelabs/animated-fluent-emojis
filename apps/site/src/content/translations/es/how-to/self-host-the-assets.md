---
title: Aloja los assets tú mismo
sourceHash: 1fa3d7fdc9a470b6
---

Sirve el manifest y los sprite sheets desde un origen que controles, y apunta
`Emoji` hacia él. Úsalo cuando no puedas permitir un origen de terceros en tu
Content Security Policy, o cuando no quieras depender del asset site por
defecto. Los términos siguen [`GLOSSARY.md`](../../GLOSSARY.md).

## Compila el sitio

El asset site lo genera `apps/assets` en `apps/assets/dist-assets/`; nada de lo
que produce se versiona. Desde un clon del repositorio, ejecuta
`bun run assets:build` (necesita `ffmpeg`, consulta
[desarrollo](../development.md)) y publica el contenido de
`apps/assets/dist-assets/` en cualquier host estático. Conserva la estructura
`v1/`, y el archivo `_headers` cuando tu host lo admita, porque cachea los
sprites direccionados por contenido como `immutable`. La estructura se describe
en [arquitectura](../architecture.md#asset-layout-v1).

Para publicar en Cloudflare Pages como lo hace este proyecto, sigue
[configurar el hosting de assets](set-up-asset-hosting.md).

## Apunta el componente hacia él

Llama a `configureEmojis` una sola vez, antes de que se renderice el primer
`Emoji`. Se ignora una barra final en la URL:

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

Si se llama después de que se solicitó el manifest, este se reinicia y se emite
una advertencia en desarrollo. Consulta la sección
[asset site](../guide/assets.md#asset-site) de la guía de uso.

## Define la Content Security Policy

Permite tu origen en ambas directivas. El manifest se solicita con fetch, y los
sprite sheets se cargan mediante `<img>`:

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

La URL del sprite es `<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`,
con `@2x` antes de la extensión para un sprite sheet HD, así que un solo origen
cubre ambos. Los adaptadores de framework no inyectan ningún elemento `<style>`,
por lo que no necesitan permiso en `style-src`; el elemento `<fluent-emoji>`
agrega uno a su shadow root y sí lo necesita. El diseño y sus límites están en
[seguridad](../security.md#csp-requirements).

## Verifica

Abre la página con el panel de red y comprueba que la solicitud del manifest va
a `/v1/manifest.slim.json` en tu origen, y que ninguna solicitud va a
`animated-fluent-emojis-cdn.andryore.dev`. Una solicitud bloqueada aparece como
una violación de CSP en la consola, y el emoji renderiza su fallback; consulta
[fallback](../guide/behavior.md#fallback).
