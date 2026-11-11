import "../../element/index.js";
import type { FluentEmojiElement } from "../../element/index.js";
import type { ConformanceDriver, ConformanceOptions } from "./driver.js";
import { defineConformanceSuite } from "./suite.js";

const applyOptions = (element: FluentEmojiElement, options: ConformanceOptions): void => {
  element.id = options.id;
  element.size = options.size;
  element.animationIterations = options.animationIterations;
  element.autoPlay = options.autoPlay;
  element.playing = options.playing;
  element.alt = options.alt;
};

defineConformanceSuite("element", (): ConformanceDriver => {
  let element: FluentEmojiElement | undefined;
  const listen = (type: string, callback: (() => void) | undefined): void => {
    if (!callback) return;
    element?.addEventListener(type, () => {
      callback();
    });
  };
  return {
    mount: (container, options) => {
      element = document.createElement("fluent-emoji");
      applyOptions(element, options);
      listen("playback-end", options.onPlaybackEnd);
      listen("emoji-error", options.onError);
      container.append(element);
    },
    update: (options) => {
      if (element) applyOptions(element, options);
    },
    unmount: () => {
      element?.remove();
    },
  };
});
