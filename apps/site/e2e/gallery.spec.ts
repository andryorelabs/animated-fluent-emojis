import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/emojis/");
  await expect(page.locator("[data-slug]").first()).toBeVisible();
});

test("arrow keys, Home and End move focus across the results", async ({ page }) => {
  const cells = page.locator("[data-slug]");
  await cells.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(cells.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(cells.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(cells.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(cells.first()).toBeFocused();
});

test("Enter selects an emoji and shows its detail", async ({ page }) => {
  const cell = page.locator("[data-slug]").nth(1);
  await cell.focus();
  await page.keyboard.press("Enter");
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Copy id" })).toBeVisible();
});

test("copy id writes the emoji id to the clipboard", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("[data-slug]").first().click();
  await page.getByRole("button", { name: "Copy id" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
  const copied = await page.evaluate<string>("navigator.clipboard.readText()");
  expect(copied).not.toBe("");
});

test("copy URL action writes to the clipboard and announces it", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("[data-slug]").first().click();
  await page.getByRole("button", { name: "More file actions" }).click();
  await page.getByRole("menuitem", { name: /Copy GIF URL/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
  const copied = await page.evaluate<string>("navigator.clipboard.readText()");
  expect(copied).toMatch(/^https:\/\/.+\.gif$/);
});

test("file action menu offers download and copy per format and saves under the slug", async ({
  page,
}) => {
  const cell = page.locator("[data-slug]").first();
  const slug = await cell.getAttribute("data-slug");
  await cell.click();
  await page.getByRole("button", { name: "More file actions" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(6);
  const download = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: /Download PNG/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${slug ?? ""}.png`);
});

test("primary file action downloads WebP by default", async ({ page }) => {
  const cell = page.locator("[data-slug]").first();
  const slug = await cell.getAttribute("data-slug");
  await cell.click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download WebP" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${slug ?? ""}.webp`);
});

test("file action menu closes on Escape and returns focus to its trigger", async ({ page }) => {
  await page.locator("[data-slug]").first().click();
  const trigger = page.getByRole("button", { name: "More file actions" });
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("size segments switch by role and keep one pressed", async ({ page }) => {
  const size = page.getByRole("group", { name: "Size" });
  await size.getByRole("button", { name: "96" }).click();
  await expect(size.getByRole("button", { name: "96" })).toHaveAttribute("aria-pressed", "true");
  await expect(size.getByRole("button", { name: "64" })).toHaveAttribute("aria-pressed", "false");
});

test("size scales the grid, persists in the URL and survives reload", async ({ page }) => {
  const size = page.getByRole("group", { name: "Size" });
  const grid = page.getByRole("group", { name: "Emojis", exact: true });
  const firstEmoji = page.locator("[data-slug]").first().locator("span > *").first();
  const columnCount = async () =>
    grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  const initialColumns = await columnCount();
  const emojiWidth = async () => {
    const box = await firstEmoji.boundingBox();
    return box?.width ?? 0;
  };
  const initialWidth = await emojiWidth();
  expect(initialWidth).toBeGreaterThan(0);

  await size.getByRole("button", { name: "128" }).click();
  await expect(page).toHaveURL(/[?&]s=128/);
  await expect.poll(emojiWidth).toBeGreaterThan(initialWidth);
  expect(await columnCount()).toBeLessThan(initialColumns);

  await page.reload();
  await expect(size.getByRole("button", { name: "128" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/[?&]s=128/);

  await size.getByRole("button", { name: "64" }).click();
  await expect(page).not.toHaveURL(/[?&]s=/);
});

test("categories filter the grid and are pressed by role", async ({ page }) => {
  const categories = page.getByRole("group", { name: "Category" });
  const all = categories.getByRole("button").first();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  const second = categories.getByRole("button").nth(1);
  const label = await second.innerText();
  const count = label.trim().split(/\s+/).pop() ?? "";
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status").filter({ hasText: "emojis" })).toHaveText(
    `${count} emojis`,
  );
  await expect(page).toHaveURL(/[?&]c=/);
});

test("Ctrl+K focuses the search and typing updates the URL", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search emojis" });
  await page.locator("[data-slug]").first().focus();
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();
  await page.keyboard.type("fire");
  await expect(page).toHaveURL(/[?&]q=fire/);
});

test("the snippet adapter persists across reloads", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("[data-slug]").first().click();
  await page.getByRole("button", { name: "Copy React" }).waitFor();
  await page.getByRole("button", { name: "More snippet formats" }).click();
  await page.getByRole("menuitem", { name: "Vue" }).click();
  await expect(page.getByRole("button", { name: "Copy Vue" })).toBeVisible();
  const copied = await page.evaluate<string>("navigator.clipboard.readText()");
  expect(copied).toContain("animated-fluent-emojis/vue");
  expect(await page.evaluate<string | null>("localStorage.getItem('afe:snippet-adapter')")).toBe(
    "vue",
  );
  await page.reload();
  await page.locator("[data-slug]").first().click();
  await expect(page.getByRole("button", { name: "Copy Vue" })).toBeVisible();
});

test("Open page links to the emoji page", async ({ page }) => {
  const cell = page.locator("[data-slug]").first();
  const slug = await cell.getAttribute("data-slug");
  await cell.click();
  await expect(page.getByRole("link", { name: "Open page" })).toHaveAttribute(
    "href",
    `/emojis/${slug ?? ""}/`,
  );
});

test.describe("emoji sheet on a wide screen", () => {
  test.use({ viewport: { width: 1920, height: 900 } });

  test("the grid spans the container and the sheet docks at the bottom", async ({ page }) => {
    await page.goto("/emojis/");
    const grid = page.getByRole("group", { name: "Emojis" });
    const container = page.locator("main.site-container");
    await expect(grid).toBeVisible();
    const gridBox = await grid.boundingBox();
    const mainBox = await container.boundingBox();
    expect(gridBox?.width ?? 0).toBeGreaterThan(1100);
    expect(gridBox?.width ?? 0).toBeGreaterThan((mainBox?.width ?? 0) * 0.7);

    await page.locator("[data-slug]").first().click();
    const sheet = page.locator('[role="region"][aria-labelledby="emoji-sheet-heading"]');
    await expect(sheet).toBeVisible();
    const sheetBox = await sheet.boundingBox();
    expect((sheetBox?.y ?? 0) + (sheetBox?.height ?? 0)).toBeCloseTo(900, 0);
    expect(sheetBox?.width).toBe(1920);

    const second = page.locator("[data-slug]").nth(1);
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(sheet).toBeVisible();
  });

  test("Escape closes the sheet and focus stays on the tile", async ({ page }) => {
    await page.goto("/emojis/");
    const cell = page.locator("[data-slug]").first();
    await cell.click();
    const sheet = page.locator('[role="region"][aria-labelledby="emoji-sheet-heading"]');
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(cell).toBeFocused();
  });

  test("the close button closes the sheet and returns focus to the tile", async ({ page }) => {
    await page.goto("/emojis/");
    const cell = page.locator("[data-slug]").first();
    await cell.click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.locator('[role="region"][aria-labelledby="emoji-sheet-heading"]'),
    ).toBeHidden();
    await expect(cell).toBeFocused();
  });

  test("the last row stays reachable while the sheet is open", async ({ page }) => {
    await page.goto("/emojis/");
    await page.locator("[data-slug]").first().click();
    const sheet = page.locator('[role="region"][aria-labelledby="emoji-sheet-heading"]');
    await expect(sheet).toBeVisible();
    const last = page.locator("[data-slug]").last();
    await last.scrollIntoViewIfNeeded();
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    const lastBox = await last.boundingBox();
    const sheetBox = await sheet.boundingBox();
    expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual((sheetBox?.y ?? 0) + 1);
  });
});

test.describe("mobile sheet", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("filters sheet traps focus and returns it to the Filters button on Escape", async ({
    page,
  }) => {
    await page.goto("/emojis/");
    const trigger = page.getByRole("button", { name: "Filters" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Filters" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Category" })).toBeVisible();
    for (let press = 0; press < 40; press++) {
      await page.keyboard.press("Tab");
      await expect(dialog.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the emoji sheet stacks its columns inside 80vh and closes on Escape", async ({ page }) => {
    await page.goto("/emojis/");
    const cell = page.locator("[data-slug]").first();
    await cell.click();
    const sheet = page.locator('[role="region"][aria-labelledby="emoji-sheet-heading"]');
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box?.height ?? Infinity).toBeLessThanOrEqual(800 * 0.8 + 1);
    const copyId = await page.getByRole("button", { name: "Copy id" }).boundingBox();
    const download = await page.getByRole("button", { name: "Download WebP" }).boundingBox();
    expect(download?.y ?? 0).toBeGreaterThan(copyId?.y ?? Infinity);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(cell).toBeFocused();
  });
});
