import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { findSkillsLockProblems, type SkillsLock } from "./locks";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const DOCS_INDEX = "README.md";

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function collapse(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

function listTrackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split("\0").filter((entry) => entry !== "");
}

function readTextOrNull(relativePath: string): string | null {
  try {
    const content = readFileSync(path.join(ROOT, relativePath));
    return content.includes(0) ? null : content.toString("utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function sectionBody(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start === -1) throw new Error(`Missing heading ${heading} in copy.md`);
  const rest = markdown.slice(start + heading.length + 2);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

function copyTagline(): string {
  const match = /\*\*(.+?)\*\*/.exec(
    sectionBody(readRepositoryFile("docs/brand/copy.md"), "## Tagline"),
  );
  if (!match?.[1]) throw new Error('No bold tagline under "## Tagline"');
  return match[1];
}

function copyDescription(): string {
  const body = sectionBody(readRepositoryFile("docs/brand/copy.md"), "## package.json");
  const quoted: string[] = [];
  let collecting = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("**description**")) collecting = true;
    else if (collecting && line.startsWith(">")) quoted.push(line.replace(/^>\s?/, ""));
    else if (collecting && quoted.length > 0) break;
  }
  if (quoted.length === 0) throw new Error("No quoted package.json description");
  return collapse(quoted.join(" "));
}

function listMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(absolute);
    if (!entry.name.endsWith(".md")) return [];
    return path.relative(DOCS, absolute).split(path.sep).join("/");
  });
}

describe("retired names", () => {
  const retiredNames: readonly RegExp[] = [/\bforge\b/i, /AndryOre\/animated-fluent-emojis/];

  const allowedPaths: readonly { prefix: string; reason: string }[] = [
    { prefix: "docs/adr/", reason: "ADRs record the old names as history" },
    { prefix: "CHANGELOG.md", reason: "release notes record the old names" },
    {
      prefix: "scripts/standard-invariants.test.ts",
      reason: "the test names what it forbids",
    },
  ];

  test("appear in tracked files only on the allowlist", () => {
    const offenders = listTrackedFiles()
      .filter((file) => allowedPaths.every(({ prefix }) => !file.startsWith(prefix)))
      .filter((file) => {
        const text = readTextOrNull(file);
        return text !== null && retiredNames.some((name) => name.test(text));
      });
    expect(offenders).toEqual([]);
  });
});

describe("public copy", () => {
  test("the README slogan is the tagline in docs/brand/copy.md", () => {
    expect(readRepositoryFile("README.md")).toContain(`<strong>${copyTagline()}</strong>`);
  });

  test("the library description is the package.json line in docs/brand/copy.md", () => {
    const manifest = JSON.parse(
      readRepositoryFile("packages/animated-fluent-emojis/package.json"),
    ) as { description?: string };
    expect(collapse(manifest.description ?? "")).toBe(copyDescription());
  });
});

describe("README top", () => {
  test("lists heading, cover, slogan, badges and links line in order", () => {
    const readme = readRepositoryFile("README.md");
    const positions = [
      readme.indexOf("# Animated Fluent Emojis"),
      readme.indexOf("Cover.webp"),
      readme.indexOf("<strong>"),
      readme.indexOf("badge.svg"),
      readme.indexOf(">Documentation</a>"),
    ];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(positions.toSorted((first, second) => first - second));
  });

  test("the links line follows the badges directly", () => {
    const readme = readRepositoryFile("README.md");
    const badgesEnd = readme.indexOf("</p>", readme.indexOf("Bundle size"));
    const afterBadges = readme.slice(badgesEnd + "</p>".length).trimStart();
    expect(afterBadges.startsWith('<p align="center">')).toBe(true);
    expect(afterBadges.split("\n", 3).join("\n")).toContain("Documentation");
  });
});

describe("root documents", () => {
  test.each(["ACCESSIBILITY.md", "DESIGN.md"])("%s exists", (file) => {
    expect(existsSync(path.join(ROOT, file))).toBe(true);
  });
});

describe("docs index", () => {
  const excludedPatterns: readonly { pattern: RegExp; reason: string }[] = [
    { pattern: /^EMOJI_LIST(_.+)?\.md$/, reason: "generated emoji lists" },
    { pattern: /^brand\/tools\//, reason: "brand tooling" },
    { pattern: /^brand\/brandbook\//, reason: "brand tooling" },
  ];

  test("every Markdown file under docs is linked from docs/README.md", () => {
    const index = readFileSync(path.join(DOCS, DOCS_INDEX), "utf8");
    const unindexed = listMarkdownFiles(DOCS)
      .filter((file) => file !== DOCS_INDEX)
      .filter((file) => excludedPatterns.every(({ pattern }) => !pattern.test(file)))
      .filter((file) => !index.includes(`](${file})`));
    expect(unindexed).toEqual([]);
  });

  test("lists the codebase map", () => {
    expect(readFileSync(path.join(DOCS, DOCS_INDEX), "utf8")).toContain("](agents/codebase.md)");
  });
});

describe("skills lock", () => {
  const lock = JSON.parse(readRepositoryFile("skills-lock.json")) as SkillsLock;
  const vendoredSkills = readdirSync(path.join(ROOT, ".claude", "skills"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const ref = "a".repeat(40);

  test("pins every skill to a commit and matches .claude/skills", () => {
    expect(Object.keys(lock.skills)).not.toHaveLength(0);
    expect(findSkillsLockProblems(lock, vendoredSkills)).toEqual([]);
  });

  test("reports an entry without a full commit SHA in `ref`", () => {
    const problems = findSkillsLockProblems(
      { skills: { pinned: { ref }, missing: {}, short: { ref: "e8a175d" } } },
      ["pinned", "missing", "short"],
    );
    expect(problems).toEqual([
      "missing: `ref` must be a full commit SHA",
      "short: `ref` must be a full commit SHA",
    ]);
  });

  test("reports a skill that only one side lists", () => {
    const problems = findSkillsLockProblems({ skills: { locked: { ref }, both: { ref } } }, [
      "both",
      "vendored",
    ]);
    expect(problems).toEqual([
      "locked: locked but missing from .claude/skills",
      "vendored: in .claude/skills but missing from the lock",
    ]);
  });
});
