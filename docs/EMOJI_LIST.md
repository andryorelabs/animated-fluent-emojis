# Animated Fluent Emojis List

This document provides an index to the comprehensive lists of all available
emojis in the Animated Fluent Emojis library, organized by categories. Use the
IDs provided in these lists when implementing the `<Emoji>` component in your
React applications.

## Emoji Categories

- [Activities](EMOJI_LIST_Activities.md)
- [Animals](EMOJI_LIST_Animals.md)
- [Food](EMOJI_LIST_Food.md)
- [Hand Gestures](EMOJI_LIST_Hand_gestures.md)
- [Objects](EMOJI_LIST_Objects.md)
- [People](EMOJI_LIST_People.md)
- [Smileys](EMOJI_LIST_Smilies.md)
- [Symbols](EMOJI_LIST_Symbols.md)
- [Travel and Places](EMOJI_LIST_Travel_and_places.md)

Each category file contains a table with the following information for each
emoji:

| Column      | Description                                               |
| ----------- | --------------------------------------------------------- |
| ID          | The unique identifier to use with the `<Emoji>` component |
| Unicode     | The Unicode representation of the emoji                   |
| Description | A brief description of the emoji                          |
| Keywords    | Related terms for searching and categorization            |

## Usage

To use an emoji in your React application, import the `Emoji` component and use
the ID from the appropriate category list:

```jsx
import { Emoji } from "animated-fluent-emojis/react";

function MyComponent() {
  return <Emoji id="1f4af_hundredpointssymbol" />;
}
```

For more details on usage and customization options, please refer to the main
README.md file.
