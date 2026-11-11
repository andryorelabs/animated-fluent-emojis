import { describe, expect, it } from "vitest";

import { SKIN_TONES } from "../gallery/public-index";
import { SKIN_TONE_COLORS } from "./skin-tone-colors";

describe("SKIN_TONE_COLORS", () => {
  it("has a hex color for the default and every skin tone", () => {
    for (const tone of ["default", ...SKIN_TONES] as const) {
      expect(SKIN_TONE_COLORS[tone]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("matches the sampled art colors", () => {
    expect(SKIN_TONE_COLORS.default).toBe("#feba46");
    expect(SKIN_TONE_COLORS.dark).toBe("#533938");
  });
});
