import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_FILE = /\.(?:ts|tsx|mts|mjs|astro)$/;
const ENV_READ = /process\.env\.([A-Z][A-Z0-9_]*)/g;

const AMBIENT_VARIABLES: ReadonlySet<string> = new Set(["PATH"]);

function listSourceFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split("\0").filter((file) => SOURCE_FILE.test(file));
}

function readVariables(file: string): string[] {
  let text: string;
  try {
    text = readFileSync(path.join(ROOT, file), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return text
    .matchAll(ENV_READ)
    .map((match) => match[1] ?? "")
    .toArray();
}

describe("environment variable docs", () => {
  test("docs/configuration.md names every variable the code reads", () => {
    const documentation = readFileSync(path.join(ROOT, "docs", "configuration.md"), "utf8");
    const undocumented = listSourceFiles().flatMap((file) =>
      readVariables(file)
        .filter((name) => !AMBIENT_VARIABLES.has(name))
        .filter((name) => !documentation.includes(`\`${name}\``))
        .map((name) => `${name} (read in ${file})`),
    );
    expect([...new Set(undocumented)]).toEqual([]);
  });
});
