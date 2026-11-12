import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const MODEL_DOCS = [
  "docs/development.md",
  "docs/how-to/cut-a-release.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "docs/security.md",
  "AGENTS.md",
  "docs/agents/emet.md",
] as const;

const PROMOTION_COMMAND =
  'gh pr create --base main --head develop --title "chore: 🔀 promote develop to main"';

const SQUASH_PROMOTION = [
  /promot\w*[^.,;]{0,60}squash/i,
  /squash[^.,;]{0,60}promot/i,
  /squash\W+(?:merge\W+)?`?develop`?\W+(?:in)?to\W+`?main/i,
];

const SYNC_STEP = [
  /merg\w*\s+`?main`?\s+(?:back\s+)?(?:in)?to\s+`?develop`?/i,
  /sync\w*\s+`?develop`?\s+(?:with|from)\s+`?main`?/i,
  /back-?merg/i,
  /sync step/i,
];

const NEGATION = /\b(?:no|nothing|never|not|without)\b/i;

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function listDocumentationOutsideAdr(): string[] {
  return execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((file) => file !== "" && !file.startsWith("docs/adr/") && !file.startsWith(".claude/"));
}

function splitSentences(markdown: string): string[] {
  return markdown
    .replaceAll(/\s+/g, " ")
    .split(/(?<=[.!?])\s/)
    .filter((sentence) => sentence !== "");
}

function findOldFlowSentences(markdown: string): string[] {
  const patterns = [...SQUASH_PROMOTION, ...SYNC_STEP];
  return splitSentences(markdown).filter(
    (sentence) => !NEGATION.test(sentence) && patterns.some((pattern) => pattern.test(sentence)),
  );
}

function findOldFlowFiles(files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([, markdown]) => findOldFlowSentences(markdown).length > 0)
    .map(([file]) => file);
}

describe("old promotion flow detection", () => {
  test("names a doc that squash-merges a promotion", () => {
    const files = {
      "docs/a.md": "A promotion is squash-merged into main.",
      "docs/b.md": "Promote develop with a merge commit.",
    };
    expect(findOldFlowFiles(files)).toEqual(["docs/a.md"]);
  });

  test("accepts a negated sync step", () => {
    expect(
      findOldFlowSentences("There is no sync step. Nothing merges `main` back into `develop`."),
    ).toEqual([]);
  });

  test("names a doc that merges main back into develop", () => {
    const files = {
      "docs/a.md": "After a promotion, merge `main` back into `develop`.",
      "docs/b.md": "Run the sync step to catch up.",
    };
    expect(findOldFlowFiles(files)).toEqual(["docs/a.md", "docs/b.md"]);
  });

  test("accepts squash into develop and a merge-commit promotion", () => {
    const text =
      "Pull requests are squash-merged into `develop`. A promotion is merged with a merge commit.";
    expect(findOldFlowSentences(text)).toEqual([]);
  });
});

describe("branch model docs", () => {
  test("no doc outside docs/adr describes a squash promotion or a sync step", () => {
    const files = Object.fromEntries(
      listDocumentationOutsideAdr().map((file) => [file, readRepositoryFile(file)]),
    );
    expect(findOldFlowFiles(files)).toEqual([]);
  });

  test.each(MODEL_DOCS)("%s describes develop as the trunk", (file) => {
    expect(readRepositoryFile(file)).toContain("develop");
  });

  test("development.md carries the promotion section and commands", () => {
    const text = readRepositoryFile("docs/development.md");
    expect(text).toContain("## Branching and promotion");
    expect(text).toContain(PROMOTION_COMMAND);
    expect(text).toContain("gh pr merge --merge");
    expect(text).not.toMatch(/single required status/i);
  });

  test("cut-a-release lands the bump on develop and tags the promotion merge commit", () => {
    const text = readRepositoryFile("docs/how-to/cut-a-release.md");
    expect(text).toContain(PROMOTION_COMMAND);
    expect(text).toContain("gh pr merge --merge");
    expect(text).toMatch(/against `develop`/);
    expect(text).toMatch(/promotion merge commit/);
  });

  test.each(MODEL_DOCS.filter((file) => file !== "docs/development.md"))(
    "%s links to the branching section or the promotion commands",
    (file) => {
      const text = readRepositoryFile(file);
      const linksToSection = text.includes("development.md#branching-and-promotion");
      expect(linksToSection || text.includes(PROMOTION_COMMAND)).toBe(true);
    },
  );
});
