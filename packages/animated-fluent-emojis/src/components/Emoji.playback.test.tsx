/// <reference types="@vitest/browser-playwright" />
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { Emoji } from "./Emoji.js";

const getImage = (name: string) => page.getByRole("img", { name });

const getPlayState = (image: ReturnType<typeof getImage>) =>
  image.element().style.animationPlayState;

const setDocumentHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => {
  Reflect.deleteProperty(document, "hidden");
});

test("plays once the image has loaded and is on screen", async () => {
  await render(<Emoji id="cat" animationIterations="infinite" />);

  const image = getImage("Cat");
  await expect.poll(() => getPlayState(image)).toBe("running");
  expect(image.element()).toHaveProperty("complete", true);
});

test("stays paused while the emoji is scrolled out of view and resumes on return", async () => {
  await render(
    <div data-testid="scroller" style={{ height: 100, overflow: "auto" }}>
      <div style={{ height: 2000 }} />
      <Emoji id="cat" size={50} animationIterations="infinite" />
    </div>,
  );

  const image = getImage("Cat");
  await expect
    .poll(() => {
      const element = image.element();
      return element instanceof HTMLImageElement && element.complete;
    })
    .toBe(true);
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  expect(getPlayState(image)).toBe("paused");

  const scroller = page.getByTestId("scroller").element();
  scroller.scrollTop = 2000;
  await expect.poll(() => getPlayState(image)).toBe("running");

  scroller.scrollTop = 0;
  await expect.poll(() => getPlayState(image)).toBe("paused");
});

test("pauses a looping emoji while the document is hidden", async () => {
  await render(<Emoji id="cat" animationIterations="infinite" />);

  const image = getImage("Cat");
  await expect.poll(() => getPlayState(image)).toBe("running");

  setDocumentHidden(true);
  await expect.poll(() => getPlayState(image)).toBe("paused");

  setDocumentHidden(false);
  await expect.poll(() => getPlayState(image)).toBe("running");
});

test("a started run pauses on its frame while the document is hidden and finishes once", async () => {
  const onPlaybackEnd = vi.fn();
  await render(<Emoji id="cat" animationIterations={2} onPlaybackEnd={onPlaybackEnd} />);

  const image = getImage("Cat");
  await expect.poll(() => getPlayState(image)).toBe("running");

  setDocumentHidden(true);
  await expect.poll(() => getPlayState(image)).toBe("paused");
  expect(image.element().style.animationName).not.toBe("none");
  expect(image.element().getAnimations()).toHaveLength(1);

  setDocumentHidden(false);
  await expect.poll(() => getPlayState(image)).toBe("running");
  await expect.poll(() => onPlaybackEnd.mock.calls.length, { timeout: 5000 }).toBe(1);
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  expect(onPlaybackEnd).toHaveBeenCalledTimes(1);
});

test("a started run pauses on its frame when it leaves the viewport and finishes once", async () => {
  const onPlaybackEnd = vi.fn();
  await render(
    <div data-testid="scroller" style={{ height: 100, overflow: "auto" }}>
      <Emoji id="cat" size={50} animationIterations={2} onPlaybackEnd={onPlaybackEnd} />
      <div style={{ height: 2000 }} />
    </div>,
  );

  const image = getImage("Cat");
  await expect.poll(() => getPlayState(image)).toBe("running");

  const scroller = page.getByTestId("scroller").element();
  scroller.scrollTop = 2000;
  await expect.poll(() => getPlayState(image)).toBe("paused");
  expect(image.element().style.animationName).not.toBe("none");
  expect(image.element().getAnimations()).toHaveLength(1);

  scroller.scrollTop = 0;
  await expect.poll(() => getPlayState(image)).toBe("running");
  await expect.poll(() => onPlaybackEnd.mock.calls.length, { timeout: 5000 }).toBe(1);
});

test("describes the sheets by width and sizes the image at 24px", async () => {
  await render(<Emoji id="waving-hand" size={24} />);

  const image = getImage("Waving hand").element();
  expect(image.getAttribute("sizes")).toBe("24px");
  expect(image.getAttribute("srcset")).toMatch(
    /waving-hand\.etag-wave\.png 100w, .*waving-hand\.etag-wave@2x\.png 200w$/,
  );
});

test("describes the sheets by width and sizes the image at 200px", async () => {
  await render(<Emoji id="waving-hand" size={200} />);

  const image = getImage("Waving hand").element();
  expect(image.getAttribute("sizes")).toBe("200px");
  expect(image.getAttribute("srcset")).toContain(" 200w");
});

test("rounds fractional sizes to whole pixels", async () => {
  await render(<Emoji id="cat" size={37.6} />);

  const image = getImage("Cat").element();
  expect(image.style.width).toBe("38px");
  expect(image.parentElement?.style.width).toBe("38px");
  expect(image.getAttribute("sizes")).toBe("38px");
});

test.each([0, -5, NaN, Infinity, -Infinity, 0.4])(
  "falls back to 100px for the invalid size %s",
  async (size) => {
    await render(<Emoji id="cat" size={size} />);

    const image = getImage("Cat").element();
    expect(image.style.width).toBe("100px");
    expect(image.parentElement?.style.width).toBe("100px");
    expect(image.getAttribute("sizes")).toBe("100px");
  },
);
