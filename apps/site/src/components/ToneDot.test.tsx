import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SKIN_TONE_COLORS } from "../lib/skin-tone-colors";
import { ToneDot } from "./ToneDot";

describe("ToneDot", () => {
  it("is aria-hidden and painted with the tone color", () => {
    const html = renderToString(<ToneDot tone="medium" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("size-2.5");
    expect(html).toContain("shrink-0");
    expect(html.toLowerCase()).toContain(`--tone-color:${SKIN_TONE_COLORS.medium}`);
  });
});
