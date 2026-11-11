---
title: Solución de problemas
sourceHash: c3ad7fa99dc76181
---

Problemas agrupados por lo que ves, cada uno con la causa en el código y una
solución. Para la API completa consulta la [guía de uso](usage.md).

- [El emoji se muestra pero nunca se anima](#el-emoji-se-muestra-pero-nunca-se-anima)
- [No se renderiza nada, o solo aparece el fallback](#no-se-renderiza-nada-o-solo-aparece-el-fallback)
- [El manifest está bloqueado por la CSP o el navegador está sin conexión](#el-manifest-está-bloqueado-por-la-csp-o-el-navegador-está-sin-conexión)
- [Next.js informa un error para configureEmojis o Emoji](#nextjs-informa-un-error-para-configureemojis-o-emoji)
- [ERR_PACKAGE_PATH_NOT_EXPORTED o un error de require](#err_package_path_not_exported-o-un-error-de-require)
- [Las pruebas que renderizan Emoji fallan o nunca se animan en jsdom](#las-pruebas-que-renderizan-emoji-fallan-o-nunca-se-animan-en-jsdom)
- [bun run test falla porque falta Chromium](#bun-run-test-falla-porque-falta-chromium)
- [Ver también](#ver-también)

## El emoji se muestra pero nunca se anima

**Síntoma:** El poster frame se renderiza con el tamaño correcto, pero nunca se
reproduce y tampoco reacciona a `playOnHover`.

**Causa:** El keyframe `emoji-play` y las reglas de hover viven en
`src/components/Emoji.module.css`, que se distribuye como la exportación
independiente `style.css`. El nombre de animación `emoji-play` y su keyframe
provienen de la clase `.emojiImage` de esa hoja de estilos. El estilo en línea
de `useEmojiAnimation` solo define la duración, el timing `steps()` y el estado
de pausa, así que sin la hoja de estilos nada nombra una animación y el sprite
sheet se queda en su poster frame. Consulta [CSS](architecture.md#css).

Otros casos se ven igual y no son errores:

- El usuario prefiere movimiento reducido. Entonces `autoPlay` se ignora y el
  emoji descansa en su poster frame; solo `playing` lo anula.
- El emoji está fuera de pantalla, la pestaña está oculta o la imagen aún no se
  ha cargado. El autoplay espera a las tres condiciones.

**Solución:** Importa la hoja de estilos una sola vez, en la raíz de la app:

```js
import "animated-fluent-emojis/style.css";
```

Si ya la importaste y el emoji sigue quieto, revisa la configuración de
movimiento reducido del sistema operativo.

## No se renderiza nada, o solo aparece el fallback

**Síntoma:** `Emoji` no renderiza nada, una caja vacía o tu nodo `fallback` en
lugar de la animación.

**Causa:** `Emoji` lee su entrada del manifest store (`useEmojiStyle`), que
termina en uno de cuatro estados:

- `loading`: un marcador de posición vacío, `aria-hidden`, del tamaño final. El
  manifest se solicita en el primer uso, con un tiempo de espera de 15 segundos.
- `missing`: el id no está en el manifest. Renderiza `fallback`, o nada, y no
  llama a `onError`. En desarrollo registra `Unknown emoji id "<id>".` una vez
  por id. Lo más habitual es un error tipográfico o un id de otra versión.
- `error`: la solicitud del manifest falló, agotó el tiempo de espera o
  respondió con un estado distinto de 2xx. El store registra
  `Error fetching emoji data:` con el motivo en la consola, llama a `onError`
  sin un evento y renderiza `fallback`, o nada. El fallback glyph necesita el
  manifest, así que no aparece en este estado.
- `ready`, pero falla la solicitud del sprite sheet: se renderiza el fallback
  glyph (etiquetado con `alt`), o tu `fallback`, y `onError` recibe el evento de
  la imagen.

**Solución:** Abre la consola y la pestaña de red, y busca las líneas
anteriores.

- Id desconocido: usa un id conocido. `EmojiId` los autocompleta, y la
  exportación `lookup` puede buscarlos (consulta [Lookup](guide/lookup.md)).
- Manifest fallido: confirma que `<asset site>/v1/manifest.slim.json` responde
  200 desde el navegador. Una carga fallida se reintenta en el siguiente
  montaje, en `preloadEmojis` y cuando el navegador vuelve a estar en línea.
- Pasa un `fallback` si el emoji nunca debe dejar un hueco en el diseño.
  Consulta [Fallback](guide/behavior.md#fallback).

## El manifest está bloqueado por la CSP o el navegador está sin conexión

**Síntoma:** La consola muestra una violación de la Content Security Policy, un
error de red o `Failed to fetch the emoji manifest (<status>)`, y todos los
`Emoji` recurren al fallback.

**Causa:** El manifest se solicita con `fetch` desde
`<assetSiteUrl>/v1/manifest.slim.json` (`fetchManifest` en
`src/utils/emoji-manifest.ts`), y los sprite sheets se cargan como imágenes
desde el mismo origen. Una política sin ese origen en `connect-src` bloquea el
manifest, y una sin él en `img-src` bloquea los sprites. Sin conexión, el fetch
se rechaza y el store pasa a `error`, y luego reintenta cuando el navegador
dispara `online`. `configureEmojis` con un `assetSiteUrl` personalizado cambia
el origen que necesitas permitir.

**Solución:** Permite el origen del asset site, por defecto
`https://animated-fluent-emojis-cdn.andryore.dev`, en `connect-src` e `img-src`.
Las directivas exactas están en
[requisitos de CSP](security.md#csp-requirements). Si alojas tú mismo los
assets, permite tu propio origen y llama a `configureEmojis` antes de que se
renderice el primer `Emoji`. Consulta [Asset site](guide/assets.md#asset-site).

## Next.js informa un error para configureEmojis o Emoji

**Síntoma:** Next.js hace fallar la compilación o la página con un error que
indica que se está llamando a una función desde el servidor, y menciona
`configureEmojis` o `preloadEmojis`.

**Causa:** El bundle publicado comienza con un banner `"use client";` (consulta
[Build output](architecture.md#build-output)). Eso permite que un Server
Component importe y renderice `<Emoji>`, que se convierte en un client
component, pero entonces cada exportación del bundle es una referencia de
cliente. Llamar a `configureEmojis` o `preloadEmojis` como función dentro de un
Server Component le pide al servidor que ejecute código de cliente. Además, el
manifest store vive en la memoria del navegador, así que la llamada tampoco
llegaría al cliente. La exportación `lookup` no tiene banner, por lo que puede
importarse en el servidor.

**Solución:** Llama a `configureEmojis` y `preloadEmojis` desde un módulo que
empiece con `"use client"`, e importa `style.css` una sola vez en el layout
raíz. Consulta
[Next.js y server components](../README.md#nextjs-and-server-components) y la
[guía de uso](usage.md).

## ERR_PACKAGE_PATH_NOT_EXPORTED o un error de require

**Síntoma:** `ERR_PACKAGE_PATH_NOT_EXPORTED` ("No "exports" main defined"),
`Cannot find module` o `ERR_REQUIRE_ESM` al cargar el paquete desde CommonJS.

**Causa:** El paquete es solo ESM. `package.json` define `"type": "module"` y un
mapa `exports` con las condiciones `types` e `import`, sin condición `require`
ni campo `main`. Una llamada `require('animated-fluent-emojis')` falla mientras
Node resuelve el mapa de exports, antes de comprobar si el archivo es ESM, por
lo que `ERR_PACKAGE_PATH_NOT_EXPORTED` es el error habitual y `ERR_REQUIRE_ESM`
aparece solo en algunas herramientas. Consulta
[ADR 0003](adr/0003-esm-only-and-vite-8.md).

**Solución:** Usa la sintaxis `import`, desde un archivo ESM o un bundler. Todas
las toolchains de React vigentes (Vite, Next.js, Remix, webpack moderno) ya lo
hacen. En un archivo CommonJS, cárgalo con un `import()` dinámico. Para Jest,
que carga CommonJS por defecto, cambia a su modo ESM o a un runner con soporte
ESM nativo, como Vitest.

## Las pruebas que renderizan Emoji fallan o nunca se animan en jsdom

**Síntoma:** Una prueba de tu propio componente falla por una solicitud de red
sin manejar o un error de consola de `Emoji`, o una aserción de animación nunca
se cumple en jsdom.

**Causa:** Dos límites distintos.

- **La solicitud del manifest.** El primer render de `Emoji` solicita
  `<assetSiteUrl>/v1/manifest.slim.json`. Sin un mock, llega a la red o falla, y
  todos los `Emoji` terminan en el estado `error`. El store además es estado de
  módulo, así que un manifest cargado o fallido se arrastra entre pruebas de un
  mismo archivo.
- **La animación.** El autoplay espera a que la imagen del sprite se haya
  cargado, y jsdom no carga imágenes por defecto, así que la reproducción sigue
  en pausa. Tampoco hay un motor de animaciones CSS, por lo que `animationend`
  nunca se dispara por sí solo y no se llama a `onPlaybackEnd`.
  `IntersectionObserver` y `matchMedia` no existen en jsdom, algo que el
  componente maneja: el emoji cuenta como visible en pantalla y como que no
  prefiere movimiento reducido.

**Solución:** Simula la solicitud del manifest y reinicia el módulo entre
pruebas. Este repositorio lo hace con MSW en `src/utils/emoji-manifest.test.ts`:

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest` es la forma compacta del manifest slim; el fixture usado aquí
es `src/test/manifest-fixture.ts`. Llama a `vi.resetModules()` en `afterEach` e
importa el componente de nuevo en cada prueba para obtener un store limpio. Haz
aserciones sobre el `img` renderizado y sus estilos de animación en línea, y no
dependas de `animationend`. Para una reproducción real, usa un runner de
navegador como Vitest Browser Mode, como hace este repositorio en las pruebas de
sus componentes.

## bun run test falla porque falta Chromium

**Síntoma:** Para quienes contribuyen: `bun run test` falla al iniciar con un
error de Playwright que indica que no existe el ejecutable de Chromium.

**Causa:** Las pruebas de componentes y hooks se ejecutan en Chromium headless
mediante Vitest Browser Mode y Playwright, y `bun install` no descarga el
navegador. Consulta [Testing](development.md#testing).

**Solución:** Instálalo una sola vez:

```sh
bunx playwright install chromium
```

## Ver también

- [Guía de uso](usage.md): props, comportamiento del fallback, precarga y el
  asset site.
- [Diseño de seguridad](security.md): los requisitos de CSP y el modelo de
  amenazas.
- [Arquitectura](architecture.md): el manifest store, el CSS y el build output.
- [Desarrollo](development.md): configuración y pruebas.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): por qué el paquete es solo ESM.
