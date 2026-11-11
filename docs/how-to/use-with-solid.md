# Use with Solid

Render emojis in Solid through the `<fluent-emoji>` element. There is no native
Solid adapter.

## Register the element

Import the element entry once, for example in your entry module. It registers
`<fluent-emoji>` and needs no stylesheet:

```tsx
import "animated-fluent-emojis/element";
```

## Use the tag

The package augments the `solid-js` JSX types with the element's kebab-case
attributes. Use `on:` to listen to its events, which Solid attaches to the
element directly:

```tsx
export function Greeting() {
  return (
    <fluent-emoji
      id="1f44b_wavinghand"
      size={64}
      play-on-hover
      on:playback-end={() => {
        console.log("done");
      }}
    />
  );
}
```

The fallback goes in as a child with `slot="fallback"`, and `ref` gives you the
element:

```tsx
<fluent-emoji
  id="1f44b_wavinghand"
  ref={(element) => {
    element.playing = false;
  }}
>
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Attributes, properties and events are listed in the
[guide](../guide/frameworks.md#plain-html).
