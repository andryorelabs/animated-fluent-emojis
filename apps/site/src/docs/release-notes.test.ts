import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseChangelog, renderReleaseNotesMarkdown } from "./release-notes";

const REAL_CHANGELOG = readFileSync(path.resolve(process.cwd(), "../../CHANGELOG.md"), "utf8");

describe("parseChangelog on the real CHANGELOG.md", () => {
  const entries = parseChangelog(REAL_CHANGELOG);

  it("returns every released version newest first", () => {
    const headings = REAL_CHANGELOG.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm).toArray();
    expect(entries.map((entry) => entry.version)).toEqual(headings.map((match) => match[1]));
    expect(entries.length).toBeGreaterThan(0);
  });

  it("leaves the link references out of the entry bodies", () => {
    const rendered = renderReleaseNotesMarkdown(entries);
    expect(rendered).not.toMatch(/^\[\d+\.\d+\.\d+\]:/m);
  });

  it("links every version to its compare or release URL", () => {
    for (const entry of entries) {
      expect(entry.compareUrl).toMatch(/^https:\/\//);
    }
  });
});

describe("parseChangelog on fixtures", () => {
  it("sorts by semantic version, not by file order", () => {
    const entries = parseChangelog("## [0.9.0] - 2026-01-01\n\n## [0.10.0] - 2026-02-01\n");
    expect(entries.map((entry) => entry.version)).toEqual(["0.10.0", "0.9.0"]);
  });

  it("reads a link reference wrapped onto the next line", () => {
    const [entry] = parseChangelog(
      "## [1.0.0] - 2026-01-01\n\n### Added\n\n- A\n\n[1.0.0]:\n  https://example.com/x\n",
    );
    expect(entry?.compareUrl).toBe("https://example.com/x");
    expect(entry?.body).toBe("### Added\n\n- A");
  });

  it("validates but does not return the unreleased section", () => {
    expect(parseChangelog("## [Unreleased]\n\n### Added\n\n- A\n")).toEqual([]);
    expect(() => parseChangelog("## [Unreleased]\n\n### Oops\n")).toThrow(
      /line 3: unknown section/,
    );
  });

  it("rejects a missing date", () => {
    expect(() => parseChangelog("## [1.0.0]\n")).toThrow(/line 1: malformed release heading/);
  });

  it("rejects an impossible date", () => {
    expect(() => parseChangelog("## [1.0.0] - 2026-02-31\n")).toThrow(/invalid release date/);
  });

  it("rejects a bad version", () => {
    expect(() => parseChangelog("## [1.0] - 2026-01-01\n")).toThrow(/malformed release heading/);
  });

  it("rejects an unknown section", () => {
    expect(() => parseChangelog("## [1.0.0] - 2026-01-01\n\n### Improved\n")).toThrow(
      /line 3: unknown section/,
    );
  });

  it("rejects a duplicate version", () => {
    expect(() => parseChangelog("## [1.0.0] - 2026-01-01\n\n## [1.0.0] - 2026-01-02\n")).toThrow(
      /duplicate version 1.0.0/,
    );
  });
});

describe("renderReleaseNotesMarkdown", () => {
  it("writes a linked heading, the date and the body", () => {
    expect(
      renderReleaseNotesMarkdown([
        {
          version: "1.0.0",
          isoDate: "2026-01-01",
          body: "- A",
          compareUrl: "https://x.test/",
        },
      ]),
    ).toBe("## [1.0.0](https://x.test/)\n\n2026-01-01\n\n- A\n");
  });
});
