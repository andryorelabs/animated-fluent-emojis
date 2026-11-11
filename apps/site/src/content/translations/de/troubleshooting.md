---
title: Fehlerbehebung
sourceHash: c3ad7fa99dc76181
---

Probleme, gruppiert nach dem, was du siehst, jeweils mit der Ursache im Code und
einer Lösung. Die vollständige API findest du im [Nutzungsleitfaden](usage.md).

- [Das Emoji wird angezeigt, animiert aber nie](#das-emoji-wird-angezeigt-animiert-aber-nie)
- [Es wird nichts gerendert, oder nur der Fallback erscheint](#es-wird-nichts-gerendert-oder-nur-der-fallback-erscheint)
- [Das Manifest wird von der CSP blockiert oder der Browser ist offline](#das-manifest-wird-von-der-csp-blockiert-oder-der-browser-ist-offline)
- [Next.js meldet einen Fehler bei configureEmojis oder Emoji](#nextjs-meldet-einen-fehler-bei-configureemojis-oder-emoji)
- [ERR_PACKAGE_PATH_NOT_EXPORTED oder ein require-Fehler](#err_package_path_not_exported-oder-ein-require-fehler)
- [Tests, die Emoji rendern, schlagen in jsdom fehl oder animieren nie](#tests-die-emoji-rendern-schlagen-in-jsdom-fehl-oder-animieren-nie)
- [bun run test schlägt fehl, weil Chromium fehlt](#bun-run-test-schlägt-fehl-weil-chromium-fehlt)
- [Siehe auch](#siehe-auch)

## Das Emoji wird angezeigt, animiert aber nie

**Symptom:** Das Poster Frame wird in der richtigen Größe gerendert, wird aber
nie abgespielt und reagiert auch nicht auf `playOnHover`.

**Ursache:** Das Keyframe `emoji-play` und die Hover-Regeln liegen in
`src/components/Emoji.module.css`, das als separater Export `style.css`
ausgeliefert wird. Der Animationsname `emoji-play` und sein Keyframe stammen
beide aus der Klasse `.emojiImage` in diesem Stylesheet. Der Inline-Style aus
`useEmojiAnimation` setzt nur die Dauer, das `steps()`-Timing und den
Pausenzustand. Ohne das Stylesheet benennt also nichts eine Animation, und das
Sprite Sheet bleibt auf seinem Poster Frame. Siehe [CSS](architecture.md#css).

Andere Fälle sehen genauso aus und sind keine Bugs:

- Die Person bevorzugt reduzierte Bewegung. `autoPlay` wird dann ignoriert und
  das Emoji ruht auf seinem Poster Frame; nur `playing` hebt das auf.
- Das Emoji liegt außerhalb des sichtbaren Bereichs, der Tab ist verborgen oder
  das Bild ist noch nicht geladen. Autoplay wartet auf alle drei Bedingungen.

**Lösung:** Importiere das Stylesheet einmal, im Root der App:

```js
import "animated-fluent-emojis/style.css";
```

Wenn du es importiert hast und das Emoji trotzdem ruht, prüfe die Einstellung
für reduzierte Bewegung im Betriebssystem.

## Es wird nichts gerendert, oder nur der Fallback erscheint

**Symptom:** `Emoji` rendert nichts, eine leere Box oder deinen `fallback`-Node
statt der Animation.

**Ursache:** `Emoji` liest seinen Eintrag aus dem Manifest-Store
(`useEmojiStyle`), der in einem von vier Zuständen endet:

- `loading`: ein leerer, `aria-hidden` Platzhalter in der endgültigen Größe. Das
  Manifest wird bei der ersten Verwendung geladen, mit einem Timeout von 15
  Sekunden.
- `missing`: die ID steht nicht im Manifest. Es wird `fallback` gerendert, oder
  nichts, und `onError` wird nicht aufgerufen. In der Entwicklung wird einmal
  pro ID `Unknown emoji id "<id>".` geloggt. Meist ist ein Tippfehler oder eine
  ID aus einer anderen Version die Ursache.
- `error`: die Manifest-Anfrage ist fehlgeschlagen, hat das Timeout
  überschritten oder mit einem Nicht-2xx-Status geantwortet. Der Store loggt
  `Error fetching emoji data:` mit dem Grund in die Konsole, ruft `onError` ohne
  Event auf und rendert `fallback`, oder nichts. Das Fallback-Glyph braucht das
  Manifest und erscheint in diesem Zustand daher nicht.
- `ready`, aber die Anfrage für das Sprite Sheet schlägt fehl: Das
  Fallback-Glyph wird gerendert (mit `alt` beschriftet), oder dein `fallback`,
  und `onError` erhält das Bild-Event.

**Lösung:** Öffne die Konsole und den Netzwerk-Tab und suche nach den oben
genannten Zeilen.

- Unbekannte ID: Verwende eine bekannte ID. `EmojiId` vervollständigt sie
  automatisch, und der Export `lookup` kann sie durchsuchen (siehe
  [Lookup](guide/lookup.md)).
- Fehlgeschlagenes Manifest: Prüfe, dass `<asset site>/v1/manifest.slim.json`
  vom Browser aus mit 200 antwortet. Ein fehlgeschlagener Ladevorgang wird beim
  nächsten Mount, bei `preloadEmojis` und beim Wiederverbinden des Browsers
  erneut versucht.
- Übergib einen `fallback`, wenn das Emoji nie eine Lücke im Layout hinterlassen
  darf. Siehe [Fallback](guide/behavior.md#fallback).

## Das Manifest wird von der CSP blockiert oder der Browser ist offline

**Symptom:** Die Konsole zeigt eine Verletzung der Content Security Policy,
einen Netzwerkfehler oder `Failed to fetch the emoji manifest (<status>)`, und
jedes `Emoji` fällt auf den Fallback zurück.

**Ursache:** Das Manifest wird per `fetch` von
`<assetSiteUrl>/v1/manifest.slim.json` angefordert (`fetchManifest` in
`src/utils/emoji-manifest.ts`), und die Sprite Sheets werden als Bilder vom
selben Origin geladen. Eine Policy ohne diesen Origin in `connect-src` blockiert
das Manifest, und eine ohne ihn in `img-src` blockiert die Sprites. Offline wird
der Fetch abgelehnt und der Store wechselt in `error`. Sobald der Browser
`online` auslöst, versucht er es erneut. `configureEmojis` mit einer eigenen
`assetSiteUrl` ändert den Origin, den du erlauben musst.

**Lösung:** Erlaube den Origin der Asset Site, standardmäßig
`https://animated-fluent-emojis-cdn.andryore.dev`, in `connect-src` und
`img-src`. Die genauen Direktiven stehen unter
[CSP-Anforderungen](security.md#csp-requirements). Wenn du selbst hostest,
erlaube stattdessen deinen eigenen Origin und rufe `configureEmojis` auf, bevor
das erste `Emoji` gerendert wird. Siehe
[Asset site](guide/assets.md#asset-site).

## Next.js meldet einen Fehler bei configureEmojis oder Emoji

**Symptom:** Next.js bricht den Build oder die Seite mit einem Fehler ab, dass
eine Funktion vom Server aus aufgerufen wird, und nennt dabei `configureEmojis`
oder `preloadEmojis`.

**Ursache:** Das veröffentlichte Bundle beginnt mit einem `"use client";`-Banner
(siehe [Build output](architecture.md#build-output)). Dadurch kann eine Server
Component `<Emoji>` importieren und rendern, das dann zu einer Client Component
wird, aber jeder Export des Bundles ist danach eine Client-Referenz. Ruft man
`configureEmojis` oder `preloadEmojis` als Funktion in einer Server Component
auf, soll der Server Client-Code ausführen. Der Manifest-Store liegt außerdem im
Arbeitsspeicher des Browsers, der Aufruf würde den Client also ohnehin nicht
erreichen. Der Export `lookup` hat kein Banner und kann daher auf dem Server
importiert werden.

**Lösung:** Rufe `configureEmojis` und `preloadEmojis` aus einem Modul auf, das
mit `"use client"` beginnt, und importiere `style.css` einmal im Root-Layout.
Siehe [Next.js und Server Components](../README.md#nextjs-and-server-components)
und den [Nutzungsleitfaden](usage.md).

## ERR_PACKAGE_PATH_NOT_EXPORTED oder ein require-Fehler

**Symptom:** `ERR_PACKAGE_PATH_NOT_EXPORTED` ("No "exports" main defined"),
`Cannot find module` oder `ERR_REQUIRE_ESM` beim Laden des Pakets aus CommonJS.

**Ursache:** Das Paket ist ausschließlich ESM. `package.json` setzt
`"type": "module"` und eine `exports`-Map mit den Bedingungen `types` und
`import`, ohne `require`-Bedingung und ohne `main`-Feld. Ein Aufruf von
`require('animated-fluent-emojis')` scheitert schon beim Auflösen der
Exports-Map durch Node, bevor geprüft wird, ob die Datei ESM ist.
`ERR_PACKAGE_PATH_NOT_EXPORTED` ist daher der übliche Fehler, und
`ERR_REQUIRE_ESM` taucht nur in manchen Tools auf. Siehe
[ADR 0003](adr/0003-esm-only-and-vite-8.md).

**Lösung:** Verwende `import`-Syntax, aus einer ESM-Datei oder über einen
Bundler. Jede gepflegte React-Toolchain (Vite, Next.js, Remix, modernes webpack)
tut das bereits. In einer CommonJS-Datei lädst du es mit einem dynamischen
`import()`. Wechsle bei Jest, das standardmäßig CommonJS lädt, in den ESM-Modus
oder zu einem Runner mit nativer ESM-Unterstützung wie Vitest.

## Tests, die Emoji rendern, schlagen in jsdom fehl oder animieren nie

**Symptom:** Ein Test deiner eigenen Komponente schlägt an einer unbehandelten
Netzwerkanfrage oder einem Konsolenfehler von `Emoji` fehl, oder eine
Animations-Assertion wird in jsdom nie erfüllt.

**Ursache:** Zwei getrennte Einschränkungen.

- **Der Manifest-Fetch.** Das erste `Emoji`-Rendering lädt
  `<assetSiteUrl>/v1/manifest.slim.json`. Ohne Mock geht die Anfrage ins Netz
  oder schlägt fehl, und jedes `Emoji` landet im Zustand `error`. Der Store ist
  außerdem Modulzustand, ein geladenes oder fehlgeschlagenes Manifest bleibt
  also zwischen Tests in einer Datei erhalten.
- **Animation.** Autoplay wartet, bis das Sprite-Bild geladen ist, und jsdom
  lädt Bilder standardmäßig nicht, der Lauf bleibt also pausiert. Es gibt auch
  keine CSS-Animations-Engine, sodass `animationend` nie von selbst ausgelöst
  wird und `onPlaybackEnd` nicht aufgerufen wird. `IntersectionObserver` und
  `matchMedia` fehlen in jsdom, was die Komponente abfängt: Das Emoji gilt als
  sichtbar und als nicht auf reduzierte Bewegung eingestellt.

**Lösung:** Mocke die Manifest-Anfrage und setze das Modul zwischen den Tests
zurück. Dieses Repository macht das mit MSW in
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

`compactManifest` ist die kompakte Form des Slim-Manifests; die hier verwendete
Fixture ist `src/test/manifest-fixture.ts`. Rufe `vi.resetModules()` in
`afterEach` auf und importiere die Komponente pro Test neu, um einen frischen
Store zu erhalten. Prüfe das gerenderte `img` und seine Inline-Animationsstile
und verlasse dich nicht auf `animationend`. Für echte Wiedergabe nutze einen
Browser-Runner wie den Vitest Browser Mode, so wie dieses Repository es für
seine Komponententests tut.

## bun run test schlägt fehl, weil Chromium fehlt

**Symptom:** Für Contributors: `bun run test` bricht beim Start mit einem
Playwright-Fehler ab, dass die Chromium-Programmdatei nicht existiert.

**Ursache:** Komponenten- und Hook-Tests laufen in headless Chromium über Vitest
Browser Mode und Playwright, und `bun install` lädt den Browser nicht herunter.
Siehe [Testing](development.md#testing).

**Lösung:** Installiere ihn einmalig:

```sh
bunx playwright install chromium
```

## Siehe auch

- [Nutzungsleitfaden](usage.md): Props, Fallback-Verhalten, Preloading und die
  Asset Site.
- [Sicherheitsdesign](security.md): die CSP-Anforderungen und das
  Bedrohungsmodell.
- [Architektur](architecture.md): der Manifest-Store, CSS und Build-Output.
- [Entwicklung](development.md): Einrichtung und Tests.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): warum das Paket nur ESM ist.
