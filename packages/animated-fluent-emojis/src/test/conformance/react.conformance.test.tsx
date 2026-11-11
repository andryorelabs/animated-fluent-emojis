import { render } from "vitest-browser-react";

import { Emoji } from "../../components/Emoji.js";
import type { ConformanceDriver } from "./driver.js";
import { defineConformanceSuite } from "./suite.js";

defineConformanceSuite("react", (): ConformanceDriver => {
  let screen: Awaited<ReturnType<typeof render>> | undefined;
  return {
    mount: async (container, options) => {
      screen = await render(<Emoji {...options} />, { container });
    },
    update: async (options) => {
      await screen?.rerender(<Emoji {...options} />);
    },
    unmount: async () => {
      await screen?.unmount();
    },
  };
});
