import { createEmoji, type EmojiController } from "../../vanilla/create-emoji.js";
import type { ConformanceDriver, ConformanceOptions } from "./driver.js";
import { defineConformanceSuite } from "./suite.js";

const OPTION_KEYS = [
  "id",
  "size",
  "animationIterations",
  "autoPlay",
  "playing",
  "alt",
  "onPlaybackEnd",
  "onError",
] as const satisfies readonly (keyof ConformanceOptions)[];

const toReplacement = (options: ConformanceOptions) =>
  Object.fromEntries(OPTION_KEYS.map((key) => [key, options[key]]));

defineConformanceSuite("vanilla", (): ConformanceDriver => {
  let controller: EmojiController | undefined;
  return {
    mount: (container, options) => {
      controller = createEmoji(container, options);
    },
    update: (options) => {
      controller?.update(toReplacement(options));
    },
    unmount: () => {
      controller?.destroy();
    },
  };
});
