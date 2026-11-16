import { describe, expect, it } from "vitest";

import { eyebrow, heading, section, wrap } from "./styles";

describe("home section styles", () => {
  it("builds the section class from the shared wrapper", () => {
    expect(section.startsWith(wrap)).toBe(true);
  });

  it("exposes non-empty class strings", () => {
    for (const value of [wrap, section, eyebrow, heading]) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
