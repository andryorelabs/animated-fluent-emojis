import { describe, expect, it } from "vitest";

import { buildLlmsFullTxt, buildLlmsTxt, emojiEntry } from "./llms";

const landing = { title: "Home", url: "https://x.test/", description: "Start" };
const docs = [{ title: "Usage", url: "https://x.test/docs/" }];
const emoji = emojiEntry(
  {
    slug: "grinning-face",
    description: "Grinning face",
    unicode: "1F600",
    category: "Smileys",
    keywords: ["smile", "happy"],
  },
  "https://x.test/emojis/grinning-face/",
);
const base = {
  siteName: "Site",
  description: "Desc",
  landing,
  docs,
  emojis: [emoji],
};

describe("llms composition", () => {
  it("lists landing, docs and emoji pages in llms.txt", () => {
    const output = buildLlmsTxt(base);
    expect(output.startsWith("# Site\n\n> Desc\n")).toBe(true);
    expect(output).toContain("## Landing\n\n- [Home](https://x.test/): Start");
    expect(output).toContain("## Documentation\n\n- [Usage](https://x.test/docs/)");
    expect(output).toContain(
      "- [Grinning face](https://x.test/emojis/grinning-face/): 1F600, Smileys",
    );
    expect(output.endsWith("\n")).toBe(true);
  });

  it("embeds the plugin docs and emoji details in llms-full.txt", () => {
    const output = buildLlmsFullTxt({
      ...base,
      docsMarkdown: "\n# Usage\n\nBody\n",
    });
    expect(output).toContain("## Documentation\n\n# Usage\n\nBody\n\n## Emojis");
    expect(output).toContain("Keywords: smile, happy");
  });

  it("omits empty keywords", () => {
    expect(
      emojiEntry(
        {
          slug: "a",
          description: "A",
          unicode: "1",
          category: "C",
          keywords: [],
        },
        "u",
      ).details,
    ).toBe("1, C");
  });
});
