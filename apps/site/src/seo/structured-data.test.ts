import { describe, expect, it } from "vitest";

import { buildStructuredData, serializeJsonLd } from "./structured-data";

type Node = Record<string, unknown>;

function graphOf(data: Record<string, unknown>): Node[] {
  return data["@graph"] as Node[];
}

function typesOf(data: Record<string, unknown>): unknown[] {
  return graphOf(data).map((node) => node["@type"]);
}

describe("buildStructuredData", () => {
  const home = buildStructuredData({
    locale: "en",
    siteName: "Site",
    title: "Home",
    description: "Desc",
    path: "/",
  });

  it("declares the schema.org context and a graph", () => {
    expect(home["@context"]).toBe("https://schema.org");
    expect(typesOf(home)).toEqual(["WebSite", "WebPage", "SoftwareSourceCode", "Person"]);
  });

  it("has no breadcrumb on the home page", () => {
    const page = graphOf(home).find((node) => node["@type"] === "WebPage");
    expect(page).not.toHaveProperty("breadcrumb");
  });

  it("links every reference to a node in the graph", () => {
    const ids = new Set(graphOf(home).map((node) => node["@id"]));
    const references = JSON.stringify(home).matchAll(/\{"@id":"([^"]+)"\}/g);
    for (const [, id] of references) expect(ids).toContain(id);
  });

  it("adds a localized breadcrumb trail below home", () => {
    const data = buildStructuredData({
      locale: "es",
      siteName: "Site",
      title: "Fire",
      description: "Desc",
      path: "/emojis/fire/",
      trail: [
        { name: "Gallery", path: "/emojis/" },
        { name: "Fire", path: "/emojis/fire/" },
      ],
    });
    const list = graphOf(data).find((node) => node["@type"] === "BreadcrumbList");
    expect(list?.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Site",
        item: "https://animated-fluent-emojis.andryore.dev/es/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Gallery",
        item: "https://animated-fluent-emojis.andryore.dev/es/emojis/",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Fire",
        item: "https://animated-fluent-emojis.andryore.dev/es/emojis/fire/",
      },
    ]);
    const page = graphOf(data).find((node) => node["@type"] === "WebPage");
    expect(page?.inLanguage).toBe("es");
    expect(page?.breadcrumb).toEqual({ "@id": list?.["@id"] });
  });
});

describe("serializeJsonLd", () => {
  it("escapes angle brackets so text cannot close the script", () => {
    const output = serializeJsonLd({ name: "</script><b>" });
    expect(output).not.toContain("<");
    expect(JSON.parse(output)).toEqual({ name: "</script><b>" });
  });
});
