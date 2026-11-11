---
title: Auto-héberger les assets
sourceHash: 1fa3d7fdc9a470b6
---

Servez le manifest et les sprite sheets depuis une origine que vous contrôlez,
et pointez `Emoji` vers elle. Utilisez ceci lorsque vous ne pouvez pas autoriser
une origine tierce dans votre Content Security Policy, ou lorsque vous ne voulez
pas dépendre de l'asset site par défaut. Les termes suivent
[`GLOSSARY.md`](../../GLOSSARY.md).

## Construire le site

L'asset site est généré par `apps/assets` dans `apps/assets/dist-assets/` ; rien
de ce qu'il produit n'est commité. Depuis un clone du dépôt, exécutez
`bun run assets:build` (il nécessite `ffmpeg`, voir
[développement](../development.md)) et publiez le contenu de
`apps/assets/dist-assets/` sur n'importe quel hébergeur statique. Conservez
l'arborescence `v1/`, et le fichier `_headers` si votre hébergeur le prend en
charge, car il met en cache les sprites adressés par contenu en `immutable`.
L'arborescence est décrite dans
[architecture](../architecture.md#asset-layout-v1).

Pour publier sur Cloudflare Pages comme le fait ce projet, suivez
[configurer l'hébergement des assets](set-up-asset-hosting.md).

## Y pointer le composant

Appelez `configureEmojis` une seule fois, avant le premier rendu d'un `Emoji`.
Un slash final dans l'URL est ignoré :

```jsx
import { configureEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
```

L'appeler après la requête du manifest réinitialise le manifest et émet un
avertissement en développement. Voir la section
[asset site](../guide/assets.md#asset-site) du guide d'utilisation.

## Définir la Content Security Policy

Autorisez votre origine dans les deux directives. Le manifest est récupéré avec
`fetch`, et les sprite sheets se chargent via `<img>` :

```text
connect-src https://emojis.example.com
img-src https://emojis.example.com
```

L'URL d'un sprite est
`<site>/v1/sprites/<category title>/<id><tone>.<etag>.png`, avec `@2x` avant
l'extension pour une sprite sheet HD, donc une seule origine couvre les deux.
Les adaptateurs de framework n'injectent aucun élément `<style>`, ils n'ont donc
besoin d'aucune autorisation `style-src` ; l'élément `<fluent-emoji>` en ajoute
un à son shadow root et en a besoin. La conception et ses limites sont décrites
dans [sécurité](../security.md#csp-requirements).

## Vérifier

Ouvrez la page avec le panneau réseau et vérifiez que la requête du manifest va
vers `/v1/manifest.slim.json` sur votre origine, et qu'aucune requête ne va vers
`animated-fluent-emojis-cdn.andryore.dev`. Une requête bloquée apparaît comme
une violation de CSP dans la console, et l'emoji rend son fallback ; voir
[fallback](../guide/behavior.md#fallback).
