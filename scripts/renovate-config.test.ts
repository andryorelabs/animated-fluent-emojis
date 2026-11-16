import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

import { DEV_DEPENDENCY_PINS } from "../tools/toolchain/toolchain.ts";
import { EXPECTED_LYCHEE_ACTION_VERSION, LYCHEE_VERSION } from "./lint-docs.ts";

interface CustomManager {
  readonly depNameTemplate?: string;
  readonly datasourceTemplate?: string;
  readonly extractVersionTemplate?: string;
  readonly managerFilePatterns: readonly string[];
  readonly matchStrings: readonly string[];
}

interface PackageRule {
  readonly groupName?: string;
  readonly matchPackageNames?: readonly string[];
  readonly rangeStrategy?: string;
  readonly automerge?: boolean;
  readonly matchManagers?: readonly string[];
  readonly matchDepNames?: readonly string[];
  readonly allowedVersions?: string;
}

interface RenovateConfig {
  readonly extends: readonly string[];
  readonly packageRules: readonly PackageRule[];
  readonly baseBranchPatterns?: readonly string[];
  readonly rebaseWhen?: string;
  readonly lockFileMaintenance?: { automerge?: boolean; minimumReleaseAge?: string };
  readonly customManagers: readonly CustomManager[];
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const config = runInNewContext(`(${readRepositoryFile("renovate.json5")})`) as RenovateConfig;

function findManager(dependencyName: string): CustomManager {
  const manager = config.customManagers.find(
    (candidate) => candidate.depNameTemplate === dependencyName,
  );
  if (!manager) throw new Error(`no custom manager for ${dependencyName}`);
  return manager;
}

function captureCurrentValue(manager: CustomManager, content: string): string | undefined {
  for (const matchString of manager.matchStrings) {
    const match = new RegExp(matchString).exec(content);
    if (match?.groups?.currentValue) return match.groups.currentValue;
  }
  return undefined;
}

function filePatternMatches(manager: CustomManager, file: string): boolean {
  return manager.managerFilePatterns.some((pattern) => new RegExp(pattern.slice(1, -1)).test(file));
}

describe("renovate.json5 presets", () => {
  test("extends the shared presets", () => {
    expect(config.extends).toEqual(
      expect.arrayContaining([
        "config:best-practices",
        "helpers:pinGitHubActionDigests",
        "group:monorepos",
      ]),
    );
  });

  test("turns the dependency dashboard on", () => {
    expect(config.extends).toContain(":dependencyDashboard");
  });

  test("targets the develop branch", () => {
    expect(config.baseBranchPatterns).toEqual(["develop"]);
  });

  test("rebases branches that fall behind the base branch", () => {
    expect(config.rebaseWhen).toBe("behind-base-branch");
  });

  test("automerges lockfile maintenance after a 7-day release age", () => {
    expect(config.lockFileMaintenance?.automerge).toBe(true);
    expect(config.lockFileMaintenance?.minimumReleaseAge).toBe("7 days");
  });
});

function findGroup(groupName: string): PackageRule {
  const rule = config.packageRules.find((candidate) => candidate.groupName === groupName);
  if (!rule) throw new Error(`no package rule for group ${groupName}`);
  return rule;
}

describe("renovate.json5 groups", () => {
  test("groups the oxc toolchain, exact-pinned and never automerged", () => {
    const oxc = findGroup("oxc");
    expect(oxc.matchDepNames).toEqual(["oxlint", "oxlint-tsgolint", "oxfmt", "@oxlint/plugins"]);
    expect(oxc.rangeStrategy).toBe("pin");
    expect(oxc.automerge).toBe(false);
  });

  test("puts typescript7 in its own group, exact-pinned and never automerged", () => {
    const typescript7 = findGroup("typescript7");
    expect(typescript7.matchDepNames).toEqual(["typescript7"]);
    expect(typescript7.rangeStrategy).toBe("pin");
    expect(typescript7.automerge).toBe(false);
  });

  test("keeps the pin groups last so no later rule can turn automerge back on", () => {
    expect(config.packageRules.slice(-3).map((rule) => rule.groupName)).toEqual([
      "bun",
      "oxc",
      "typescript7",
    ]);
  });

  test("keeps the lychee pins together and never automerged", () => {
    const lychee = findGroup("lychee");
    expect(lychee.matchDepNames).toEqual(["lycheeverse/lychee", "lycheeverse/lychee-action"]);
    expect(lychee.automerge).toBe(false);
  });

  test("pins bun and @types/bun together, never automerged", () => {
    const bun = findGroup("bun");
    expect(bun.matchDepNames).toEqual(["bun", "@types/bun"]);
    expect(bun.rangeStrategy).toBe("pin");
    expect(bun.automerge).toBe(false);
  });

  test.each(Object.keys(DEV_DEPENDENCY_PINS).filter((name) => name !== "typescript"))(
    "the %s toolchain pin sits in a pin group that never automerges",
    (dependencyName) => {
      const pinGroup = config.packageRules.find(
        (rule) => rule.rangeStrategy === "pin" && rule.matchDepNames?.includes(dependencyName),
      );
      expect(pinGroup?.automerge).toBe(false);
    },
  );

  test("manages the typescript 6 alias in the catalog, kept below 7", () => {
    const manager = findManager("@typescript/typescript6");
    const manifest = readRepositoryFile("package.json");
    expect(filePatternMatches(manager, "package.json")).toBe(true);
    expect(DEV_DEPENDENCY_PINS.typescript).toBe(
      `npm:@typescript/typescript6@${captureCurrentValue(manager, manifest) ?? ""}`,
    );
    const rule = config.packageRules.find((candidate) =>
      candidate.matchDepNames?.includes("@typescript/typescript6"),
    );
    expect(rule?.allowedVersions).toBe("<7");
    expect(rule?.automerge).toBe(false);
  });

  test("keeps the oxc packages out of the eslint group", () => {
    expect(findGroup("eslint").matchPackageNames).not.toEqual(expect.arrayContaining(["oxlint"]));
  });

  test("trims the eslint group to the packages the .astro pass and jsPlugins use", () => {
    expect(findGroup("eslint").matchPackageNames).toEqual([
      "eslint",
      "typescript-eslint",
      "eslint-plugin-*",
      "@vitest/eslint-plugin",
    ]);
  });
});

describe("workflow tool version managers", () => {
  const workflowPath = ".github/workflows/lint-workflows.yml";
  const workflow = readRepositoryFile(workflowPath);

  test.each([
    ["rhysd/actionlint", /ACTIONLINT_VERSION: (\d+\.\d+\.\d+)/],
    ["zizmorcore/zizmor", /version: (v\d+\.\d+\.\d+)/],
  ])("%s manager captures the pinned version", (dependencyName, expected) => {
    const manager = findManager(dependencyName);
    expect(filePatternMatches(manager, workflowPath)).toBe(true);
    expect(captureCurrentValue(manager, workflow)).toBe(expected.exec(workflow)?.[1]);
  });

  test("the zizmor manager ignores a version of another action", () => {
    const fixture = ["- uses: other/action@abc # v1", "  with:", "    version: v9.9.9"].join("\n");
    expect(captureCurrentValue(findManager("zizmorcore/zizmor"), fixture)).toBeUndefined();
  });

  test("the actionlint manager reads a fixture line", () => {
    expect(
      captureCurrentValue(findManager("rhysd/actionlint"), "  ACTIONLINT_VERSION: 2.0.1\n"),
    ).toBe("2.0.1");
  });

  test("the managers do not apply to other workflows", () => {
    expect(filePatternMatches(findManager("rhysd/actionlint"), ".github/workflows/ci.yml")).toBe(
      false,
    );
  });
});

describe("lint-docs lychee version managers", () => {
  const scriptPath = "scripts/lint-docs.ts";
  const script = readRepositoryFile(scriptPath);

  test.each([
    ["lycheeverse/lychee", LYCHEE_VERSION],
    ["lycheeverse/lychee-action", EXPECTED_LYCHEE_ACTION_VERSION],
  ])("%s manager captures the pinned version", (dependencyName, expected) => {
    const manager = findManager(dependencyName);
    expect(filePatternMatches(manager, scriptPath)).toBe(true);
    expect(captureCurrentValue(manager, script)).toBe(expected);
  });

  test("the lychee manager maps the lychee-prefixed release tags", () => {
    const manager = findManager("lycheeverse/lychee");
    const extractVersion = new RegExp(manager.extractVersionTemplate ?? "");
    expect(extractVersion.exec("lychee-v0.24.2")?.groups?.version).toBe("v0.24.2");
    expect(extractVersion.exec("lychee-lib-v0.24.2")).toBeNull();
  });
});
