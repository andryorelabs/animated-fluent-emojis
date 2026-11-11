import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { FIXTURE_MANIFEST } from "../test/manifest-fixture.js";
import { configureEmojis } from "../utils/index.js";
import { createEmoji, type EmojiController } from "./create-emoji.js";

const host = document.createElement("div");
const controllers: EmojiController[] = [];

const mount = (options: Parameters<typeof createEmoji>[1]): EmojiController => {
  const controller = createEmoji(host, options);
  controllers.push(controller);
  return controller;
};

const waitForImage = async (): Promise<HTMLImageElement> => {
  return vi.waitFor(
    () => {
      const image = host.querySelector("img");
      if (!image) throw new Error("image not rendered");
      return image;
    },
    { timeout: 5000 },
  );
};

beforeEach(() => {
  document.body.append(host);
  configureEmojis({});
});

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("renders a sized placeholder while the manifest loads, then the image", async () => {
  let isReleased = false;
  vi.stubGlobal("fetch", async () => {
    await vi.waitFor(
      () => {
        expect(isReleased).toBe(true);
      },
      { timeout: 5000 },
    );
    return Response.json(FIXTURE_MANIFEST);
  });
  configureEmojis({ assetSiteUrl: "https://vanilla-loading.test" });

  mount({ id: "cat", size: 64 });

  const placeholder = host.querySelector("span");
  expect(host.querySelector("img")).toBeNull();
  expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
  expect(placeholder?.getBoundingClientRect().width).toBe(64);
  expect(placeholder?.getBoundingClientRect().height).toBe(64);

  isReleased = true;
  const image = await waitForImage();
  expect(host.querySelectorAll("span")).toHaveLength(1);
  expect(image.parentElement).toBe(host.querySelector("span"));
  expect(host.querySelector("span")?.hasAttribute("aria-hidden")).toBe(false);
});

test("renders the ready image with the description, lazy loading and sprite source", async () => {
  mount({ id: "waving-hand", size: 48, skinTone: "medium" });

  const image = await waitForImage();
  const root = host.firstElementChild as HTMLElement;
  expect(image.alt).toBe("Waving hand");
  expect(image.loading).toBe("lazy");
  expect(image.getAttribute("draggable")).toBe("false");
  expect(image.src).toContain("/waving-hand_s4.etag-wave.png");
  expect(image.getAttribute("srcset")).toContain("@2x");
  expect(image.getAttribute("sizes")).toBe("48px");
  expect(root.style.width).toBe("48px");
  expect(root.style.height).toBe("48px");
  expect(image.style.animationDuration).toBe(`${String(21 / 24)}s`);
});

test("omits sizes for a CSS length size so the lazy image is not size-contained", async () => {
  mount({ id: "waving-hand", size: "100%" });

  const image = await waitForImage();
  expect(image.hasAttribute("sizes")).toBe(false);
});

test("an unknown id renders nothing, or the fallback node", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => 0 as never);
  mount({ id: "no-such-emoji" });
  await expect.poll(() => host.childElementCount).toBe(0);

  const fallback = document.createElement("b");
  fallback.textContent = "?";
  mount({ id: "no-such-emoji", fallback });

  await expect.poll(() => host.querySelector("b")).toBe(fallback);
  expect(fallback.parentElement?.tagName).toBe("SPAN");
});

test("a manifest error reports onError once and renders a fallback function", async () => {
  vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 500 })));
  configureEmojis({ assetSiteUrl: "https://vanilla-failing.test" });
  const onError = vi.fn();
  const fallback = vi.fn(() => {
    const node = document.createElement("i");
    node.textContent = "x";
    return node;
  });

  mount({ id: "cat", onError, fallback });

  await expect.poll(() => host.querySelector("i")).not.toBeNull();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith();
  expect(fallback).toHaveBeenCalledTimes(1);
  expect(host.querySelector("img")).toBeNull();
});

test("a failed sprite renders the Unicode glyph and reports the error", async () => {
  const onError = vi.fn();
  mount({ id: "cat", size: 40, alt: "A cat", onError });
  const image = await waitForImage();

  image.dispatchEvent(new Event("error"));

  const glyph = await vi.waitFor(() => {
    const element = host.querySelector('[role="img"]');
    expect(element).not.toBeNull();
    return element as HTMLElement;
  });
  expect(glyph.textContent).toBe("🐱");
  expect(glyph.getAttribute("aria-label")).toBe("A cat");
  expect(glyph.style.fontSize).toBe("30px");
  expect(host.querySelector("img")).toBeNull();
  expect(onError).toHaveBeenCalledTimes(1);
});

test("a failed sprite removes the root when the emoji has no Unicode character", async () => {
  const manifest = structuredClone(FIXTURE_MANIFEST);
  for (const category of manifest.categories) {
    for (const emoticon of category.emoticons) delete emoticon.unicode;
  }
  vi.stubGlobal("fetch", () => Promise.resolve(Response.json(manifest)));
  configureEmojis({ assetSiteUrl: "https://vanilla-no-unicode.test" });
  mount({ id: "cat" });

  await expect
    .poll(
      () => {
        host.querySelector("img")?.dispatchEvent(new Event("error"));
        return host.childElementCount;
      },
      { timeout: 5000 },
    )
    .toBe(0);
});

