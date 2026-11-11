/* eslint-disable unicorn-js/isolated-functions -- the evaluated callback runs in the browser */
import { expect, test, type Page } from "@playwright/test";

const TRANSITION_KEY = "afe-view-transition";

/**
 * Records whether the browser created a view transition for the next
 * same-origin navigation, on both the outgoing and the incoming document.
 * @param page - The page whose next navigation is observed.
 */
async function recordViewTransitions(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    const record = (side: string, active: boolean) => {
      const previous = sessionStorage.getItem(key);
      const entries = previous ? (JSON.parse(previous) as string[]) : [];
      entries.push(`${side}:${String(active)}`);
      sessionStorage.setItem(key, JSON.stringify(entries));
    };
    addEventListener("pageswap", (event) => {
      record("swap", event.viewTransition !== null);
    });
    addEventListener("pagereveal", (event) => {
      record("reveal", event.viewTransition !== null);
    });
  }, TRANSITION_KEY);
}

async function navigateAndReadTransitions(page: Page): Promise<string[]> {
  await recordViewTransitions(page);
  await page.goto("/emojis/");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.evaluate(() => {
    globalThis.location.assign("/emojis/fire/");
  });
  await page.waitForURL(/\/emojis\/fire\/$/);
  await expect(page.locator("h1").first()).toBeVisible();
  return page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[],
    TRANSITION_KEY,
  );
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the preference is honoured by the browser", async ({ page }) => {
    await page.goto("/");
    expect(
      await page.evaluate(() => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches),
    ).toBe(true);
  });

  test("same-origin navigation creates no view transition", async ({ page }) => {
    const entries = await navigateAndReadTransitions(page);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter((entry) => entry.endsWith(":true"))).toEqual([]);
  });

  test("scroll-driven reveals are static and fully visible", async ({ page }) => {
    await page.goto("/");
    const reveals = page.locator(".scroll-reveal");
    expect(await reveals.count()).toBeGreaterThan(0);
    const states = await reveals.evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          animationName: style.animationName,
          timeline: style.animationTimeline,
          opacity: style.opacity,
          transform: style.transform,
        };
      }),
    );
    for (const state of states) {
      expect(state.animationName).toBe("none");
      expect(state.opacity).toBe("1");
      expect(state.transform).toBe("none");
      expect(["auto", "none"]).toContain(state.timeline);
    }
  });

  test("the floating dock snaps without moving", async ({ page }) => {
    await page.goto("/");
    const dock = page.locator(".dock-reveal");
    const motion = await dock.evaluate((element) => ({
      easing: getComputedStyle(element).animationTimingFunction,
      moving: element.getAnimations().flatMap((animation) =>
        (animation.effect as KeyframeEffect)
          .getKeyframes()
          .filter((keyframe) => keyframe.transform !== undefined)
          .map((keyframe) => String(keyframe.transform)),
      ),
    }));
    expect(motion.moving).toEqual([]);
    expect(motion.easing).toMatch(/^steps\(1(, jump-end)?\)(, steps\(1(, jump-end)?\))*$/);
  });

  test("no infinite animation runs on the landing page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      globalThis.scrollTo(0, globalThis.document.body.scrollHeight);
    });
    const infinite = await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations === Infinity &&
            animation.playState === "running",
        )
        .map((animation) => animation.id || animation.constructor.name),
    );
    expect(infinite).toEqual([]);
  });
});

test.describe("no preference", () => {
  test.use({ reducedMotion: "no-preference" });

  test("same-origin navigation does create a view transition", async ({ page }) => {
    const entries = await navigateAndReadTransitions(page);
    expect(entries.some((entry) => entry.endsWith(":true"))).toBe(true);
  });

  test("scroll reveals are driven by a view timeline", async ({ page }) => {
    await page.goto("/");
    const name = await page
      .locator(".scroll-reveal")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(name).toContain("scroll-reveal");
  });
});

/* eslint-enable unicorn-js/isolated-functions -- end of browser-evaluated code */
