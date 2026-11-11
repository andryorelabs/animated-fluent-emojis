import { afterEach, test as baseTest, beforeEach, describe, expect, vi } from "vitest";

import { configureEmojis } from "../../utils/index.js";
import { FIXTURE_MANIFEST } from "../manifest-fixture.js";
import { setReducedMotion } from "../set-reduced-motion.js";
import type { ConformanceDriverFactory, ConformanceOptions } from "./driver.js";

const pause = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const setDocumentHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

const emulateReducedMotion = async (value: "reduce" | "no-preference") => {
  await setReducedMotion(value);
  await expect
    .poll(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
    .toBe(value === "reduce");
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers narrow the element type, as querySelector does
const queryDeep = <T extends Element = Element>(root: ParentNode, selector: string): T | null => {
  const direct = root.querySelector<T>(selector);
  if (direct) return direct;
  for (const element of root.querySelectorAll("*")) {
    if (!element.shadowRoot) continue;
    const nested = queryDeep<T>(element.shadowRoot, selector);
    if (nested) return nested;
  }
  return null;
};

const configureIsolatedSite = (): void => {
  configureEmojis({
    assetSiteUrl: `https://conformance-${crypto.randomUUID()}.test`,
  });
};

/**
 * Registers the shared behaviour spec for one framework adapter. Every
 * adapter plugs in by supplying a driver; see the driver contract in
 * `docs/development.md#testing`.
 * @param adapterName - Names the `describe` block.
 * @param createDriver - Returns a fresh driver for each test.
 * @param omittedBehaviours - Titles of tests that cannot apply to the adapter, such as the loading placeholder of an adapter that renders on the server.
 */
export const defineConformanceSuite = (
  adapterName: string,
  createDriver: ConformanceDriverFactory,
  omittedBehaviours: readonly string[] = [],
): void => {
  const test = (name: string, run: () => Promise<void>): void => {
    if (omittedBehaviours.includes(name)) baseTest.skip(name, run);
    else baseTest(name, run);
  };
  describe(`conformance: ${adapterName}`, () => {
    let container: HTMLElement;
    const driver = { current: createDriver() };

    const mount = async (options: ConformanceOptions): Promise<void> => {
      await driver.current.mount(container, options);
    };
    const getImage = () => queryDeep<HTMLImageElement>(container, "img");
    const getGlyph = () => queryDeep(container, '[role="img"]');
    const getPlayState = () => getImage()?.style.animationPlayState;
    const waitForRunning = () => expect.poll(getPlayState, { timeout: 5000 }).toBe("running");

    beforeEach(() => {
      driver.current = createDriver();
      container = document.createElement("div");
      document.body.append(container);
      configureEmojis({});
    });

    afterEach(async () => {
      await driver.current.unmount();
      container.remove();
      Reflect.deleteProperty(document, "hidden");
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      await emulateReducedMotion("no-preference");
    });

    test("shows a sized, hidden placeholder, then the ready image", async () => {
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
      configureIsolatedSite();

      await mount({ id: "cat", size: 64 });

      const placeholder = queryDeep<HTMLElement>(container, "span");
      expect(getImage()).toBeNull();
      expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
      expect(placeholder?.getBoundingClientRect().width).toBe(64);

      isReleased = true;
      await expect.poll(getImage, { timeout: 5000 }).not.toBeNull();
      const image = getImage();
      expect(image?.alt).toBe("Cat");
      expect(image?.parentElement?.style.width).toBe("64px");
      expect(image?.parentElement?.hasAttribute("aria-hidden")).toBe(false);
    });

    test("an unknown id renders nothing", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => 0 as never);
      await mount({ id: "no-such-emoji" });

      await pause(100);
      expect(queryDeep(container, 'img, [role="img"]')).toBeNull();
    });

    test("a manifest error reports onError once and renders nothing", async () => {
      vi.spyOn(console, "error").mockImplementation(() => 0 as never);
      vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 500 })));
      configureIsolatedSite();
      const onError = vi.fn();

      await mount({ id: "cat", onError });

      await expect.poll(() => onError.mock.calls.length).toBe(1);
      await pause(100);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(queryDeep(container, 'img, [role="img"]')).toBeNull();
    });

    test("a failed sprite falls back to the Unicode glyph and reports the error", async () => {
      const onError = vi.fn();
      await mount({ id: "cat", size: 40, alt: "A cat", onError });
      await expect.poll(getImage, { timeout: 5000 }).not.toBeNull();

      getImage()?.dispatchEvent(new Event("error"));

      await expect.poll(getGlyph).not.toBeNull();
      expect(getGlyph()?.textContent).toBe("🐱");
      expect(getGlyph()?.getAttribute("aria-label")).toBe("A cat");
      expect(getImage()).toBeNull();
      expect(onError).toHaveBeenCalledTimes(1);
    });

    test("plays only once the image has loaded", async () => {
      await mount({ id: "cat", animationIterations: "infinite" });

      await waitForRunning();
      expect(getImage()?.complete).toBe(true);
    });

    test("reduced motion keeps the poster frame", async () => {
      await emulateReducedMotion("reduce");
      await mount({ id: "cat", animationIterations: "infinite" });
      await expect.poll(() => getImage()?.complete).toBe(true);

      await pause(150);
      expect(getPlayState()).not.toBe("running");
    });

    test("stays paused out of the viewport and resumes on return", async () => {
      const scroller = document.createElement("div");
      scroller.style.cssText = "height:100px;overflow:auto";
      const spacer = document.createElement("div");
      spacer.style.height = "2000px";
      scroller.append(spacer, container);
      document.body.append(scroller);

      await mount({ id: "cat", size: 50, animationIterations: "infinite" });
      await expect.poll(() => getImage()?.complete).toBe(true);
      await pause(100);
      expect(getPlayState()).toBe("paused");

      scroller.scrollTop = 2000;
      await waitForRunning();
      scroller.scrollTop = 0;
      await expect.poll(getPlayState).toBe("paused");
      scroller.remove();
    });

    test("pauses while the tab is hidden and resumes when visible", async () => {
      await mount({ id: "cat", animationIterations: "infinite" });
      await waitForRunning();

      setDocumentHidden(true);
      await expect.poll(getPlayState).toBe("paused");

      setDocumentHidden(false);
      await waitForRunning();
    });

    test("playing true overrides autoPlay and reduced motion; false pauses", async () => {
      await emulateReducedMotion("reduce");
      await mount({
        id: "cat",
        autoPlay: false,
        animationIterations: "infinite",
        playing: true,
      });
      await waitForRunning();

      await driver.current.update({
        id: "cat",
        animationIterations: "infinite",
        playing: false,
      });
      await expect.poll(getPlayState).toBe("paused");
      expect(getImage()?.style.animationName).not.toBe("none");

      await driver.current.update({
        id: "cat",
        animationIterations: "infinite",
        playing: true,
      });
      await waitForRunning();
    });

    test("reports the end of a finite run exactly once", async () => {
      const onPlaybackEnd = vi.fn();
      await mount({ id: "waving-hand", animationIterations: 1, onPlaybackEnd });

      await expect.poll(() => onPlaybackEnd.mock.calls.length, { timeout: 5000 }).toBe(1);
      await pause(150);
      expect(onPlaybackEnd).toHaveBeenCalledTimes(1);
    });
  });
};
