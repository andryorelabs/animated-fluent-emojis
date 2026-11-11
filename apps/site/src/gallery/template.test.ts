import { describe, expect, it } from "vitest";

import { fillTemplate } from "./template";

describe("fillTemplate", () => {
  it("fills every occurrence of the placeholder", () => {
    expect(fillTemplate("{n} and {n}", "n", "5")).toBe("5 and 5");
  });

  it("inserts replacement patterns literally", () => {
    expect(fillTemplate("No match for “{query}”", "query", "$&")).toBe("No match for “$&”");
  });
});
