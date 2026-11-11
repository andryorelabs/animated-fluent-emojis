import { describe, expect, it } from "vitest";

import { collectStarlightInlineScriptHashes } from "./starlight-inline-hashes";

describe("collectStarlightInlineScriptHashes", () => {
  it("derives unique sha256 sources from the installed Starlight", () => {
    const hashes = collectStarlightInlineScriptHashes();
    expect(hashes.length).toBeGreaterThan(0);
    expect(new Set(hashes).size).toBe(hashes.length);
    for (const hash of hashes) {
      expect(hash).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
    }
  });
});
