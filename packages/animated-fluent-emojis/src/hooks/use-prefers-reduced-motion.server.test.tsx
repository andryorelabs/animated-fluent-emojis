import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion.js";

const Probe = () => <span>{String(usePrefersReducedMotion())}</span>;

test("server rendering reports no reduced-motion preference", () => {
  expect(renderToString(<Probe />)).toContain("false");
});
