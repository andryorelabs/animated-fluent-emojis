---
title: Die Assets selbst hosten
sourceHash: 1fa3d7fdc9a470b6
---

Liefere das Manifest und die Sprite Sheets von einem Origin aus, den du
kontrollierst, und richte `Emoji` darauf aus. Nutze das, wenn du in deiner
Content Security Policy keinen Drittanbieter-Origin erlauben kannst oder nicht
von der Standard-Asset-Site abhängen möchtest. Die Begriffe folgen
[`GLOSSARY.md`](../../GLOSSARY.md).

## Die Site bauen

Die Asset Site wird von `apps/assets` nach `apps/assets/dist-assets/` generiert;
nichts davon wird eingecheckt. Führe in einem Klon des Repositorys
`bun run assets:build` aus (es braucht `ffmpeg`, siehe
[Entwicklung](../development.md)) und veröffentliche den Inhalt von
`apps/assets/dist-assets/` auf einem beliebigen statischen Host. Behalte das
Layout `v1/` bei, und die Datei `_headers`, wenn dein Host sie unterstützt, denn
sie cached die inhaltsadressierten Sprites als `immutable`. Das Layout ist in
[Architektur](../architecture.md#asset-layout-v1) beschrieben.

Um wie dieses Projekt auf Cloudflare Pages zu veröffentlichen, folge
[Asset-Hosting einrichten](set-up-asset-hosting.md).

## Die Komponente darauf ausrichten

Rufe `configureEmojis` einmal auf, bevor das erste `Emoji` gerendert wird. Ein
abschließender Schrägstrich in der URL wird ignoriert:

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

Wird es aufgerufen, nachdem das Manifest angefordert wurde, setzt es das
Manifest zurück und warnt in der Entwicklung. Siehe den Abschnitt
[Asset site](../guide/assets.md#asset-site) im Nutzungsleitfaden.

## Die Content Security Policy festlegen

Erlaube deinen Origin in beiden Direktiven. Das Manifest wird per Fetch geladen,
und die Sprite Sheets werden über `<img>` geladen:

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

Die Sprite-URL lautet
`<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`, mit `@2x` vor der
Dateiendung bei einem HD-Sprite-Sheet, ein Origin deckt also beide ab. Die
Framework-Adapter fügen kein `<style>`-Element ein und brauchen daher keine
`style-src`-Freigabe; das Element `<fluent-emoji>` fügt eines in sein Shadow
Root ein und braucht sie. Das Design und seine Grenzen stehen in
[Sicherheit](../security.md#csp-requirements).

## Überprüfen

Öffne die Seite mit dem Netzwerk-Panel und prüfe, dass die Manifest-Anfrage an
`/v1/manifest.slim.json` auf deinem Origin geht und dass keine Anfrage an
`animated-fluent-emojis-cdn.andryore.dev` geht. Eine blockierte Anfrage
erscheint in der Konsole als CSP-Verletzung, und das Emoji rendert seinen
Fallback; siehe [Fallback](../guide/behavior.md#fallback).
