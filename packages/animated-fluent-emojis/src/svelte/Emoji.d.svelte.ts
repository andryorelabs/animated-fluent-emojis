import type { Component } from "svelte";

import type { EmojiProps } from "./types.js";

/**
 * Renders an animated Fluent emoji. Renders a sized, hidden placeholder on
 * the server and on first paint, then plays through the shared playback core.
 */
declare const Emoji: Component<EmojiProps>;
export default Emoji;
