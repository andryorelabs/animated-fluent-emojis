import { flushSync, mount, unmount } from "svelte";

import Emoji from "../../svelte/Emoji.svelte";
import type { ConformanceDriver, ConformanceOptions } from "./driver.js";

/**
 * Creates a driver that mounts the Svelte `Emoji` with reactive props, so
 * `update` re-renders the same instance the way a parent component would.
 * @returns A fresh driver.
 */
export const createSvelteDriver = (): ConformanceDriver => {
  const state = $state<{ options: ConformanceOptions | undefined }>({
    options: undefined,
  });
  let instance: Record<string, unknown> | undefined;
  return {
    mount: (container, options) => {
      state.options = options;
      instance = mount(Emoji, {
        target: container,
        props: {
          get id() {
            return state.options?.id ?? options.id;
          },
          get size() {
            return state.options?.size;
          },
          get animationIterations() {
            return state.options?.animationIterations;
          },
          get autoPlay() {
            return state.options?.autoPlay;
          },
          get playing() {
            return state.options?.playing;
          },
          get alt() {
            return state.options?.alt;
          },
          get onPlaybackEnd() {
            return state.options?.onPlaybackEnd;
          },
          get onError() {
            return state.options?.onError;
          },
        },
      });
      flushSync();
    },
    update: (options) => {
      state.options = options;
      flushSync();
    },
    unmount: () => {
      if (instance) void unmount(instance);
      instance = undefined;
    },
  };
};
