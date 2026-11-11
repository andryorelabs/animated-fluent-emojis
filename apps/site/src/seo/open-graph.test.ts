import { describe, expect, it } from "vitest";

import { LOCALES } from "../i18n/locales";
import { buildSocialMeta, ogLocale, ogLocaleAlternates, SITE_OG_IMAGE_URL } from "./open-graph";

describe("ogLocale", () => {
  it("uses underscores for regional locales", () => {
    expect(ogLocale("pt-BR")).toBe("pt_BR");
    expect(ogLocale("zh-CN")).toBe("zh_CN");
    expect(ogLocale("en")).toBe("en_US");
  });

  it("has a distinct language_TERRITORY code for every locale", () => {
    const codes = LOCALES.map((locale) => ogLocale(locale));
    expect(new Set(codes).size).toBe(LOCALES.length);
    for (const code of codes) expect(code).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
  });
});

describe("ogLocaleAlternates", () => {
  it("lists every other locale and never the page locale", () => {
    const alternates = ogLocaleAlternates("de");
    expect(alternates).toHaveLength(LOCALES.length - 1);
    expect(alternates).not.toContain("de_DE");
    expect(alternates).toContain("en_US");
  });
});

describe("buildSocialMeta", () => {
  const tags = buildSocialMeta({
    locale: "es",
    title: "Title",
    description: "Description",
    image: SITE_OG_IMAGE_URL,
    imageAlt: "Alt",
  });
  const find = (key: string) => tags.filter((tag) => tag.key === key).map((tag) => tag.content);

  it("sets the locale and its alternates", () => {
    expect(find("og:locale")).toEqual(["es_ES"]);
    expect(find("og:locale:alternate")).toHaveLength(LOCALES.length - 1);
  });

  it("describes the card image", () => {
    expect(find("og:image")).toEqual([SITE_OG_IMAGE_URL]);
    expect(find("og:image:alt")).toEqual(["Alt"]);
    expect(find("og:image:width")).toEqual(["1200"]);
    expect(find("og:image:height")).toEqual(["630"]);
  });

  it("carries the full twitter card", () => {
    expect(find("twitter:card")).toEqual(["summary_large_image"]);
    expect(find("twitter:title")).toEqual(["Title"]);
    expect(find("twitter:description")).toEqual(["Description"]);
    expect(find("twitter:image")).toEqual([SITE_OG_IMAGE_URL]);
    expect(find("twitter:image:alt")).toEqual(["Alt"]);
  });
});
