/// <reference types="@vitest/browser-playwright" />
import type { CSSProperties } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { setReducedMotion } from "../test/set-reduced-motion.js";
import { Emoji } from "./Emoji.js";

const getImage = () => page.getByRole("img", { name: "Cat" });

const findImage = async () => {
  const image = getImage();
  await expect.element(image).toBeVisible();
  return image.element();
};

const getPlayState = (image: ReturnType<typeof getImage>) =>
  image.element().style.animationPlayState;

const setDocumentHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

const pause = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 100);
  });

const emulateReducedMotion = async (value: "reduce" | "no-preference") => {
  await setReducedMotion(value);
  await expect
    .poll(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
    .toBe(value === "reduce");
};

afterEach(async () => {
  Reflect.deleteProperty(document, "hidden");
  await emulateReducedMotion("no-preference");
});

test("passes a CSS length size to the container and fills it with the image", async () => {
  await render(<Emoji id="cat" size="2rem" />);

  const image = await findImage();
  expect(image.parentElement?.style.width).toBe("2rem");
  expect(image.parentElement?.style.height).toBe("2rem");
  expect(image.style.width).toBe("100%");
  expect(image.hasAttribute("sizes")).toBe(false);
});

test("accepts a var() size", async () => {
  await render(
    <div style={{ "--size": "30px" } as CSSProperties}>
      <Emoji id="cat" size="var(--size)" />
    </div>,
  );

  const image = await findImage();
  const container = image.parentElement;
  await expect.poll(() => container?.getBoundingClientRect().width).toBe(30);
});

test("keeps sizes for numeric sizes", async () => {
  await render(<Emoji id="cat" size={40} />);

  const image = await findImage();
  expect(image.getAttribute("sizes")).toBe("40px");
});

test("the consumer style wins over the sizing styles", async () => {
  await render(<Emoji id="cat" size={40} style={{ width: "2rem" }} />);

  const image = await findImage();
  const container = image.parentElement;
  expect(container?.style.width).toBe("2rem");
  expect(container?.style.height).toBe("40px");
});

test("playing runs the iterations despite autoPlay being off", async () => {
  await render(<Emoji id="cat" autoPlay={false} animationIterations="infinite" playing />);

  await expect.poll(() => getPlayState(getImage())).toBe("running");
});

test("playing overrides reduced motion", async () => {
  await emulateReducedMotion("reduce");
  await render(<Emoji id="cat" animationIterations="infinite" playing />);

  await expect.poll(() => getPlayState(getImage())).toBe("running");
});

test("playing still pauses while the document is hidden", async () => {
  await render(<Emoji id="cat" animationIterations="infinite" playing />);

  const image = getImage();
  await expect.poll(() => getPlayState(image)).toBe("running");
  setDocumentHidden(true);
  await expect.poll(() => getPlayState(image)).toBe("paused");
});

test("playing false pauses on the current frame and true resumes", async () => {
  const { rerender } = await render(<Emoji id="cat" animationIterations="infinite" playing />);

  const image = getImage();
  await expect.poll(() => getPlayState(image)).toBe("running");

  await rerender(<Emoji id="cat" animationIterations="infinite" playing={false} />);
  await expect.poll(() => getPlayState(image)).toBe("paused");
  expect(image.element().style.animationName).not.toBe("none");
  expect(image.element().getAnimations()).toHaveLength(1);

  await rerender(<Emoji id="cat" animationIterations="infinite" playing />);
  await expect.poll(() => getPlayState(image)).toBe("running");
});

test("playing false holds a run that has not started", async () => {
  await render(<Emoji id="cat" animationIterations="infinite" playing={false} />);

  const image = getImage();
  await expect.element(image).toBeVisible();
  await pause();
  expect(getPlayState(image)).toBe("paused");
});

test("onPlaybackEnd is called once when the autoplay run ends", async () => {
  const onPlaybackEnd = vi.fn();
  await render(<Emoji id="cat" animationIterations={1} onPlaybackEnd={onPlaybackEnd} />);

  const image = getImage();
  await expect.element(image).toBeVisible();
  image.element().dispatchEvent(new Event("animationend"));
  image.element().dispatchEvent(new Event("animationend"));

  await expect.poll(() => onPlaybackEnd.mock.calls.length).toBe(1);
});

test("onPlaybackEnd is called when a playing run ends", async () => {
  const onPlaybackEnd = vi.fn();
  await render(
    <Emoji
      id="cat"
      autoPlay={false}
      animationIterations={1}
      playing
      onPlaybackEnd={onPlaybackEnd}
    />,
  );

  await expect.poll(() => onPlaybackEnd.mock.calls.length, { timeout: 5000 }).toBe(1);
});

test("reduced motion turned on mid-run leaves the poster frame and never replays", async () => {
  const onPlaybackEnd = vi.fn();
  await render(<Emoji id="cat" animationIterations={50} onPlaybackEnd={onPlaybackEnd} />);

  const image = getImage();
  await expect.poll(() => getPlayState(image)).toBe("running");

  await emulateReducedMotion("reduce");
  await expect.poll(() => image.element().style.animationName).toBe("none");
  expect(getPlayState(image)).toBe("paused");

  await emulateReducedMotion("no-preference");
  await pause();
  expect(image.element().style.animationName).toBe("none");
  expect(getPlayState(image)).toBe("paused");
  expect(onPlaybackEnd).not.toHaveBeenCalled();
});

test("onPlaybackEnd is never called for infinite runs", async () => {
  const onPlaybackEnd = vi.fn();
  await render(<Emoji id="cat" animationIterations="infinite" onPlaybackEnd={onPlaybackEnd} />);

  const image = getImage();
  await expect.element(image).toBeVisible();
  image.element().dispatchEvent(new Event("animationend"));
  await pause();

  expect(onPlaybackEnd).not.toHaveBeenCalled();
});

test("onPlaybackEnd is not called when the run is cancelled by unmount", async () => {
  const onPlaybackEnd = vi.fn();
  const { unmount } = await render(
    <Emoji id="cat" animationIterations={50} onPlaybackEnd={onPlaybackEnd} />,
  );

  await expect.element(getImage()).toBeVisible();
  await unmount();
  await pause();

  expect(onPlaybackEnd).not.toHaveBeenCalled();
});
