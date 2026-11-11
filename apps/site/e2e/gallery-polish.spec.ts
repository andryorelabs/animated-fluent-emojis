import { expect, test } from "@playwright/test";

test.describe("coarse pointer", () => {
  test.use({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
  });

  test("the search input is at least 16px so iOS and Android do not zoom", async ({ page }) => {
    await page.goto("/emojis/");
    const search = page.getByRole("searchbox");
    await expect(search).toBeVisible();
    const fontSize = await search.evaluate((element) =>
      Number(getComputedStyle(element).fontSize.replace("px", "")),
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
    await expect(search).toHaveAttribute("enterkeyhint", "search");
    await expect(search).toHaveAttribute("autocapitalize", "none");
    await expect(search).toHaveAttribute("spellcheck", "false");
  });

  test("the results counter is visually hidden below 480px but stays announced", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/emojis/");
    await expect(page.locator("[data-slug]").first()).toBeVisible();
    const counter = page.getByRole("status");
    await expect(counter).toHaveCount(1);
    const box = await counter.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(1);
    expect(box?.height).toBeLessThanOrEqual(1);
  });
});

test("loading to ready does not shift the layout", async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.assign(globalThis, { layoutShifts: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) shifts.push(shift.value);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/emojis/");
  await expect(page.locator("[data-slug]").first()).toBeVisible();
  await page.waitForTimeout(500);
  const total = await page.evaluate(() =>
    (globalThis as unknown as { layoutShifts: number[] }).layoutShifts.reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
  expect(total).toBeLessThan(0.01);
});

test("filtering never re-triggers the grid fade", async ({ page }) => {
  await page.goto("/emojis/");
  const cell = page.locator("[data-slug]").first();
  await expect(cell).toBeVisible();
  await page.waitForTimeout(400);
  const search = page.getByRole("searchbox");
  await search.fill("zzzzzz");
  await expect(page.locator("[data-slug]")).toHaveCount(0);
  await search.fill("");
  await expect(cell).toBeVisible();
  const running = await page.evaluate(
    () =>
      globalThis.document
        .getAnimations()
        .filter(
          (animation) =>
            "transitionProperty" in animation && animation.transitionProperty === "opacity",
        ).length,
  );
  expect(running).toBe(0);
});

test.describe("view transitions", () => {
  test("nothing is named before a click and only the leaving tile is named on navigation", async ({
    page,
  }) => {
    await page.goto("/emojis/");
    const tile = page.locator("[data-slug]").first();
    await expect(tile).toBeVisible();
    const slug = await tile.getAttribute("data-slug");
    const countNamed = () =>
      page.evaluate(
        () =>
          [...globalThis.document.querySelectorAll<HTMLElement>("*")].filter(
            (element) => element.style.viewTransitionName !== "",
          ).length,
      );
    expect(await countNamed()).toBe(0);

    await page.evaluate(() => {
      globalThis.addEventListener("pageswap", () => {
        const names = [...globalThis.document.querySelectorAll<HTMLElement>("*")]
          .map((element) => element.style.viewTransitionName)
          .filter((name) => name !== "");
        globalThis.sessionStorage.setItem("named-on-swap", JSON.stringify(names));
      });
    });
    await tile.click();
    await page.getByRole("link", { name: "Open page" }).click();
    await expect(page).toHaveURL(new RegExp(`/emojis/${slug ?? ""}/$`));
    const names = await page.evaluate(
      () => JSON.parse(globalThis.sessionStorage.getItem("named-on-swap") ?? "[]") as string[],
    );
    expect(names).toEqual([`emoji-${slug ?? ""}`]);
  });

  test("the detail page names the square emoji wrapper, not the stage", async ({ page }) => {
    await page.goto("/emojis/");
    const slug = await page.locator("[data-slug]").first().getAttribute("data-slug");
    await page.goto(`/emojis/${slug ?? ""}/`);
    const named = page.locator(`[style*="view-transition-name:emoji-${slug ?? ""}"]`);
    await expect(named).toHaveCount(1);
    const box = await named.boundingBox();
    expect(box?.width).toBeCloseTo(box?.height ?? -1, 0);
  });
});

test("tiles show posters and fetch a sprite sheet only after hover", async ({ page }) => {
  const spriteRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/v1/sprites/")) {
      spriteRequests.push(request.url());
    }
  });
  await page.goto("/emojis/");
  const tile = page.locator("[data-slug]").first();
  await expect(tile.locator("img")).toBeVisible();
  expect(spriteRequests).toHaveLength(0);
  await tile.hover();
  await expect.poll(() => spriteRequests.length).toBeGreaterThan(0);
});
