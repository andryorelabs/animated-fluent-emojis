import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { FIXTURE_MANIFEST } from "../test/manifest-fixture.js";
import { Emoji } from "./Emoji.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders a placeholder of the final size until the manifest resolves", async () => {
  let isReleased = false;
  vi.stubGlobal("fetch", async () => {
    await vi.waitFor(() => {
      expect(isReleased).toBe(true);
    });
    return Response.json(FIXTURE_MANIFEST);
  });

  const { container } = await render(<Emoji id="cat" size={64} />);

  const placeholder = container.querySelector("span");
  expect(container.querySelector("img")).toBeNull();
  expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
  expect(placeholder?.getBoundingClientRect().width).toBe(64);
  expect(placeholder?.getBoundingClientRect().height).toBe(64);

  isReleased = true;
  await expect.poll(() => container.querySelector("img")).not.toBeNull();
  expect(container.querySelector("span")?.getBoundingClientRect().height).toBe(64);
});
