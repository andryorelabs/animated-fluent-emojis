---
title: Risoluzione dei problemi
sourceHash: c3ad7fa99dc76181
---

I problemi sono raggruppati in base a ciò che vedi, ciascuno con la causa nel
codice e una soluzione. Per l'API completa, consulta la
[guida all'uso](usage.md).

- [L'emoji compare ma non si anima mai](#lemoji-compare-ma-non-si-anima-mai)
- [Non viene renderizzato nulla, o compare solo il fallback](#non-viene-renderizzato-nulla-o-compare-solo-il-fallback)
- [Il manifest è bloccato dalla CSP o il browser è offline](#il-manifest-è-bloccato-dalla-csp-o-il-browser-è-offline)
- [Next.js segnala un errore per configureEmojis o Emoji](#nextjs-segnala-un-errore-per-configureemojis-o-emoji)
- [ERR_PACKAGE_PATH_NOT_EXPORTED o un errore di require](#err_package_path_not_exported-o-un-errore-di-require)
- [I test che renderizzano Emoji falliscono o non si animano mai in jsdom](#i-test-che-renderizzano-emoji-falliscono-o-non-si-animano-mai-in-jsdom)
- [bun run test fallisce perché manca Chromium](#bun-run-test-fallisce-perché-manca-chromium)
- [Vedi anche](#vedi-anche)

## L'emoji compare ma non si anima mai

**Sintomo:** Il poster frame viene renderizzato alla dimensione giusta, ma non
parte mai e non reagisce nemmeno a `playOnHover`.

**Causa:** Il keyframe `emoji-play` e le regole di hover si trovano in
`src/components/Emoji.module.css`, che viene distribuito come export separato
`style.css`. Il nome dell'animazione `emoji-play` e il suo keyframe provengono
entrambi dalla classe `.emojiImage` di quel foglio di stile. Lo stile inline di
`useEmojiAnimation` imposta soltanto la durata, il timing `steps()` e lo stato
di pausa: senza il foglio di stile nulla assegna un'animazione e lo sprite sheet
resta sul suo poster frame. Vedi [CSS](architecture.md#css).

Altri casi sembrano identici e non sono bug:

- L'utente preferisce il movimento ridotto. In quel caso `autoPlay` viene
  ignorato e l'emoji resta sul poster frame; solo `playing` lo sovrascrive.
- L'emoji è fuori schermo, la scheda è nascosta o l'immagine non è ancora stata
  caricata. L'autoplay attende tutte e tre le condizioni.

**Soluzione:** Importa il foglio di stile una sola volta, alla radice dell'app:

```js
import "animated-fluent-emojis/style.css";
```

Se lo hai già importato e l'emoji resta ferma, controlla l'impostazione di
movimento ridotto del sistema operativo.

## Non viene renderizzato nulla, o compare solo il fallback

**Sintomo:** `Emoji` non renderizza nulla, un riquadro vuoto, oppure il tuo nodo
`fallback` al posto dell'animazione.

**Causa:** `Emoji` legge la sua voce dallo store del manifest (`useEmojiStyle`),
che termina in uno di quattro stati:

- `loading`: un segnaposto vuoto, `aria-hidden`, della dimensione finale. Il
  manifest viene recuperato al primo utilizzo, con un timeout di 15 secondi.
- `missing`: l'id non è nel manifest. Renderizza `fallback`, oppure niente, e
  non chiama `onError`. In sviluppo registra `Unknown emoji id "<id>".` una sola
  volta per id. La causa abituale è un errore di battitura o un id di un'altra
  versione.
- `error`: la richiesta del manifest è fallita, è scaduta o ha risposto con uno
  stato non 2xx. Lo store registra nella console `Error fetching emoji data:`
  con il motivo, chiama `onError` senza evento e renderizza `fallback`, oppure
  niente. Il glyph di fallback richiede il manifest, quindi in questo stato non
  compare.
- `ready`, ma la richiesta dello sprite sheet fallisce: viene renderizzato il
  glyph di fallback (con etichetta `alt`), oppure il tuo `fallback`, e `onError`
  riceve l'evento dell'immagine.

**Soluzione:** Apri la console e la scheda di rete e cerca le righe sopra
indicate.

- Id sconosciuto: usa un id noto. `EmojiId` li suggerisce con
  l'autocompletamento e l'export `lookup` permette di cercarli (vedi
  [Lookup](guide/lookup.md)).
- Manifest non caricato: verifica che `<asset site>/v1/manifest.slim.json`
  risponda 200 dal browser. Un caricamento fallito viene ritentato al mount
  successivo, con `preloadEmojis` e quando il browser torna online.
- Passa un `fallback` se l'emoji non deve mai lasciare un buco nel layout. Vedi
  [Fallback](guide/behavior.md#fallback).

## Il manifest è bloccato dalla CSP o il browser è offline

**Sintomo:** La console mostra una violazione della Content Security Policy, un
errore di rete o `Failed to fetch the emoji manifest (<status>)`, e ogni `Emoji`
ricade sul fallback.

**Causa:** Il manifest viene richiesto con `fetch` da
`<assetSiteUrl>/v1/manifest.slim.json` (`fetchManifest` in
`src/utils/emoji-manifest.ts`), e gli sprite sheet vengono caricati come
immagini dalla stessa origin. Una policy senza quell'origin in `connect-src`
blocca il manifest, e una senza di essa in `img-src` blocca gli sprite. Offline,
il fetch viene rifiutato e lo store entra in `error`, poi riprova quando il
browser emette `online`. `configureEmojis` con un `assetSiteUrl` personalizzato
cambia l'origin che devi autorizzare.

**Soluzione:** Autorizza l'origin dell'asset site, per impostazione predefinita
`https://animated-fluent-emojis-cdn.andryore.dev`, in `connect-src` e `img-src`.
Le direttive esatte sono in [requisiti CSP](security.md#csp-requirements). Se
fai self-hosting, autorizza invece la tua origin e chiama `configureEmojis`
prima del rendering del primo `Emoji`. Vedi
[Asset site](guide/assets.md#asset-site).

## Next.js segnala un errore per configureEmojis o Emoji

**Sintomo:** Next.js interrompe la build o la pagina con un errore che indica
che una funzione viene chiamata dal server, citando `configureEmojis` o
`preloadEmojis`.

**Causa:** Il bundle pubblicato inizia con un banner `"use client";` (vedi
[Output della build](architecture.md#build-output)). Questo permette a un Server
Component di importare e renderizzare `<Emoji>`, che diventa un client
component, ma ogni export del bundle diventa allora un riferimento client.
Chiamare `configureEmojis` o `preloadEmojis` come funzione dentro un Server
Component chiede al server di eseguire codice client. Inoltre lo store del
manifest vive nella memoria del browser, quindi la chiamata non raggiungerebbe
comunque il client. L'export `lookup` non ha il banner, quindi può essere
importato sul server.

**Soluzione:** Chiama `configureEmojis` e `preloadEmojis` da un modulo che
inizia con `"use client"` e importa `style.css` una sola volta nel layout
radice. Vedi
[Next.js e server component](../README.md#nextjs-and-server-components) e la
[guida all'uso](usage.md).

## ERR_PACKAGE_PATH_NOT_EXPORTED o un errore di require

**Sintomo:** `ERR_PACKAGE_PATH_NOT_EXPORTED` ("No "exports" main defined"),
`Cannot find module` o `ERR_REQUIRE_ESM` quando carichi il pacchetto da
CommonJS.

**Causa:** Il pacchetto è solo ESM. `package.json` imposta `"type": "module"` e
una mappa `exports` con le condizioni `types` e `import`, senza condizione
`require` né campo `main`. Una chiamata `require('animated-fluent-emojis')`
fallisce mentre Node risolve la mappa degli exports, prima di verificare se il
file è ESM; per questo l'errore abituale è `ERR_PACKAGE_PATH_NOT_EXPORTED` e
`ERR_REQUIRE_ESM` compare solo in alcuni strumenti. Vedi
[ADR 0003](adr/0003-esm-only-and-vite-8.md).

**Soluzione:** Usa la sintassi `import`, da un file ESM o da un bundler. Ogni
toolchain React mantenuta (Vite, Next.js, Remix, webpack moderno) lo fa già. In
un file CommonJS, caricalo con un `import()` dinamico. Per Jest, che carica
CommonJS per impostazione predefinita, passa alla sua modalità ESM oppure a un
runner con supporto ESM nativo come Vitest.

## I test che renderizzano Emoji falliscono o non si animano mai in jsdom

**Sintomo:** Il test di un tuo componente fallisce per una richiesta di rete non
gestita o per un errore in console proveniente da `Emoji`, oppure un'asserzione
sull'animazione non passa mai in jsdom.

**Causa:** Due limiti distinti.

- **Il fetch del manifest.** Il primo rendering di `Emoji` recupera
  `<assetSiteUrl>/v1/manifest.slim.json`. Senza un mock raggiunge la rete o
  fallisce, e ogni `Emoji` finisce nello stato `error`. Lo store è inoltre stato
  del modulo, quindi un manifest caricato o fallito si propaga tra i test di uno
  stesso file.
- **L'animazione.** L'autoplay attende che l'immagine dello sprite sia caricata,
  e jsdom non carica le immagini per impostazione predefinita, quindi
  l'esecuzione resta in pausa. Manca anche un motore di animazioni CSS, quindi
  `animationend` non scatta mai da solo e `onPlaybackEnd` non viene chiamato.
  `IntersectionObserver` e `matchMedia` sono assenti in jsdom, e il componente
  lo gestisce: l'emoji conta come visibile sullo schermo e come senza preferenza
  per il movimento ridotto.

**Soluzione:** Fai il mock della richiesta del manifest e reimposta il modulo
tra un test e l'altro. Questo repository lo fa con MSW in
`src/utils/emoji-manifest.test.ts`:

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest` è la forma compatta del manifest slim; la fixture usata qui è
`src/test/manifest-fixture.ts`. Chiama `vi.resetModules()` in `afterEach` e
importa di nuovo il componente a ogni test per ottenere uno store pulito.
Verifica l'`img` renderizzato e i suoi stili di animazione inline, senza
affidarti a `animationend`. Per la riproduzione reale, usa un runner nel browser
come Vitest Browser Mode, come fa questo repository per i test dei componenti.

## bun run test fallisce perché manca Chromium

**Sintomo:** Per chi contribuisce: `bun run test` fallisce all'avvio con un
errore di Playwright che indica che l'eseguibile di Chromium non esiste.

**Causa:** I test di componenti e hook girano in Chromium headless tramite
Vitest Browser Mode e Playwright, e `bun install` non scarica il browser. Vedi
[Test](development.md#testing).

**Soluzione:** Installalo una sola volta:

```sh
bunx playwright install chromium
```

## Vedi anche

- [Guida all'uso](usage.md): props, comportamento del fallback, precaricamento e
  asset site.
- [Progettazione della sicurezza](security.md): i requisiti CSP e il modello
  delle minacce.
- [Architettura](architecture.md): lo store del manifest, il CSS e l'output
  della build.
- [Sviluppo](development.md): configurazione e test.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): perché il pacchetto è solo ESM.
