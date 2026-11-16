import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { EXPECTED_LYCHEE_ACTION_VERSION } from "../../scripts/lint-docs.ts";
import {
  ACTIONLINT_VERSION,
  BUN_VERSION,
  DEV_DEPENDENCY_PINS,
  LYCHEE_ACTION,
  NODE_VERSION,
  ZIZMOR_VERSION,
} from "./toolchain.ts";

interface RootManifest {
  readonly packageManager?: string;
  readonly engines?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly workspaces?: { readonly catalog?: Readonly<Record<string, string>> };
}

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

const manifest = JSON.parse(readRepositoryFile("package.json")) as RootManifest;

function resolvedDevelopmentDependency(name: string): string | undefined {
  const declared = manifest.devDependencies?.[name];
  return declared === "catalog:" ? manifest.workspaces?.catalog?.[name] : declared;
}

describe("toolchain table", () => {
  test.each(Object.entries(DEV_DEPENDENCY_PINS))("%s is pinned to %s", (name, version) => {
    expect(resolvedDevelopmentDependency(name)).toBe(version);
  });

  test("packageManager and engines pin the Bun release", () => {
    expect(manifest.packageManager).toBe(`bun@${BUN_VERSION}`);
    expect(manifest.engines?.bun).toBe(BUN_VERSION);
  });

  test(".node-version pins the Node.js major", () => {
    expect(readRepositoryFile(".node-version").trim()).toBe(NODE_VERSION);
  });

  test("lint-workflows installs the pinned actionlint", () => {
    expect(readRepositoryFile(".github/workflows/lint-workflows.yml")).toMatch(
      new RegExp(`ACTIONLINT_VERSION: ${ACTIONLINT_VERSION.replaceAll(".", String.raw`\.`)}\\n`),
    );
  });

  test("lint-workflows runs the pinned zizmor", () => {
    const workflow = readRepositoryFile(".github/workflows/lint-workflows.yml");
    const zizmorVersions = workflow
      .matchAll(/zizmorcore\/zizmor-action@\S+[^\n]*\n\s+with:\n\s+version: v(\S+)/g)
      .map((match) => match[1])
      .toArray();
    expect(zizmorVersions).toEqual([ZIZMOR_VERSION]);
  });

  test("lint-docs pins the lychee action in the workflow and the script", () => {
    expect(readRepositoryFile(".github/workflows/lint-docs.yml")).toContain(
      `lycheeverse/lychee-action@${LYCHEE_ACTION.sha} # ${LYCHEE_ACTION.version}`,
    );
    expect(EXPECTED_LYCHEE_ACTION_VERSION).toBe(LYCHEE_ACTION.version);
  });
});
