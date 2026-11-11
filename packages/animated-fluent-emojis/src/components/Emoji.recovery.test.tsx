import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { FIXTURE_MANIFEST } from "../test/manifest-fixture.js";
import { configureEmojis } from "../utils/index.js";
import { Emoji } from "./Emoji.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("emojis mounted during a failed load render after a later load succeeds, logging once", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  let shouldFail = true;
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      shouldFail ? new Response("nope", { status: 500 }) : Response.json(FIXTURE_MANIFEST),
    ),
  );
  configureEmojis({ assetSiteUrl: "https://recovery-failing.test" });

  const { container } = await render(
    <>
      <Emoji id="cat" />
      <Emoji id="cat" />
      <Emoji id="cat" />
    </>,
  );
  await expect.poll(() => errorSpy.mock.calls.length).toBe(1);
  expect(container.querySelector("img")).toBeNull();

  shouldFail = false;
  globalThis.dispatchEvent(new Event("online"));

  await expect.poll(() => container.querySelectorAll('img, [role="img"]').length).toBe(3);
  expect(errorSpy).toHaveBeenCalledTimes(1);
});

test("a remount after the manifest is ready renders the image with no placeholder", async () => {
  configureEmojis({});
  const first = await render(<Emoji id="cat" />);
  await expect.poll(() => first.container.querySelector("img")).not.toBeNull();
  await first.unmount();

  const { container } = await render(<Emoji id="cat" />);

  expect(container.querySelector("img")).not.toBeNull();
  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});
