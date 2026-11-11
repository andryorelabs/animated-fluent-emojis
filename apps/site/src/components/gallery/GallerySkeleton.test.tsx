import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GallerySkeleton } from "./GallerySkeleton";

function render(size: 64 | 96 | 128 = 64): string {
  return renderToString(<GallerySkeleton label="Loading emojis" size={size} />);
}

describe("gallery skeleton", () => {
  it("announces itself as a labelled status", () => {
    const html = render();
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading emojis"');
  });

  it("reserves the 240px sidebar column from 860px up", () => {
    expect(render()).toContain("min-[860px]:grid-cols-sidebar");
  });

  it("reserves the toolbar row at the real search height", () => {
    expect(render()).toMatch(/class="[^"]*\bh-9\b[^"]*"/);
  });

  it("uses the grid track minimum of the requested size", () => {
    expect(render(128)).toContain("minmax(160px,1fr)");
  });
});
