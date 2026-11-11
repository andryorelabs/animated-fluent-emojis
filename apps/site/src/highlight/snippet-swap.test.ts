import { describe, expect, it } from "vitest";

import { swapSnippetSlots, type SlotElement } from "./snippet-swap";

function slot(name: string, text: string): SlotElement {
  return { dataset: { snippetSlot: name }, textContent: text };
}

describe("swapSnippetSlots", () => {
  it("replaces only the text of the slots that have a value", () => {
    const id = slot("id", "EMOJIID");
    const size = slot("size", "99999");
    swapSnippetSlots([id, size], { size: "48" });
    expect(id.textContent).toBe("EMOJIID");
    expect(size.textContent).toBe("48");
  });

  it("ignores tokens of unknown slots", () => {
    const other = slot("other", "keep");
    swapSnippetSlots([other], { id: "x" });
    expect(other.textContent).toBe("keep");
  });
});