test("a failed sprite renders a custom fallback node", async () => {
  const fallback = document.createElement("b");
  fallback.textContent = "?";
  mount({ id: "cat", fallback });
  const image = await waitForImage();

  image.dispatchEvent(new Event("error"));

  await expect.poll(() => host.querySelector("b")).toBe(fallback);
  expect(host.querySelector("img")).toBeNull();
});

test("a failed sprite with a null fallback renders nothing and retries when online", async () => {
  mount({ id: "cat", fallback: null });
  const image = await waitForImage();

  image.dispatchEvent(new Event("error"));
  await expect.poll(() => host.childElementCount).toBe(0);

  globalThis.dispatchEvent(new Event("online"));
  await expect.poll(() => host.querySelector("img")).not.toBeNull();
});

test("update changes options in place and swaps the sprite for a new skin tone", async () => {
  const controller = mount({ id: "waving-hand", size: 32 });
  const image = await waitForImage();
  const root = host.firstElementChild as HTMLElement;

  controller.update({ size: 80, className: "big", alt: "" });

  expect(host.firstElementChild).toBe(root);
  expect(host.querySelector("img")).toBe(image);
  expect(root.style.width).toBe("80px");
  expect(root.className).toBe("big");
  expect(root.getAttribute("aria-hidden")).toBe("true");

  controller.update({ skinTone: "dark" });
  await expect.poll(() => host.querySelector("img")).not.toBe(image);
  expect(host.querySelector("img")?.src).toContain("_s6.");

  controller.update({ id: "cat" });
  await expect.poll(() => host.querySelector("img")?.src).toContain("/cat.etag-cat.png");
});

test("onLoad and onPlaybackEnd are reported", async () => {
  const onLoad = vi.fn();
  const onPlaybackEnd = vi.fn();
  mount({ id: "cat", onLoad, onPlaybackEnd, animationIterations: 1 });
  const image = await waitForImage();

  await expect.poll(() => onLoad.mock.calls.length).toBe(1);
  image.dispatchEvent(new Event("animationend"));
  image.dispatchEvent(new Event("animationend"));

  expect(onPlaybackEnd).toHaveBeenCalledTimes(1);
});

test("style, attributes and playOnHover apply to the root", async () => {
  const controller = mount({
    id: "cat",
    style: { color: "red", "--tone": "1" },
    attributes: { "data-test": "a" },
    playOnHover: true,
    animationIterations: 1,
  });
  const image = await waitForImage();
  const root = host.firstElementChild as HTMLElement;
  expect(root.style.color).toBe("red");
  expect(root.style.getPropertyValue("--tone")).toBe("1");
  expect(root.dataset.test).toBe("a");

  image.dispatchEvent(new Event("animationend"));
  expect(root.className).not.toBe("");

  controller.update({ attributes: {} });
  expect(Object.hasOwn(root.dataset, "test")).toBe(false);
});

test("destroy removes the DOM and leaves no listeners or observers behind", async () => {
  const addSpy = vi.spyOn(globalThis, "addEventListener");
  const removeSpy = vi.spyOn(globalThis, "removeEventListener");
  const documentAdd = vi.spyOn(document, "addEventListener");
  const documentRemove = vi.spyOn(document, "removeEventListener");
  const observe = vi.spyOn(IntersectionObserver.prototype, "observe");
  const unobserve = vi.spyOn(IntersectionObserver.prototype, "unobserve");
  const controller = mount({ id: "cat" });
  const image = await waitForImage();
  const imageRemove = vi.spyOn(image, "removeEventListener");

  controller.destroy();

  expect(host.childElementCount).toBe(0);
  expect(unobserve.mock.calls.map(([target]) => target)).toEqual(
    observe.mock.calls.map(([target]) => target),
  );
  expect(new Set(imageRemove.mock.calls.map(([type]) => type))).toEqual(
    new Set(["animationend", "load"]),
  );
  const balance = (adds: typeof addSpy, removes: typeof removeSpy): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const [type] of adds.mock.calls) {
      counts[type] = (counts[type] ?? 0) + 1;
    }
    for (const [type] of removes.mock.calls) {
      counts[type] = (counts[type] ?? 0) - 1;
    }
    return counts;
  };
  expect(Object.values(balance(addSpy, removeSpy)).every((n) => n <= 0)).toBe(true);
  expect(Object.values(balance(documentAdd, documentRemove)).every((n) => n <= 0)).toBe(true);

  controller.update({ size: 10 });
  expect(host.childElementCount).toBe(0);
  controller.destroy();
});

test("mounted emojis share one online listener", async () => {
  const addSpy = vi.spyOn(globalThis, "addEventListener");
  for (let index = 0; index < 10; index += 1) mount({ id: "cat" });

  await expect.poll(() => host.querySelectorAll("img").length).toBe(10);
  expect(addSpy.mock.calls.filter(([type]) => type === "online")).toHaveLength(1);
});
