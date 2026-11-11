import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const WORKSPACE_MANIFESTS: readonly string[] = [
  "package.json",
  "apps/assets/package.json",
  "apps/site/package.json",
  "packages/animated-fluent-emojis/package.json",
];

const REQUIRED_FIELDS: readonly string[] = [
  "description",
  "license",
  "author",
  "homepage",
  "repository",
  "bugs",
];

const ISSUE_FORMS: readonly string[] = [
  "1-bug-report.yml",
  "2-feature-request.yml",
  "3-enhancement-request.yml",
  "4-documentation-bug.yml",
];

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function collectLabels(source: string): string[] {
  return source
    .matchAll(/^\s*labels:\s*\[(.*?)\]/gm)
    .flatMap((match) =>
      (match[1] ?? "").matchAll(/'([^']+)'|"([^"]+)"/g).map((label) => label[1] ?? label[2] ?? ""),
    )
    .toArray();
}

function collectLabelValues(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap((item) => collectLabelValues(item));
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "labels" || key === "addLabels"
      ? (value as unknown[]).filter((label): label is string => typeof label === "string")
      : collectLabelValues(value),
  );
}

const knownLabels = new Set(
  readRepositoryFile(".github/labels.yml")
    .matchAll(/^- name: "(.+)"$/gm)
    .map((match) => match[1])
    .filter((label): label is string => label !== undefined),
);

describe("labels", () => {
  test("the issue form directory holds the expected forms", () => {
    const forms = readdirSync(path.join(ROOT, ".github/ISSUE_TEMPLATE"))
      .filter((name) => /^\d-.+\.yml$/.test(name))
      .toSorted((left, right) => left.localeCompare(right));
    expect(forms).toEqual([...ISSUE_FORMS]);
  });

  test("every label in renovate.json5 exists in .github/labels.yml", () => {
    const config = runInNewContext(`(${readRepositoryFile("renovate.json5")})`) as unknown;
    const labels = collectLabelValues(config);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((label) => !knownLabels.has(label))).toEqual([]);
  });

  test.each(ISSUE_FORMS)("every label of %s exists in .github/labels.yml", (form) => {
    const labels = collectLabels(readRepositoryFile(`.github/ISSUE_TEMPLATE/${form}`));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((label) => !knownLabels.has(label))).toEqual([]);
  });
});

describe("package metadata", () => {
  test.each(WORKSPACE_MANIFESTS)("%s carries the required fields", (file) => {
    const manifest = JSON.parse(readRepositoryFile(file)) as Record<string, unknown>;
    const missing = REQUIRED_FIELDS.filter(
      (field) => manifest[field] === undefined || manifest[field] === "",
    );
    expect(missing).toEqual([]);
  });

  test.each(WORKSPACE_MANIFESTS.filter((file) => file !== "package.json"))(
    "%s names the author and the homepage",
    (file) => {
      const manifest = JSON.parse(readRepositoryFile(file)) as {
        author?: unknown;
        homepage?: unknown;
      };
      expect(manifest.author).toBe("Andry Orellana <hello@andryore.dev>");
      expect(manifest.homepage).toBe("https://animated-fluent-emojis.andryore.dev");
    },
  );
});
