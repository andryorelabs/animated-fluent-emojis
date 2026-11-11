import { describe, expect, it } from "vitest";

import { PLAY_MODES } from "../gallery/snippets";
import { SLOT_SENTINELS, snippetTemplateText, TEMPLATE_KINDS } from "./snippet-template";

describe("snippetTemplateText", () => {
  it.each(TEMPLATE_KINDS)("puts the sentinels in the %s snippet", (kind) => {
    const text = snippetTemplateText(kind, true);
    expect(text).toContain(SLOT_SENTINELS.id);
    expect(text).toContain(SLOT_SENTINELS.size);
    expect(text).toContain(SLOT_SENTINELS.tone);
  });

  it.each(TEMPLATE_KINDS)("omits the tone from the plain %s variant", (kind) => {
    expect(snippetTemplateText(kind, false)).not.toContain(SLOT_SENTINELS.tone);
  });

  it("places the fallback glyph only in the Astro and element snippets", () => {
    for (const kind of TEMPLATE_KINDS) {
      const hasGlyph = snippetTemplateText(kind, false).includes(SLOT_SENTINELS.unicode);
      expect(hasGlyph).toBe(kind === "astro" || kind === "element");
    }
  });
});

describe("snippetTemplateText play modes", () => {
  it.each(TEMPLATE_KINDS)("matches generateSnippet for %s", (kind) => {
    for (const play of PLAY_MODES) {
      expect(snippetTemplateText(kind, false, play)).not.toContain(SLOT_SENTINELS.tone);
    }
    expect(snippetTemplateText(kind, false)).toBe(snippetTemplateText(kind, false, "load"));
  });

  it("adds the play attributes only outside load", () => {
    expect(snippetTemplateText("react", false, "hover")).toContain("playOnHover autoPlay={false}");
    expect(snippetTemplateText("vue", false, "loop")).toContain('animation-iterations="infinite"');
    expect(snippetTemplateText("react", false, "load")).not.toContain("play");
  });
});
