import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { configureEmojis } from "../utils/index.js";
import { Emoji } from "./Emoji.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  configureEmojis({});
});

const waitForImage = async (container: Element): Promise<HTMLImageElement> => {
  return vi.waitFor(() => {
    const image = container.querySelector("img");
    if (!image) throw new Error("image not rendered yet");
    return image;
  });
};

const failImage = async (container: Element) => {
  const image = await waitForImage(container);
  image.dispatchEvent(new Event("error"));
};

test("renders the unicode glyph, accessibly, when the image fails", async () => {
  const { container } = await render(<Emoji id="cat" size={40} />);
  await failImage(container);

  await expect.element(page.getByRole("img", { name: "Cat" })).toBeVisible();
  await expect.poll(() => container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("🐱");
});

test("the glyph is decorative with an empty alt", async () => {
  const { container } = await render(<Emoji id="cat" alt="" />);
  await failImage(container);

  await expect.poll(() => container.textContent).toBe("🐱");
  expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
});

test("a custom fallback replaces the glyph", async () => {
  const { container } = await render(<Emoji id="cat" fallback={<b>custom</b>} />);
  await failImage(container);

  await expect.poll(() => container.textContent).toBe("custom");
});

test("fallback null renders nothing after an image failure", async () => {
  const { container } = await render(<Emoji id="cat" fallback={null} />);
  await failImage(container);

  await expect.poll(() => container.getHTML()).toBe("");
});

test("onLoad fires on load and onError on an image error", async () => {
  const onLoad = vi.fn();
  const onError = vi.fn();
  const { container } = await render(<Emoji id="cat" onLoad={onLoad} onError={onError} />);
  await expect.poll(() => onLoad.mock.calls.length).toBe(1);

  await failImage(container);

  await expect.poll(() => onError.mock.calls.length).toBe(1);
  expect(onError.mock.calls[0]?.[0]).toBeDefined();
});

test("a manifest error fires onError and renders the custom fallback", async () => {
  vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 500 })));
  configureEmojis({ assetSiteUrl: "https://api-failing.test" });
  const onError = vi.fn();

  const { container } = await render(
    <>
      <Emoji id="cat" onError={onError} fallback="n/a" />
      <Emoji id="cat" />
    </>,
  );

  await expect.poll(() => onError.mock.calls.length).toBe(1);
  expect(onError.mock.calls[0]?.[0]).toBeUndefined();
  expect(container.textContent).toBe("n/a");
});

test("className, style, data attributes and ref reach the root span", async () => {
  const ref = createRef<HTMLSpanElement>();
  const { container } = await render(
    <Emoji
      id="cat"
      ref={ref}
      size={32}
      className="mine"
      style={{ margin: "3px", width: "999px" }}
      data-testid="root"
    />,
  );
  await waitForImage(container);

  const root = container.firstElementChild as HTMLSpanElement;
  expect(ref.current).toBe(root);
  expect(root.classList.contains("mine")).toBe(true);
  expect(root.dataset.testid).toBe("root");
  expect(root.style.margin).toBe("3px");
  expect(root.style.width).toBe("999px");
  expect(root.style.height).toBe("32px");
});

test("a new image after a failure starts playing once loaded and visible", async () => {
  const { container, rerender } = await render(<Emoji id="waving-hand" skinTone="dark" />);
  await failImage(container);
  await expect.poll(() => container.querySelector("img")).toBeNull();

  await rerender(<Emoji id="waving-hand" skinTone="light" />);
  const image = await waitForImage(container);
  image.dispatchEvent(new Event("load"));

  await expect.poll(() => image.style.animationPlayState, { timeout: 5000 }).toBe("running");
});
