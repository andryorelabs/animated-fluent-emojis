---
title: Ospitare gli asset in autonomia
sourceHash: 1fa3d7fdc9a470b6
---

Servi il manifest e gli sprite sheet da un'origin che controlli, e punta `Emoji`
verso di essa. Usalo quando non puoi autorizzare un'origin di terze parti nella
tua Content Security Policy, o quando non vuoi dipendere dall'asset site
predefinito. I termini seguono [`GLOSSARY.md`](../../GLOSSARY.md).

## Compila il sito

L'asset site viene generato da `apps/assets` in `apps/assets/dist-assets/`;
nulla di ciò che produce viene committato. Da un clone del repository, esegui
`bun run assets:build` (richiede `ffmpeg`, vedi [sviluppo](../development.md)) e
pubblica il contenuto di `apps/assets/dist-assets/` su qualsiasi host statico.
Mantieni il layout `v1/`, e il file `_headers` quando il tuo host lo supporta,
perché mette in cache gli sprite indirizzati per contenuto come `immutable`. Il
layout è descritto in [architettura](../architecture.md#asset-layout-v1).

Per pubblicare su Cloudflare Pages come fa questo progetto, segui
[configurare l'hosting degli asset](set-up-asset-hosting.md).

## Punta il componente verso di esso

Chiama `configureEmojis` una sola volta, prima che venga renderizzato il primo
`Emoji`. Una barra finale nell'URL viene ignorata:

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

Se la chiami dopo che il manifest è stato richiesto, il manifest viene
reimpostato e in sviluppo compare un avviso. Vedi la sezione
[asset site](../guide/assets.md#asset-site) della guida all'uso.

## Imposta la Content Security Policy

Autorizza la tua origin in entrambe le direttive. Il manifest viene recuperato
con fetch e gli sprite sheet vengono caricati tramite `<img>`:

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

L'URL dello sprite è `<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`,
con `@2x` prima dell'estensione per uno sprite sheet HD, quindi una sola origin
copre entrambi. Gli adapter per i framework non iniettano alcun elemento
`<style>`, quindi non richiedono permessi in `style-src`; l'elemento
`<fluent-emoji>` ne aggiunge uno al suo shadow root e li richiede. Il design e i
suoi limiti sono in [sicurezza](../security.md#csp-requirements).

## Verifica

Apri la pagina con il pannello di rete e controlla che la richiesta del manifest
vada a `/v1/manifest.slim.json` sulla tua origin, e che nessuna richiesta vada a
`animated-fluent-emojis-cdn.andryore.dev`. Una richiesta bloccata compare come
violazione CSP nella console, e l'emoji renderizza il suo fallback; vedi
[fallback](../guide/behavior.md#fallback).
