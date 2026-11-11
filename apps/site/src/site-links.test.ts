import { describe, expect, it } from "vitest";

import { externalLinkAttributes, isExternalHref } from "./site-links";

describe("externalLinkAttributes", () => {
  it("adds noopener noreferrer when there is no existing rel", () => {
    expect(externalLinkAttributes()).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("merges an existing rel and keeps it first", () => {
    expect(externalLinkAttributes("author").rel).toBe("author noopener noreferrer");
  });

  it("drops duplicate and blank tokens", () => {
    expect(externalLinkAttributes("  noopener author  author noreferrer ").rel).toBe(
      "noopener author noreferrer",
    );
  });
});

describe("isExternalHref", () => {
  it("detects absolute http and https URLs only", () => {
    expect(isExternalHref("https://github.com/x")).toBe(true);
    expect(isExternalHref("/docs/")).toBe(false);
    expect(isExternalHref("#main")).toBe(false);
    expect(isExternalHref("mailto:a@b.c")).toBe(false);
  });
});
