import type { Element } from "hast";
import { describe, expect, it, vi } from "vitest";

const { render } = vi.hoisted(() => ({ render: vi.fn() }));

vi.mock("expressive-code", () => ({
  ExpressiveCode: class {
    render = render;
    getBaseStyles = vi.fn();
    getThemeStyles = vi.fn();
  },
  loadShikiTheme: vi.fn().mockResolvedValue({}),
}));

import { createSnippetRenderer } from "./snippet-render";

function span(children: Element["children"]): Element {
  return { type: "element", tagName: "span", properties: {}, children };
}

describe("createSnippetRenderer token handling", () => {
  it("leaves tokens that do not hold a single text node untouched", async () => {
    render.mockResolvedValue({
      renderedGroupAst: {
        type: "element",
        tagName: "div",
        properties: {},
        children: [
          { type: "text", value: "plain" },
          span([]),
          span([
            { type: "text", value: "a" },
            { type: "text", value: "b" },
          ]),
          span([{ type: "text", value: "no placeholder here" }]),
        ],
      },
      styles: new Set(["a{}", "b{}"]),
    });
    const renderer = await createSnippetRenderer();
    const result = await renderer.renderCode("code", "ts");
    expect(result.slots).toEqual([]);
    expect(result.styles).toBe("a{}b{}");
    expect(result.html).toContain("plain");
    expect(result.html).toContain("no placeholder here");
  });
});
