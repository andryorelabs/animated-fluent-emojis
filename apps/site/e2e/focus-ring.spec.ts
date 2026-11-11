import { expect, test, type Locator, type Page } from "@playwright/test";

import { docRoute } from "../src/docs/published";
import { DEFAULT_LOCALE } from "../src/i18n/locales";

const SCHEMES = ["light", "dark"] as const;

interface FocusTarget {
  name: string;
  path: string;
  locate: (page: Page) => Locator;
  open?: (page: Page) => Promise<void>;
  menuItemRole?: "menuitem" | "menuitemradio";
}

async function hydrateHeader(page: Page) {
  await expect(page.locator('astro-island[component-url*="HeaderMenus"]')).not.toHaveAttribute(
    "ssr",
    /.*/,
  );
}

async function openMenu(page: Page, name: string) {
  await hydrateHeader(page);
  await page.getByRole("button", { name, exact: true }).focus();
  await page.keyboard.press("Enter");
}

const TARGETS: readonly FocusTarget[] = [
  {
    name: "header logo link",
    path: "/",
    locate: (page) => page.locator("header a").first(),
  },
  {
    name: "repository link",
    path: "/",
    locate: (page) => page.locator('header a[target="_blank"]').first(),
  },
  {
    name: "theme trigger",
    path: "/",
    locate: (page) => page.getByRole("button", { name: "Theme", exact: true }),
    open: hydrateHeader,
  },
  {
    name: "theme item",
    path: "/",
    locate: (page) => page.getByRole("menuitemradio").first(),
    menuItemRole: "menuitemradio",
    open: (page) => openMenu(page, "Theme"),
  },
  {
    name: "language item",
    path: "/",
    locate: (page) => page.getByRole("menuitem").first(),
    menuItemRole: "menuitem",
    open: (page) => openMenu(page, "Language"),
  },
  {
    name: "home install copy button",
    path: "/",
    locate: (page) => page.getByRole("button", { name: /copy/i }).first(),
  },
  {
    name: "gallery emoji cell",
    path: "/emojis/",
    locate: (page) => page.locator("[data-slug]").first(),
  },
  {
    name: "gallery search input",
    path: "/emojis/",
    locate: (page) => page.getByRole("searchbox").first(),
  },
  {
    name: "emoji page copy button",
    path: "/emojis/fire/",
    locate: (page) => page.getByRole("button", { name: /^copy/i }).first(),
  },
  {
    name: "docs install tab",
    path: docRoute(DEFAULT_LOCALE, "usage.md"),
    locate: (page) => page.locator(".afe-install-tabs button").first(),
  },
  {
    name: "docs copy button",
    path: docRoute(DEFAULT_LOCALE, "usage.md"),
    locate: (page) => page.locator(".afe-install-copy").first(),
  },
];

function isVisibleColor(color: string) {
  return color !== "transparent" && !/(?:,|\/)\s*0\)$/.test(color);
}

function hasVisibleRing(boxShadow: string) {
  return boxShadow.split(/,\s*(?![^(]*\))/).some((shadow) => {
    const color = /^(?:rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/.exec(shadow.trim());
    const spread = shadow
      .replace(/^[^)]*\)/, "")
      .trim()
      .split(/\s+/, 4)[3];
    return (
      color !== null &&
      isVisibleColor(color[0]) &&
      Number(spread?.replace("px", "") ?? 0) > 0 &&
      !/\binset\b/.test(shadow)
    );
  });
}

async function readIndicator(target: Locator) {
  const style = await target.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      outlineColor: computed.outlineColor,
      boxShadow: computed.boxShadow,
      focusVisible: element.matches(":focus-visible"),
    };
  });
  const outlineVisible =
    style.outlineStyle !== "none" &&
    Number(style.outlineWidth.replace("px", "")) > 0 &&
    isVisibleColor(style.outlineColor);
  return {
    outlineVisible,
    ringVisible: hasVisibleRing(style.boxShadow),
    focusVisible: style.focusVisible,
  };
}

function backgroundOf(target: Locator) {
  return target.evaluate((element) => getComputedStyle(element).backgroundColor);
}

for (const colorScheme of SCHEMES) {
  for (const { name, path, locate, open, menuItemRole } of TARGETS) {
    test(`the ${name} shows a focus ring in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await open?.(page);
      if (!open) await page.keyboard.press("Tab");
      const target = locate(page);
      await expect(target).toBeVisible();
      await target.focus();
      if (menuItemRole) {
        const idle = page.getByRole(menuItemRole).last();
        await expect
          .poll(async () => (await backgroundOf(target)) !== (await backgroundOf(idle)))
          .toBe(true);
        return;
      }
      await expect
        .poll(async () => {
          const { outlineVisible, ringVisible, focusVisible } = await readIndicator(target);
          return focusVisible && (outlineVisible || ringVisible);
        })
        .toBe(true);
    });
  }
}
