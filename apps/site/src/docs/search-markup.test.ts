import { describe, expect, it } from "vitest";

import { restrictToMarkTags } from "./search-markup";

describe("restrictToMarkTags", () => {
  it("keeps mark tags and neutralizes every other tag", () => {
    expect(restrictToMarkTags("a <mark>b</mark> <img src=x onerror=1>")).toBe(
      "a <mark>b</mark> &lt;img src=x onerror=1>",
    );
  });
});
