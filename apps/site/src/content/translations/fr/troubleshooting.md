---
title: Dépannage
sourceHash: c3ad7fa99dc76181
---

Les problèmes sont regroupés selon ce que vous voyez, chacun avec la cause dans
le code et une solution. Pour l'API complète, voir le
[guide d'utilisation](usage.md).

- [L'emoji s'affiche mais ne s'anime jamais](#lemoji-saffiche-mais-ne-sanime-jamais)
- [Rien ne s'affiche, ou seul le fallback apparaît](#rien-ne-saffiche-ou-seul-le-fallback-apparaît)
- [Le manifest est bloqué par la CSP ou le navigateur est hors ligne](#le-manifest-est-bloqué-par-la-csp-ou-le-navigateur-est-hors-ligne)
- [Next.js signale une erreur pour configureEmojis ou Emoji](#nextjs-signale-une-erreur-pour-configureemojis-ou-emoji)
- [ERR_PACKAGE_PATH_NOT_EXPORTED ou une erreur de require](#err_package_path_not_exported-ou-une-erreur-de-require)
- [Les tests qui rendent Emoji échouent ou ne s'animent jamais dans jsdom](#les-tests-qui-rendent-emoji-échouent-ou-ne-saniment-jamais-dans-jsdom)
- [bun run test échoue car Chromium est absent](#bun-run-test-échoue-car-chromium-est-absent)
- [Voir aussi](#voir-aussi)

## L'emoji s'affiche mais ne s'anime jamais

**Symptôme :** La poster frame s'affiche à la bonne taille, mais ne se lance
jamais, et ne réagit pas non plus à `playOnHover`.

**Cause :** Le keyframe `emoji-play` et les règles de survol se trouvent dans
`src/components/Emoji.module.css`, qui est livré comme l'export séparé
`style.css`. Le nom d'animation `emoji-play` et son keyframe viennent tous deux
de la classe `.emojiImage` de cette feuille de style. Le style en ligne de
`useEmojiAnimation` ne définit que la durée, le timing `steps()` et l'état de
pause ; sans la feuille de style, rien ne nomme d'animation et la sprite sheet
reste sur sa poster frame. Voir [CSS](architecture.md#css).

D'autres cas ont la même apparence et ne sont pas des bugs :

- L'utilisateur préfère la réduction des animations. `autoPlay` est alors ignoré
  et l'emoji reste sur sa poster frame ; seul `playing` le remplace.
- L'emoji est hors écran, l'onglet est masqué, ou l'image n'est pas encore
  chargée. La lecture automatique attend ces trois conditions.

**Solution :** Importez la feuille de style une seule fois, à la racine de
l'application :

```js
import "animated-fluent-emojis/style.css";
```

Si vous l'avez bien importée et que l'emoji reste immobile, vérifiez le réglage
de réduction des animations du système d'exploitation.

## Rien ne s'affiche, ou seul le fallback apparaît

**Symptôme :** `Emoji` ne rend rien, une boîte vide, ou votre nœud `fallback` à
la place de l'animation.

**Cause :** `Emoji` lit son entrée dans le store du manifest (`useEmojiStyle`),
qui se trouve dans l'un de ces quatre états :

- `loading` : un espace réservé vide, `aria-hidden`, à la taille finale. Le
  manifest est récupéré à la première utilisation, avec un délai maximal de 15
  secondes.
- `missing` : l'id n'est pas dans le manifest. Il rend `fallback`, ou rien, et
  n'appelle pas `onError`. En développement, il journalise
  `Unknown emoji id "<id>".` une fois par id. Une faute de frappe ou un id d'une
  autre version en est la cause habituelle.
- `error` : la requête du manifest a échoué, a expiré ou a répondu avec un
  statut non 2xx. Le store journalise `Error fetching emoji data:` avec la
  raison dans la console, appelle `onError` sans événement, et rend `fallback`,
  ou rien. Le glyphe de fallback a besoin du manifest, il n'apparaît donc pas
  dans cet état.
- `ready`, mais la requête de la sprite sheet échoue : le glyphe de fallback est
  rendu (étiqueté avec `alt`), ou votre `fallback`, et `onError` reçoit
  l'événement de l'image.

**Solution :** Ouvrez la console et l'onglet réseau et cherchez les lignes
ci-dessus.

- Id inconnu : utilisez un id connu. `EmojiId` les autocomplète, et l'export
  `lookup` permet de les rechercher (voir [Lookup](guide/lookup.md)).
- Manifest en échec : confirmez que `<asset site>/v1/manifest.slim.json` répond
  200 depuis le navigateur. Un chargement échoué est retenté au prochain
  montage, sur `preloadEmojis` et lorsque le navigateur revient en ligne.
- Passez un `fallback` si l'emoji ne doit jamais laisser un trou dans la mise en
  page. Voir [Fallback](guide/behavior.md#fallback).

## Le manifest est bloqué par la CSP ou le navigateur est hors ligne

**Symptôme :** La console affiche une violation de Content Security Policy, une
erreur réseau ou `Failed to fetch the emoji manifest (<status>)`, et chaque
`Emoji` bascule sur son fallback.

**Cause :** Le manifest est demandé avec `fetch` depuis
`<assetSiteUrl>/v1/manifest.slim.json` (`fetchManifest` dans
`src/utils/emoji-manifest.ts`), et les sprite sheets sont chargées comme images
depuis la même origine. Une politique sans cette origine dans `connect-src`
bloque le manifest, et une politique sans elle dans `img-src` bloque les
sprites. Hors ligne, le fetch est rejeté et le store passe à `error`, puis
réessaie lorsque le navigateur déclenche `online`. `configureEmojis` avec un
`assetSiteUrl` personnalisé change l'origine que vous devez autoriser.

**Solution :** Autorisez l'origine de l'asset site, par défaut
`https://animated-fluent-emojis-cdn.andryore.dev`, dans `connect-src` et
`img-src`. Les directives exactes se trouvent dans
[exigences CSP](security.md#csp-requirements). Si vous auto-hébergez, autorisez
plutôt votre propre origine et appelez `configureEmojis` avant le premier rendu
d'un `Emoji`. Voir [Asset site](guide/assets.md#asset-site).

## Next.js signale une erreur pour configureEmojis ou Emoji

**Symptôme :** Next.js fait échouer le build ou la page avec une erreur
indiquant qu'une fonction est appelée depuis le serveur, en nommant
`configureEmojis` ou `preloadEmojis`.

**Cause :** Le bundle publié commence par une bannière `"use client";` (voir
[sortie du build](architecture.md#build-output)). Cela permet à un Server
Component d'importer et de rendre `<Emoji>`, qui devient un client component,
mais chaque export du bundle est alors une référence client. Appeler
`configureEmojis` ou `preloadEmojis` comme fonction dans un Server Component
demande au serveur d'exécuter du code client. Le store du manifest vit aussi en
mémoire du navigateur, l'appel n'atteindrait donc de toute façon pas le client.
L'export `lookup` n'a pas de bannière, il peut donc être importé côté serveur.

**Solution :** Appelez `configureEmojis` et `preloadEmojis` depuis un module qui
commence par `"use client"`, et importez `style.css` une seule fois dans le
layout racine. Voir
[Next.js et server components](../README.md#nextjs-and-server-components) et le
[guide d'utilisation](usage.md).

## ERR_PACKAGE_PATH_NOT_EXPORTED ou une erreur de require

**Symptôme :** `ERR_PACKAGE_PATH_NOT_EXPORTED` ("No "exports" main defined"),
`Cannot find module`, ou `ERR_REQUIRE_ESM` lors du chargement du paquet depuis
CommonJS.

**Cause :** Le paquet est uniquement ESM. `package.json` définit
`"type": "module"` et une map `exports` avec les conditions `types` et `import`,
sans condition `require` ni champ `main`. Un appel
`require('animated-fluent-emojis')` échoue pendant que Node résout la map
d'exports, avant de vérifier si le fichier est ESM ;
`ERR_PACKAGE_PATH_NOT_EXPORTED` est donc l'erreur habituelle, et
`ERR_REQUIRE_ESM` n'apparaît que dans certains outils. Voir
[ADR 0003](adr/0003-esm-only-and-vite-8.md).

**Solution :** Utilisez la syntaxe `import`, depuis un fichier ESM ou un
bundler. Toutes les chaînes d'outils React maintenues (Vite, Next.js, Remix,
webpack moderne) le font déjà. Dans un fichier CommonJS, chargez-le avec un
`import()` dynamique. Pour Jest, qui charge CommonJS par défaut, passez à son
mode ESM ou à un runner avec prise en charge native d'ESM, comme Vitest.

## Les tests qui rendent Emoji échouent ou ne s'animent jamais dans jsdom

**Symptôme :** Un test de votre propre composant échoue sur une requête réseau
non gérée ou une erreur console venant de `Emoji`, ou une assertion d'animation
ne passe jamais dans jsdom.

**Cause :** Deux limites distinctes.

- **Le fetch du manifest.** Le premier rendu d'`Emoji` récupère
  `<assetSiteUrl>/v1/manifest.slim.json`. Sans mock, il atteint le réseau ou
  échoue, et chaque `Emoji` finit dans l'état `error`. Le store est aussi un
  état de module, donc un manifest chargé ou en échec persiste entre les tests
  d'un même fichier.
- **L'animation.** La lecture automatique attend que l'image de la sprite sheet
  soit chargée, et jsdom ne charge pas les images par défaut, l'exécution reste
  donc en pause. Il n'y a pas non plus de moteur d'animation CSS, donc
  `animationend` ne se déclenche jamais de lui-même et `onPlaybackEnd` n'est pas
  appelé. `IntersectionObserver` et `matchMedia` sont absents de jsdom, ce que
  le composant gère : l'emoji est considéré à l'écran et comme ne préférant pas
  la réduction des animations.

**Solution :** Mockez la requête du manifest et réinitialisez le module entre
les tests. Ce dépôt le fait avec MSW dans `src/utils/emoji-manifest.test.ts` :

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest` est la forme compacte du manifest slim ; la fixture utilisée
ici est `src/test/manifest-fixture.ts`. Appelez `vi.resetModules()` dans
`afterEach` et importez à nouveau le composant à chaque test pour obtenir un
store neuf. Faites vos assertions sur l'`img` rendue et ses styles d'animation
en ligne, et ne vous appuyez pas sur `animationend`. Pour une vraie lecture,
utilisez un runner navigateur comme Vitest Browser Mode, comme le fait ce dépôt
pour ses tests de composants.

## bun run test échoue car Chromium est absent

**Symptôme :** Pour les contributeurs : `bun run test` échoue au démarrage avec
une erreur Playwright indiquant que l'exécutable Chromium n'existe pas.

**Cause :** Les tests de composants et de hooks s'exécutent dans Chromium
headless via Vitest Browser Mode et Playwright, et `bun install` ne télécharge
pas le navigateur. Voir [Tests](development.md#testing).

**Solution :** Installez-le une seule fois :

```sh
bunx playwright install chromium
```

## Voir aussi

- [Guide d'utilisation](usage.md) : props, comportement du fallback,
  préchargement et asset site.
- [Conception de la sécurité](security.md) : les exigences CSP et le modèle de
  menaces.
- [Architecture](architecture.md) : le store du manifest, le CSS et la sortie du
  build.
- [Développement](development.md) : installation et tests.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md) : pourquoi le paquet est
  uniquement ESM.
