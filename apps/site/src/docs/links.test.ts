import { describe, expect, it } from "vitest";

import { rewriteDocumentLink } from "./links";
import { docRoute, docSlug, isPublishedDocument, PUBLISHED_DOCS } from "./published";

const BLOB = "https://github.com/andryorelabs/animated-fluent-emojis/blob/main";

describe("rewriteDocumentLink", () => {
  it("maps a published doc to its route", () => {
    expect(
      rewriteDocumentLink("how-to/use-with-angular.md", {
        docPath: "usage.md",
        locale: "en",
      }),
    ).toBe("/docs/how-to/use-with-angular/");
  });

  it("maps the overview to the docs home", () => {
    expect(
      rewriteDocumentLink("../usage.md", {
        docPath: "how-to/use-with-preact.md",
        locale: "en",
      }),
    ).toBe("/docs/");
  });

  it("keeps the fragment on a guide page", () => {
    expect(
      rewriteDocumentLink("../guide/frameworks.md#plain-html", {
        docPath: "how-to/use-with-preact.md",
        locale: "en",
      }),
    ).toBe("/docs/guide/frameworks/#plain-html");
  });

  it.each([
    ["../usage.md#plain-html", "/docs/guide/frameworks/#plain-html"],
    ["../usage.md#frameworks", "/docs/guide/frameworks/"],
    ["../usage.md#fallback", "/docs/guide/behavior/#fallback"],
    ["../usage.md#asset-site", "/docs/guide/assets/#asset-site"],
    ["../usage.md#lookup", "/docs/guide/lookup/"],
    ["../usage.md#unknown", "/docs/#unknown"],
  ])("sends the legacy anchor link %s to its guide page", (href, route) => {
    expect(
      rewriteDocumentLink(href, {
        docPath: "how-to/use-with-preact.md",
        locale: "en",
      }),
    ).toBe(route);
  });

  it("is locale aware", () => {
    expect(
      rewriteDocumentLink("usage.md", {
        docPath: "troubleshooting.md",
        locale: "pt-BR",
      }),
    ).toBe("/pt-br/docs/");
  });

  it("maps an unpublished doc to a GitHub blob URL", () => {
    expect(
      rewriteDocumentLink("../development.md", {
        docPath: "how-to/self-host-the-assets.md",
        locale: "es",
      }),
    ).toBe(`${BLOB}/docs/development.md`);
    expect(
      rewriteDocumentLink("adr/0014-multi-framework-support.md", {
        docPath: "usage.md",
        locale: "en",
      }),
    ).toBe(`${BLOB}/docs/adr/0014-multi-framework-support.md`);
  });

  it("maps files outside docs to the repository root path", () => {
    expect(
      rewriteDocumentLink("../README.md", {
        docPath: "usage.md",
        locale: "en",
      }),
    ).toBe(`${BLOB}/README.md`);
    expect(
      rewriteDocumentLink("../../CONTEXT.md", {
        docPath: "how-to/self-host-the-assets.md",
        locale: "en",
      }),
    ).toBe(`${BLOB}/CONTEXT.md`);
  });

  it("keeps the fragment on GitHub links", () => {
    expect(
      rewriteDocumentLink("../security.md#csp-requirements", {
        docPath: "how-to/self-host-the-assets.md",
        locale: "en",
      }),
    ).toBe(`${BLOB}/docs/security.md#csp-requirements`);
  });

  it.each(["#props", "https://example.com/a.md", "/docs/", "mailto:a@b.c", "../../../../x.md"])(
    "leaves %s alone",
    (href) => {
      expect(rewriteDocumentLink(href, { docPath: "usage.md", locale: "en" })).toBe(href);
    },
  );
});

describe("published docs", () => {
  it("derives slugs and routes", () => {
    expect(docSlug("usage.md")).toBe("docs");
    expect(docSlug("guide/props.md")).toBe("docs/guide/props");
    expect(docSlug("troubleshooting.md")).toBe("docs/troubleshooting");
    expect(docRoute("zh-CN", "troubleshooting.md")).toBe("/zh-cn/docs/troubleshooting/");
  });

  it("recognises only allowlisted docs", () => {
    expect(PUBLISHED_DOCS.every(isPublishedDocument)).toBe(true);
    expect(isPublishedDocument("architecture.md")).toBe(false);
    expect(isPublishedDocument("EMOJI_LIST.md")).toBe(false);
  });
});
