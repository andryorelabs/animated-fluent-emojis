import { describe, expect, it } from "vitest";

import { buildSitemapXml, collectSitemapRoutes, coreSitemapSource } from "./sitemap";

describe("sitemap", () => {
  it("expands a localized route to every locale with alternates", () => {
    const xml = buildSitemapXml(coreSitemapSource());
    expect(xml.match(/<url>/g)).toHaveLength(10);
    expect(xml).toContain("<loc>https://animated-fluent-emojis.andryore.dev/pt-br/</loc>");
    expect(xml).toContain('hreflang="x-default"');
    expect(xml.match(/hreflang="es"/g)).toHaveLength(10);
  });

  it("lists a non-localized route once, with lastmod and escaping", () => {
    const xml = buildSitemapXml([{ path: "/a&b/", localized: false, lastmod: "2026-01-02" }]);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain("/a&amp;b/</loc>");
    expect(xml).toContain("<lastmod>2026-01-02</lastmod>");
    expect(xml).not.toContain("xhtml:link");
  });

  it("accepts routes from other sources and drops duplicates", async () => {
    const routes = await collectSitemapRoutes([
      coreSitemapSource,
      () => [
        { path: "/gallery/", localized: true },
        { path: "/", localized: true },
      ],
      () => Promise.resolve([{ path: "/async/", localized: true }]),
    ]);
    expect(routes.map((route) => route.path)).toEqual(["/", "/gallery/", "/async/"]);
  });
});
