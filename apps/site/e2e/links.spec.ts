import { expect, test } from "@playwright/test";

import { docRoute } from "../src/docs/published";
import { localePath } from "../src/i18n/locales";

const CRAWLED_PATHS = [
  localePath("en"),
  localePath("en", "/emojis/"),
  localePath("en", "/emojis/fire/"),
  docRoute("en", "usage.md"),
];

for (const path of CRAWLED_PATHS) {
  test(`${path} internal links answer 200 without redirecting`, async ({ page, request }) => {
    await page.goto(path);
    const { origin } = new URL(page.url());
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));

    const targets = new Set<string>();
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== origin) continue;
      targets.add(`${url.pathname}${url.search}`);
    }
    expect(targets.size).toBeGreaterThan(0);

    for (const target of targets) {
      const response = await request.get(target, { maxRedirects: 0 });
      expect(response.status(), target).toBe(200);
    }
  });
}
