import { describe, expect, it } from "vitest";

import { LOCALES } from "../i18n/locales";
import { loadChangelogPages } from "./changelog-pages";
import { CHANGELOG_FILE } from "./paths";

describe("loadChangelogPages", () => {
  it("builds one page per locale with English text", () => {
    const pages = loadChangelogPages(CHANGELOG_FILE);
    expect(pages).toHaveLength(LOCALES.length);
    expect(pages.find((page) => page.locale === "en")?.id).toBe("changelog");
    expect(pages.find((page) => page.locale === "es")?.id).toBe("es/changelog");
    expect(new Set(pages.map((page) => page.body)).size).toBe(1);
    expect(pages.find((page) => page.locale === "es")?.status).toBe("missing");
  });
});
