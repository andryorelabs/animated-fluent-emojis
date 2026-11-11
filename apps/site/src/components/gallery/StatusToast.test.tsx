import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusToast } from "./StatusToast";

describe("status toast", () => {
  it("marks the visible state and announces the message", () => {
    const html = renderToString(<StatusToast message="Copied" visible />);
    expect(html).toContain('data-visible="true"');
    expect(html).toMatch(/<p role="status" aria-live="polite"[^>]*>Copied<\/p>/);
  });

  it("keeps the message in the box while exiting and silences the live region", () => {
    const html = renderToString(<StatusToast message="Copied" visible={false} />);
    expect(html).toContain('data-visible="false"');
    expect(html).toMatch(/<div[^>]*data-visible="false"[^>]*>Copied<\/div>/);
    expect(html).toMatch(/<p role="status" aria-live="polite"[^>]*><\/p>/);
  });

  it("offsets from the bottom by the safe-area inset and drops the slide for reduced motion", () => {
    const html = renderToString(<StatusToast message="" visible={false} />);
    expect(html).toContain("bottom-safe-4");
    expect(html).toContain("motion-reduce:data-[visible=false]:translate-y-0");
  });
});
