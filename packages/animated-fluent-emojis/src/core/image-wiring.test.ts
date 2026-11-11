import { afterEach, expect, test, vi } from "vitest";

import { wireEmojiImage } from "./image-wiring.js";

class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
}

const asImage = (image: FakeImage) => image as unknown as HTMLImageElement;

const handlers = () => ({
  onLoad: vi.fn(),
  onAnimationEnd: vi.fn(),
  onVisibilityChange: vi.fn(),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("forwards load and animationend and stops after cleanup", () => {
  const image = new FakeImage();
  const spies = handlers();
  const stop = wireEmojiImage(asImage(image), spies);

  image.dispatchEvent(new Event("load"));
  image.dispatchEvent(new Event("animationend"));
  expect(spies.onLoad).toHaveBeenCalledTimes(1);
  expect(spies.onAnimationEnd).toHaveBeenCalledTimes(1);

  stop();
  image.dispatchEvent(new Event("load"));
  image.dispatchEvent(new Event("animationend"));
  expect(spies.onLoad).toHaveBeenCalledTimes(1);
  expect(spies.onAnimationEnd).toHaveBeenCalledTimes(1);
});

test("reports visible once without IntersectionObserver", () => {
  const spies = handlers();
  wireEmojiImage(asImage(new FakeImage()), spies);
  expect(spies.onVisibilityChange).toHaveBeenCalledWith(true);
  expect(spies.onLoad).not.toHaveBeenCalled();
});

test("an already decoded image counts as loaded on visibility", () => {
  const image = new FakeImage();
  image.complete = true;
  image.naturalWidth = 64;
  const spies = handlers();
  wireEmojiImage(asImage(image), spies);
  expect(spies.onLoad).toHaveBeenCalledTimes(1);
});

test("a complete image without width is not loaded", () => {
  const image = new FakeImage();
  image.complete = true;
  const spies = handlers();
  wireEmojiImage(asImage(image), spies);
  expect(spies.onLoad).not.toHaveBeenCalled();
});
