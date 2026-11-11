import { describe, expect, it } from "vitest";

import { rewriteMarkdownLinks, toPageMarkdown } from "./markdown";

const context = { locale: "es", docPath: "troubleshooting.md" } as const;
const body = "See [usage](usage.md#a), [adr](adr/1.md), [web](https://x.dev) and [top](#top).\n";

describe("rewriteMarkdownLinks", () => {
  it("rewrites to site routes and GitHub URLs", () => {
    expect(rewriteMarkdownLinks(body, context)).toBe(
      "See [usage](/es/docs/#a), [adr](https://github.com/andryorelabs/animated-fluent-emojis/blob/main/docs/adr/1.md), [web](https://x.dev) and [top](#top).\n",
    );
  });

  it("leaves fenced code alone", () => {
    const fenced = "```md\n[a](usage.md)\n```\n[b](usage.md)";
    expect(rewriteMarkdownLinks(fenced, context)).toBe("```md\n[a](usage.md)\n```\n[b](/es/docs/)");
  });
});

describe("toPageMarkdown", () => {
  it("prefixes the title and makes site routes absolute", () => {
    expect(toPageMarkdown({ title: "Guide", body, ...context })).toContain(
      "# Guide\n\nSee [usage](https://animated-fluent-emojis.andryore.dev/es/docs/#a)",
    );
  });
});
