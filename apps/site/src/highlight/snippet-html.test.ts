import { describe, expect, it } from "vitest";

import { fillSnippetSlots, markHighlightedLine } from "./snippet-html";

const html =
  '<div class="ec-line"><div class="code"><span style="--0:#000" data-snippet-slot="id">EMOJIID</span><span data-snippet-slot="size">99999</span></div></div>' +
  '<div class="ec-line"><div class="code">two</div></div>';

describe("fillSnippetSlots", () => {
  it("replaces only the slots that have a value", () => {
    const filled = fillSnippetSlots(html, { id: "wave" });

    expect(filled).toContain('data-snippet-slot="id">wave</span>');
    expect(filled).toContain('data-snippet-slot="size">99999</span>');
  });

  it("escapes the value", () => {
    expect(fillSnippetSlots(html, { id: '<b>"&' })).toContain("&lt;b&gt;&quot;&amp;");
  });
});

describe("markHighlightedLine", () => {
  it("marks the requested 1-based line only", () => {
    const marked = markHighlightedLine(html, 2);

    expect(marked.match(/ec-line-highlight/g)).toHaveLength(1);
    expect(marked.indexOf("ec-line-highlight")).toBeGreaterThan(marked.indexOf("EMOJIID"));
  });

  it("leaves the markup untouched for a missing line", () => {
    expect(markHighlightedLine(html, 9)).toBe(html);
  });
});
