# Preload for a picker

Warm the manifest and the sprite sheets before an emoji picker opens, so the
emojis show up without a visible load.

## Warm the manifest early

`preloadEmojis` with no arguments starts fetching the manifest before any
`Emoji` renders. It never rejects, so `void` is enough:

```jsx
import { preloadEmojis } from "animated-fluent-emojis";

void preloadEmojis();
```

Call it when the user is likely to open the picker, for example on hover or
focus of the trigger button, or when the app shell mounts.

## Warm the sprite sheets you will show

Pass ids to request their sprite sheets once the manifest is ready. Pass
`skinTone` to warm the variant the user will see, for emojis that have skin
tones:

```jsx
const quickReactions = ["1f44b_wavinghand", "1f525_fire", "1f389_partypopper"];

function handlePickerTriggerHover() {
  void preloadEmojis(quickReactions, { skinTone: "medium" });
}
```

Only warm the ids you will render first. A picker with hundreds of emojis should
not preload them all; sprite sheets load lazily (`loading="lazy"`) as they
approach the viewport. `skinTone` is one of `'default'`, `'light'`,
`'medium-light'`, `'medium'`, `'medium-dark'` or `'dark'`.

## Configure the asset site first

If you use [a self-hosted asset site](self-host-the-assets.md), call
`configureEmojis` before `preloadEmojis`. Changing the asset site after a
preload resets the manifest, so the warmed requests are wasted.

## When the network fails

The manifest request gives up after 15 seconds. A failed manifest is retried on
the next `preloadEmojis` call, the next mount or when the browser comes back
online, so calling it again from the trigger is safe. See
[preloading](../guide/assets.md#preloading) and
[fallback](../guide/behavior.md#fallback).
