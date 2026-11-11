import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { composedLlmsFiles } from "./llms-integration";

vi.mock("../gallery/public-index", () => ({
  loadPublicIndex: () =>
    Promise.resolve([
      {
        slug: "fire",
        description: "Fire",
        unicode: "1F525",
        category: "Travel",
        keywords: ["flame"],
      },
    ]),
}));

describe("composedLlmsFiles", () => {
  it("rewrites both llms files around the plugin docs output", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "llms-"));
    try {
      await writeFile(path.join(directory, "llms-full.txt"), "# Plugin docs\n");
      const hook = composedLlmsFiles().hooks["astro:build:done"] as (options: {
        dir: URL;
      }) => Promise<void>;
      await hook({ dir: pathToFileURL(`${directory}/`) });
      const index = await readFile(path.join(directory, "llms.txt"), "utf8");
      const full = await readFile(path.join(directory, "llms-full.txt"), "utf8");
      expect(index).toContain("## Emojis");
      expect(index).toContain("/emojis/fire/");
      expect(index).not.toMatch(/\[[^\]]*\.md\]/);
      expect(full).toContain("## Documentation\n\n# Plugin docs");
      expect(full).toContain("Keywords: flame");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
