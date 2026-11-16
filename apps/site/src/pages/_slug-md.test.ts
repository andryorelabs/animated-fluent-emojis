import { describe, expect, it } from "vitest";

import { GET, getStaticPaths } from "./[...slug].md";

describe("markdown page endpoint", () => {
  it("lists a path for every catalog and changelog page", () => {
    const paths = getStaticPaths();
    expect(paths.length).toBeGreaterThan(0);
    for (const { params, props } of paths) {
      expect(params.slug).toBe(props.page.id);
    }
  });

  it("serves a page as markdown", async () => {
    const [first] = getStaticPaths();
    if (!first) throw new Error("No documentation pages found");
    const { page } = first.props;
    const response = await GET({ props: { page } } as unknown as Parameters<typeof GET>[0]);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(await response.text()).toContain(page.title);
  });
});
