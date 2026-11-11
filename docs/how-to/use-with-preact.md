# Use with Preact

There are two ways to use emojis in Preact: the `<fluent-emoji>` element, or the
React adapter through `preact/compat`.

## The element

Import the element entry once. It registers `<fluent-emoji>` and needs no
stylesheet:

```tsx
import "animated-fluent-emojis/element";
```

The package augments the `preact` JSX types with the element's kebab-case
attributes:

```tsx
export function Greeting() {
  return <fluent-emoji id="1f44b_wavinghand" size={64} play-on-hover />;
}
```

The fallback goes in as a child with `slot="fallback"`. To react to
`emoji-load`, `emoji-error` or `playback-end`, call `addEventListener` on the
element from a `ref`:

```tsx
import { useEffect, useRef } from "preact/hooks";

export function Greeting() {
  const emoji = useRef<HTMLElementTagNameMap["fluent-emoji"]>(null);

  useEffect(() => {
    const element = emoji.current;
    const onEnd = () => {
      console.log("done");
    };
    element?.addEventListener("playback-end", onEnd);
    return () => element?.removeEventListener("playback-end", onEnd);
  }, []);

  return (
    <fluent-emoji id="1f44b_wavinghand" ref={emoji}>
      <span slot="fallback">👋</span>
    </fluent-emoji>
  );
}
```

Attributes, properties and events are listed in the
[guide](../guide/frameworks.md#plain-html).

## The React adapter

Alias `react` and `react-dom` to `preact/compat` in your bundler, then use the
React adapter as documented in the
[Frameworks guide](../guide/frameworks.md#react).
