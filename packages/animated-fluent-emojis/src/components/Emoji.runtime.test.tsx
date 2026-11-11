/// <reference types="@vitest/browser-playwright" />
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { cdp, page, server, userEvent } from "vitest/browser";

import { setReducedMotion } from "../test/set-reduced-motion.js";
import { Emoji } from "./Emoji.js";

const getImage = (name: string) => page.getByRole("img", { name });

const emulateReducedMotion = async (value: "reduce" | "no-preference") => {
  await setReducedMotion(value);
  await expect
    .poll(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
    .toBe(value === "reduce");
};

afterEach(async () => {
  await emulateReducedMotion("no-preference");
});

const getTransform = (image: ReturnType<typeof getImage>) =>
  getComputedStyle(image.element()).transform;

const expectStill = async (image: ReturnType<typeof getImage>) => {
  await expect
    .poll(() => {
      const element = image.element();
      return element instanceof HTMLImageElement && element.complete;
    })
    .toBe(true);
  const initial = getTransform(image);
  await new Promise((resolve) => {
    setTimeout(resolve, 150);
  });
  expect(getTransform(image)).toBe(initial);
  expect(image.element().getAnimations()).toHaveLength(0);
};

test("rests on the poster frame under reduced motion", async () => {
  await emulateReducedMotion("reduce");
  await render(<Emoji id="cat" animationIterations="infinite" />);

  const image = getImage("Cat");
  await expect.element(image).toBeVisible();
  await expectStill(image);
});

test("plays on hover under reduced motion with playOnHover", async () => {
  await emulateReducedMotion("reduce");
  await render(
    <>
      <Emoji id="cat" playOnHover />
      <div
        data-testid="away"
        style={{
          position: "fixed",
          right: 0,
          bottom: 0,
          width: 20,
          height: 20,
        }}
      />
    </>,
  );

  const image = getImage("Cat");
  await expect.element(image).toBeVisible();
  await userEvent.hover(page.getByTestId("away"));
  await expectStill(image);

  await userEvent.hover(image);
  await expect.poll(() => image.element().getAnimations().length).toBe(1);

  await userEvent.unhover(image);
  await expect.poll(() => image.element().getAnimations().length).toBe(0);
});

test("reacts when the reduced motion preference changes", async () => {
  await render(<Emoji id="cat" animationIterations="infinite" />);

  const image = getImage("Cat");
  await expect.poll(() => image.element().getAnimations().length).toBe(1);

  await emulateReducedMotion("reduce");
  await expect.poll(() => image.element().getAnimations().length).toBe(0);
});

test("plays while focus is inside a wrapping button with playOnHover", async () => {
  await render(
    <>
      <button type="button">
        <Emoji id="cat" autoPlay={false} playOnHover alt="" />
      </button>
      <input aria-label="next field" />
    </>,
  );

  const button = page.getByRole("button");
  const image = button.element().querySelector("img");
  if (!image) throw new Error("image not rendered");
  expect(image.getAnimations()).toHaveLength(0);

  await userEvent.tab();
  expect(document.activeElement).toBe(button.element());
  await expect.poll(() => image.getAnimations().length).toBe(1);

  await userEvent.tab();
  expect(document.activeElement).toBe(page.getByRole("textbox").element());
  await expect.poll(() => image.getAnimations().length).toBe(0);
});

test("does not play when only a distant ancestor has focus", async () => {
  await render(
    <main tabIndex={-1} data-testid="wrapper">
      <Emoji id="cat" autoPlay={false} playOnHover alt="" />
    </main>,
  );

  const wrapper = page.getByTestId("wrapper").element();
  const image = wrapper.querySelector("img");
  if (!image) throw new Error("image not rendered");

  if (!(wrapper instanceof HTMLElement)) throw new TypeError("wrapper missing");
  wrapper.focus();
  expect(document.activeElement).toBe(wrapper);
  await new Promise((resolve) => {
    setTimeout(resolve, 150);
  });
  expect(image.getAnimations()).toHaveLength(0);
});

test("renders where matchMedia is unavailable", async () => {
  vi.stubGlobal("matchMedia", undefined);
  try {
    await render(<Emoji id="cat" />);
    await expect.element(getImage("Cat")).toBeVisible();
  } finally {
    vi.unstubAllGlobals();
  }
});

test("uses the emoji description as alt text and has no title", async () => {
  await render(<Emoji id="cat" />);

  const image = getImage("Cat");
  await expect.element(image).toBeVisible();
  expect(image.element().parentElement?.hasAttribute("title")).toBe(false);
  expect(image.element().parentElement?.hasAttribute("aria-hidden")).toBe(false);
});

test("accepts a custom alt text", async () => {
  await render(<Emoji id="cat" alt="Sleepy cat" />);

  await expect.element(getImage("Sleepy cat")).toBeVisible();
});

test("marks the emoji as decorative with an empty alt", async () => {
  const { container } = await render(<Emoji id="cat" alt="" />);

  await expect.poll(() => container.querySelector("img")).not.toBeNull();
  const image = container.querySelector("img");
  expect(image?.getAttribute("alt")).toBe("");
  expect(image?.parentElement?.getAttribute("aria-hidden")).toBe("true");
});

test.skipIf(server.browser !== "chromium")(
  "still animates an hd emoji at device scale factor 2 (chromium only: Playwright cannot change the device scale factor of a live page in Firefox or WebKit)",
  async () => {
    await cdp().send("Emulation.setDeviceMetricsOverride", {
      width: 0,
      height: 0,
      deviceScaleFactor: 2,
      mobile: false,
    });
    try {
      await expect.poll(() => window.devicePixelRatio).toBe(2);
      await render(<Emoji id="waving-hand" animationIterations="infinite" />);

      const image = getImage("Waving hand");
      await expect.element(image).toBeVisible();
      await expect
        .poll(() => {
          const element = image.element();
          return element instanceof HTMLImageElement && element.currentSrc;
        })
        .toContain("@2x.png");
      const initial = getTransform(image);
      await expect.poll(() => getTransform(image)).not.toBe(initial);
    } finally {
      await cdp().send("Emulation.clearDeviceMetricsOverride");
    }
  },
);

test("loads the image lazily and decodes it asynchronously", async () => {
  await render(<Emoji id="cat" />);

  const image = getImage("Cat");
  await expect.element(image).toHaveAttribute("loading", "lazy");
  await expect.element(image).toHaveAttribute("decoding", "async");
});

test("shares one media query list across instances", async () => {
  const spy = vi.spyOn(globalThis, "matchMedia");
  try {
    await render(
      <>
        <Emoji id="cat" />
        <Emoji id="cat" />
        <Emoji id="cat" />
      </>,
    );
    await expect.element(getImage("Cat").first()).toBeVisible();
    const reducedMotionCalls = spy.mock.calls.filter(
      ([query]) => query === "(prefers-reduced-motion: reduce)",
    );
    expect(reducedMotionCalls.length).toBeLessThanOrEqual(1);
  } finally {
    spy.mockRestore();
  }
});
