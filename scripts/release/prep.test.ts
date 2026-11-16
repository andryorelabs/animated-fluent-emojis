import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PACKAGE_PATH, PrepError, cutRelease, prepareRelease, runPrep } from "./prep";

const REPOSITORY = "https://github.com/andryorelabs/animated-fluent-emojis";

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- A new thing.

### Changed

### Fixed

- A fix that wraps
  over two lines.

## [1.2.3] - 2026-01-01

### Added

- Old.

[Unreleased]: ${REPOSITORY}/compare/v1.2.3...HEAD
[1.2.3]: ${REPOSITORY}/compare/v1.2.2...v1.2.3
`;

const EMPTY_CHANGELOG = CHANGELOG.replace("- A new thing.", "").replace(
  "- A fix that wraps\n  over two lines.",
  "",
);

const PACKAGE_JSON = `{
  "name": "pkg",
  "version": "1.2.3",
  "files": ["dist"]
}
`;

const fixture = { root: "" };

function writeFixture(changelog: string, packageJson = PACKAGE_JSON): void {
  mkdirSync(path.dirname(path.join(fixture.root, PACKAGE_PATH)), {
    recursive: true,
  });
  writeFileSync(path.join(fixture.root, PACKAGE_PATH), packageJson);
  writeFileSync(path.join(fixture.root, "CHANGELOG.md"), changelog);
}

function packageAt(version: string): string {
  return `{\n  "name": "pkg",\n  "version": "${version}"\n}\n`;
}

function readRoot(relativePath: string): string {
  return readFileSync(path.join(fixture.root, relativePath), "utf8");
}

beforeEach(() => {
  fixture.root = mkdtempSync(path.join(tmpdir(), "prep-"));
});

afterEach(() => {
  rmSync(fixture.root, { recursive: true, force: true });
});

describe("cutRelease", () => {
  it("moves Unreleased into a dated section and rewrites the compare links", () => {
    const text = cutRelease(CHANGELOG, "1.3.0", "2026-02-03");
    expect(text).toContain("## [Unreleased]\n\n## [1.3.0] - 2026-02-03\n\n### Added");
    expect(text).toContain(`[Unreleased]: ${REPOSITORY}/compare/v1.3.0...HEAD`);
    expect(text).toContain(`[1.3.0]: ${REPOSITORY}/compare/v1.2.3...v1.3.0`);
    expect(text).toContain(`[1.2.3]: ${REPOSITORY}/compare/v1.2.2...v1.2.3`);
  });

  it("drops subsection headings with nothing under them", () => {
    const text = cutRelease(CHANGELOG, "1.3.0", "2026-02-03");
    expect(text).not.toContain("### Changed");
  });

  it("fails with a message when Unreleased has no entries", () => {
    expect(() => cutRelease(EMPTY_CHANGELOG, "1.3.0", "2026-02-03")).toThrow(
      'The "## [Unreleased]" section of CHANGELOG.md has no entries to release',
    );
  });

  it("fails when Unreleased is missing", () => {
    expect(() => cutRelease("# Changelog\n", "1.3.0", "2026-02-03")).toThrow(
      'no "## [Unreleased]" section',
    );
  });

  it("fails when the version already has a section", () => {
    expect(() => cutRelease(CHANGELOG, "1.2.3", "2026-02-03")).toThrow(
      "already has a section for 1.2.3",
    );
  });

  it("fails when entries sit outside an Added, Changed or Fixed group", () => {
    const loose = CHANGELOG.replace("### Added\n\n- A new thing.", "- A loose entry.");
    expect(() => cutRelease(loose, "1.3.0", "2026-02-03")).toThrow('must sit under a "### Added"');
  });

  it("fails on a group outside Added, Changed and Fixed", () => {
    const removed = CHANGELOG.replace("### Changed", "### Removed\n\n- Gone.");
    expect(() => cutRelease(removed, "1.3.0", "2026-02-03")).toThrow(
      '"### Removed" is not a changelog group',
    );
  });

  it("fails when the Unreleased compare link is missing", () => {
    const noLink = CHANGELOG.replace(/^\[Unreleased\]: .*\n/m, "");
    expect(() => cutRelease(noLink, "1.3.0", "2026-02-03")).toThrow("compare/vX.Y.Z...HEAD");
  });
});

describe("prepareRelease", () => {
  it("bumps the package version and cuts the changelog", () => {
    writeFixture(CHANGELOG);
    const changed = prepareRelease(fixture.root, "1.3.0", "2026-02-03");
    expect(changed.map((file) => file.path)).toEqual([PACKAGE_PATH, "CHANGELOG.md"]);
    expect(readRoot(PACKAGE_PATH)).toBe(PACKAGE_JSON.replace("1.2.3", "1.3.0"));
    expect(readRoot("CHANGELOG.md")).toContain("## [1.3.0] - 2026-02-03");
  });

  it("changes nothing when Unreleased is empty", () => {
    writeFixture(EMPTY_CHANGELOG);
    expect(() => prepareRelease(fixture.root, "1.3.0", "2026-02-03")).toThrow(PrepError);
    expect(readRoot(PACKAGE_PATH)).toBe(PACKAGE_JSON);
    expect(readRoot("CHANGELOG.md")).toBe(EMPTY_CHANGELOG);
  });

  it.each(["v1.3.0", "1.3", "latest"])("rejects the invalid version %s", (version) => {
    writeFixture(CHANGELOG);
    expect(() => prepareRelease(fixture.root, version, "2026-02-03")).toThrow(
      "not a valid version",
    );
  });

  it.each(["1.2.3", "1.2.2", "1.0.0"])("rejects the version %s that is not higher", (version) => {
    writeFixture(CHANGELOG);
    expect(() => prepareRelease(fixture.root, version, "2026-02-03")).toThrow("is not higher than");
  });

  it("accepts a prerelease above the current version", () => {
    writeFixture(CHANGELOG);
    prepareRelease(fixture.root, "1.3.0-beta.1", "2026-02-03");
    expect(readRoot(PACKAGE_PATH)).toContain('"version": "1.3.0-beta.1"');
  });

  it("fails when the package has no version field", () => {
    writeFixture(CHANGELOG, '{ "name": "pkg" }\n');
    expect(() => prepareRelease(fixture.root, "1.3.0", "2026-02-03")).toThrow(
      'has no "version" field',
    );
  });
});

describe("prepareRelease version ordering", () => {
  it.each(["1.3.0-beta.10", "1.3.0-beta.2.1", "1.3.0-rc.1", "1.3.0", "1.3.0-beta.3"])(
    "accepts %s above 1.3.0-beta.2",
    (version) => {
      writeFixture(CHANGELOG, packageAt("1.3.0-beta.2"));
      prepareRelease(fixture.root, version, "2026-02-03");
      expect(readRoot(PACKAGE_PATH)).toContain(`"version": "${version}"`);
    },
  );

  it.each(["1.3.0-beta.2", "1.3.0-beta.1", "1.3.0-beta", "1.3.0-alpha.9", "1.3.0-1", "1.2.9"])(
    "rejects %s at or below 1.3.0-beta.2",
    (version) => {
      writeFixture(CHANGELOG, packageAt("1.3.0-beta.2"));
      expect(() => prepareRelease(fixture.root, version, "2026-02-03")).toThrow(
        "is not higher than",
      );
    },
  );

  it("ranks a text prerelease identifier above a numeric one", () => {
    writeFixture(CHANGELOG, packageAt("1.3.0-1"));
    prepareRelease(fixture.root, "1.3.0-beta", "2026-02-03");
    expect(readRoot(PACKAGE_PATH)).toContain('"version": "1.3.0-beta"');
  });

  it("fails when the package carries an invalid version", () => {
    writeFixture(CHANGELOG, packageAt("latest"));
    expect(() => prepareRelease(fixture.root, "1.3.0", "2026-02-03")).toThrow(
      'carries the version "latest"',
    );
  });

  it("fails when the version field to rewrite cannot be found", () => {
    writeFixture(
      CHANGELOG,
      '{\n  "engines": {\n    "version": "9.9.9"\n  },\n  "version": "1.2.3"\n}\n',
    );
    expect(() => prepareRelease(fixture.root, "1.3.0", "2026-02-03")).toThrow("Could not find the");
  });
});

describe("runPrep", () => {
  it("rethrows an unexpected failure", () => {
    const lines: string[] = [];
    expect(() =>
      runPrep(["1.3.0"], fixture.root, (line) => {
        lines.push(line);
      }),
    ).toThrow();
    expect(lines).toEqual([]);
  });

  it("prints usage without a version", () => {
    const lines: string[] = [];
    expect(
      runPrep([], fixture.root, (line) => {
        lines.push(line);
      }),
    ).toBe(1);
    expect(lines.join("\n")).toContain("Usage: bun scripts/release/prep.ts <version>");
  });

  it("prints usage with extra arguments", () => {
    const lines: string[] = [];
    expect(
      runPrep(["1.3.0", "extra"], fixture.root, (line) => {
        lines.push(line);
      }),
    ).toBe(1);
    expect(lines.join("\n")).toContain("Usage:");
  });

  it("reports an empty Unreleased section and exits 1", () => {
    writeFixture(EMPTY_CHANGELOG);
    const lines: string[] = [];
    expect(
      runPrep(["1.3.0"], fixture.root, (line) => {
        lines.push(line);
      }),
    ).toBe(1);
    expect(lines.join("\n")).toContain("has no entries to release");
  });

  it("lists the changed files and exits 0", () => {
    writeFixture(CHANGELOG);
    const lines: string[] = [];
    expect(
      runPrep(["1.3.0"], fixture.root, (line) => {
        lines.push(line);
      }),
    ).toBe(0);
    expect(lines.join("\n")).toContain("Prepared release 1.3.0");
    expect(lines.join("\n")).toContain(`${PACKAGE_PATH}: version 1.2.3 -> 1.3.0`);
  });
});
