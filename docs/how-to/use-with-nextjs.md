# Use with Next.js

Render `Emoji` in the App Router, including from Server Components.

## Import the stylesheet once

The stylesheet carries the animation keyframes. Without it emojis render as
static sprite sheets. Import it once, in the root layout:

```jsx
import "animated-fluent-emojis/style.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Use Emoji in a Server Component

The bundle starts with `"use client";`, so a Server Component can import `Emoji`
directly, with no wrapper file:

```jsx
import { Emoji } from "animated-fluent-emojis/react";

export default function Page() {
  return <Emoji id="1f44b_wavinghand" size={64} />;
}
```

On the server, `Emoji` renders an empty placeholder of the final size, so the
layout does not shift. The emoji appears after hydration, because the manifest
is fetched in the browser on first render, never at import. Functions such as
`onLoad` or `onPlaybackEnd` cannot be passed from a Server Component; render the
emoji from a client module in that case.

## Configure and preload from a client module

`configureEmojis` and `preloadEmojis` run in the browser, so call them from a
module that starts with `"use client"`, not from a Server Component. A small
component mounted in the root layout is enough:

```jsx
"use client";

import { configureEmojis, preloadEmojis } from "animated-fluent-emojis";

configureEmojis({ assetSiteUrl: "https://emojis.example.com" });
void preloadEmojis();

export function EmojiSetup() {
  return null;
}
```

Render `<EmojiSetup />` in the layout above the content. Drop the
`configureEmojis` line to keep the default asset site. Call it before the first
`Emoji` renders; see [self-host the assets](self-host-the-assets.md) for the
Content Security Policy that goes with a custom origin, and
[preload for a picker](preload-for-a-picker.md) for preloading specific ids.

## Lookup

`animated-fluent-emojis/lookup` has no React and no `"use client"` banner, so it
also works in Server Components and route handlers. See
[lookup](../guide/lookup.md).
