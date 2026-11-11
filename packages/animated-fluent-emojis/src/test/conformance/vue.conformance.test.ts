import { createApp, h, nextTick, shallowRef, type App } from "vue";

import { Emoji } from "../../vue/index.js";
import type { ConformanceDriver, ConformanceOptions } from "./driver.js";
import { defineConformanceSuite } from "./suite.js";

defineConformanceSuite("vue", (): ConformanceDriver => {
  let app: App | undefined;
  const current = shallowRef<ConformanceOptions>({ id: "" });
  return {
    mount: (container, options) => {
      current.value = options;
      app = createApp({ render: () => h(Emoji, current.value) });
      app.mount(container);
    },
    update: async (options) => {
      current.value = options;
      await nextTick();
    },
    unmount: () => {
      app?.unmount();
    },
  };
});
