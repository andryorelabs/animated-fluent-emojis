import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  hreflangAlternates,
  LOCALE_CONFIG,
  localeFromSegment,
  localePath,
  LOCALES,
  localeUrl,
  splitLocalePath,
} from "./locales";

describe("locales", () => {
  it("lists the ten locales with English first", () => {
    expect(LOCALES).toHaveLength(10);
    expect(LOCALES[0]).toBe(DEFAULT_LOCALE);
  });

  it("serves English at the root and others under lowercase prefixes", () => {
    expect(localePath("en")).toBe("/");
    expect(localePath("es")).toBe("/es/");
    expect(localePath("pt-BR")).toBe("/pt-br/");
    expect(localePath("zh-CN", "/gallery/")).toBe("/zh-cn/gallery/");
    expect(localePath("de", "docs/")).toBe("/de/docs/");
  });

  it("builds absolute URLs", () => {
    expect(localeUrl("fr")).toBe("https://animated-fluent-emojis.andryore.dev/fr/");
  });

  it("resolves segments back to locales", () => {
    expect(localeFromSegment("pt-br")).toBe("pt-BR");
    expect(localeFromSegment("pt-BR")).toBeUndefined();
    expect(localeFromSegment(undefined)).toBeUndefined();
  });

  it("splits locale paths", () => {
    expect(splitLocalePath("/es/gallery/")).toEqual({
      locale: "es",
      path: "/gallery/",
    });
    expect(splitLocalePath("/gallery/")).toEqual({
      locale: "en",
      path: "/gallery/",
    });
    expect(splitLocalePath("/en/x/")).toEqual({ locale: "en", path: "/en/x/" });
  });

  it("emits an alternate per locale plus x-default pointing at English", () => {
    const alternates = hreflangAlternates("/");
    expect(alternates).toHaveLength(LOCALES.length + 1);
    expect(alternates.find((a) => a.hreflang === "pt-BR")?.href).toBe(
      "https://animated-fluent-emojis.andryore.dev/pt-br/",
    );
    expect(alternates.at(-1)).toEqual({
      hreflang: "x-default",
      href: "https://animated-fluent-emojis.andryore.dev/",
    });
  });
});

describe("LOCALE_CONFIG", () => {
  it("covers every locale", () => {
    expect(Object.keys(LOCALE_CONFIG).toSorted((a, b) => a.localeCompare(b))).toEqual(
      [...LOCALES].toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it("preloads Figtree latin only for Latin-script locales", () => {
    expect(LOCALE_CONFIG.en.preloadFonts).toEqual(["figtree-latin"]);
    expect(LOCALE_CONFIG.ru.preloadFonts).toEqual([]);
    expect(LOCALE_CONFIG.ja.preloadFonts).toEqual([]);
  });
});
