import { expect, test, type Page } from "@playwright/test";

const THEME_STORAGE_KEY = "afe:theme";

async function expectShimmerAnimation(
  page: Page,
  reducedMotion: "reduce" | "no-preference",
  expected: { host: string; sweep: string },
) {
  await page.emulateMedia({ reducedMotion });
  await page.route("**/index.json", (route) => route.request());
  await page.goto("/emojis/");
  await expect
    .poll(() =>
      page
        .locator(".shimmer")
        .first()
        .evaluate((element) => ({
          host: getComputedStyle(element).animationName,
          sweep: getComputedStyle(element, "::after").animationName,
        })),
    )
    .toEqual(expected);
}

async function chooseTheme(page: Page, name: "System" | "Light" | "Dark") {
  await expect(page.locator('astro-island[component-url*="HeaderMenus"]')).not.toHaveAttribute(
    "ssr",
    /.*/,
  );
  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name }).click();
  await expect(page.getByRole("menu")).toBeHidden();
}

test("the theme menu selects light and dark and remembers the choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");

  await expect(html).not.toHaveClass(/dark/);
  await chooseTheme(page, "Dark");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);
  expect(await page.evaluate<string | null>(`localStorage.getItem('${THEME_STORAGE_KEY}')`)).toBe(
    "dark",
  );

  await chooseTheme(page, "Light");
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).not.toHaveClass(/dark/);

  await chooseTheme(page, "System");
  await expect(html).toHaveAttribute("data-theme", "system");
  expect(
    await page.evaluate<string | null>(`localStorage.getItem('${THEME_STORAGE_KEY}')`),
  ).toBeNull();
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`the theme menu applies a choice with reduced motion ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion });
    await page.goto("/");
    const html = page.locator("html");

    await chooseTheme(page, "Dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveClass(/dark/);

    await chooseTheme(page, "Light");
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(html).not.toHaveClass(/dark/);

    await chooseTheme(page, "Dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveClass(/dark/);
  });
}

test("the system theme follows the browser color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).not.toHaveClass(/dark/);
});

test("a stored override ignores system changes and sets theme-color", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(`localStorage.setItem('${THEME_STORAGE_KEY}', 'dark')`);
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
    "content",
    "#0d1715",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveClass(/dark/);
});

test("a stored theme is applied before the body is parsed", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(`localStorage.setItem('${THEME_STORAGE_KEY}', 'dark')`);
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (
        document.documentElement.classList.contains("dark") &&
        document.querySelector("body") === null
      ) {
        sessionStorage.setItem("dark-before-body", "yes");
      }
    }).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"],
    });
  });
  await page.goto("/");
  expect(await page.evaluate<string | null>(`sessionStorage.getItem('dark-before-body')`)).toBe(
    "yes",
  );
});

test.describe("reduced motion", () => {
  test("swaps the loading sweep for a gentle pulse", async ({ page }) => {
    await expectShimmerAnimation(page, "reduce", {
      host: "shimmer-pulse",
      sweep: "none",
    });
  });

  test("keeps the loading sweep otherwise", async ({ page }) => {
    await expectShimmerAnimation(page, "no-preference", {
      host: "none",
      sweep: "shimmer",
    });
  });
});

test("the header logo uses the animated mark inlined by the bundler", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('header img[width="28"]').first()).toHaveAttribute(
    "src",
    /keyframes%20hop.*prefers-reduced-motion/,
  );
});
