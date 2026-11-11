import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const rootRequire = createRequire(path.join(repositoryRoot, "package.json"));
const scriptBin = path.join(repositoryRoot, "node_modules/typescript7/bin/tsc");
const typescript7Manifest = fileURLToPath(import.meta.resolve("typescript7/package.json"));
const typescript7Bin = path.join(path.dirname(typescript7Manifest), "bin/tsc");
const workspaces = [".", "packages/animated-fluent-emojis", "apps/assets", "apps/site"];

function readScripts(workspace: string): string[] {
  const manifestPath = path.join(repositoryRoot, workspace, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  return Object.values(manifest.scripts ?? {});
}

function tscInvocations(command: string): string[] {
  return command
    .matchAll(/(?:^|[\s&|;])(\S*tsc)(?=\s|$)/g)
    .map((match) => match[1] ?? "")
    .toArray();
}

describe("typescript7 alias", () => {
  it("runs tsc 7.1 from node_modules/typescript7/bin/tsc", () => {
    expect(realpathSync(scriptBin)).toBe(realpathSync(typescript7Bin));

    const output = execFileSync(scriptBin, ["--version"], {
      encoding: "utf8",
    });

    expect(output).toMatch(/Version 7\.1\./);
  });

  it('keeps require("typescript") on the 6.x classic API', () => {
    const typescript = rootRequire("typescript") as { version: string };

    expect(typescript.version.startsWith("6.")).toBe(true);
  });

  it.each(workspaces)("points every tsc call in %s at the typescript7 bin", (workspace) => {
    const binaries = readScripts(workspace).flatMap((command) => tscInvocations(command));

    for (const binary of binaries) {
      const resolved = path.resolve(repositoryRoot, workspace, binary);

      expect(resolved).toBe(scriptBin);
      expect(existsSync(resolved)).toBe(true);
    }
  });
});
