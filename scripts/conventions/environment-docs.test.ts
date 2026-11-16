import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;
const ENV_DOT_READ = /(?:process\.env|import\.meta\.env|Bun\.env)\.([A-Z][A-Z0-9_]*)/g;
const ENV_BRACKET_READ =
  /(?:process\.env|import\.meta\.env|Bun\.env)\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g;
const ENV_DESTRUCTURE = /\{([^{}]*)\}\s*=\s*(?:process\.env|import\.meta\.env|Bun\.env)\b/g;

const SELF = "scripts/conventions/environment-docs.test.ts";

const AMBIENT_VARIABLES: ReadonlySet<string> = new Set(["PATH"]);

function listSourceFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split("\0").filter((file) => SOURCE_FILE.test(file) && file !== SELF);
}

/**
 * Finds every environment variable a piece of source text reads, through a dot, a bracket or a destructuring pattern.
 * @param text - Source text to scan.
 * @returns The variable names, in order of appearance, with repeats.
 */
export function findEnvironmentReads(text: string): string[] {
  const dotted = text.matchAll(ENV_DOT_READ).map((match) => match[1] ?? "");
  const bracketed = text.matchAll(ENV_BRACKET_READ).map((match) => match[1] ?? "");
  const destructured = text.matchAll(ENV_DESTRUCTURE).flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((part) => part.split(":", 1)[0]?.trim() ?? "")
      .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name)),
  );
  return [...dotted, ...bracketed, ...destructured];
}

function readVariables(file: string): string[] {
  let text: string;
  try {
    text = readFileSync(path.join(ROOT, file), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return findEnvironmentReads(text);
}

describe("findEnvironmentReads", () => {
  test("finds dot, bracket and destructured reads", () => {
    const text = [
      "const a = process.env.ALPHA;",
      'const b = process.env["BETA"];',
      "const c = import.meta.env.GAMMA;",
      "const d = Bun.env.DELTA;",
      "const { EPSILON, ZETA: renamed } = process.env;",
    ].join("\n");
    expect(findEnvironmentReads(text)).toEqual([
      "ALPHA",
      "GAMMA",
      "DELTA",
      "BETA",
      "EPSILON",
      "ZETA",
    ]);
  });

  test("ignores lowercase names and other objects", () => {
    expect(findEnvironmentReads("const a = other.env.ALPHA; const { x } = process.env;")).toEqual(
      [],
    );
  });
});

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
