# Use with Angular

Render emojis in Angular through the `<fluent-emoji>` element. There is no
native Angular adapter; the element works in any Angular version that supports
custom elements.

## Register the element

Import the element entry once, for example in `main.ts`. Importing it registers
`<fluent-emoji>`. The element carries its own styles in a shadow root, so there
is no stylesheet to import:

```ts
import "animated-fluent-emojis/element";
```

## Allow the tag in your components

Angular rejects unknown tags unless the component allows custom elements:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-greeting",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover />`,
})
export class GreetingComponent {}
```

## Bind properties and listen to events

Use property bindings for dynamic values, so Angular sets the element's
properties rather than rewriting attributes. Events are `emoji-load`,
`emoji-error` and `playback-end`:

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Attributes, properties and events are listed in the
[guide](../guide/frameworks.md#plain-html). To reserve the footprint before the
element upgrades, add `FLUENT_EMOJI_PRE_UPGRADE_CSS` to your global CSS. For
loading, fallback and playback behavior see the rest of the
[guide](../usage.md).
