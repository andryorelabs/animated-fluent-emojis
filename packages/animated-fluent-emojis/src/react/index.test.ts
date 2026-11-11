import { expect, test } from "vitest";

import { Emoji } from "./index.js";

test("the react entry exposes the Emoji component", () => {
  expect(typeof Emoji).toBe("object");
});
