import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function collapse(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
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

describe("public copy", () => {
  test("the README slogan is the tagline in docs/brand/copy.md", () => {
    const readme = readRepositoryFile("README.md");
    expect(readme).toContain(`<strong>${copyTagline()}</strong>`);
  });

  test("the library description is the package.json line in docs/brand/copy.md", () => {
    const manifest = JSON.parse(
      readRepositoryFile("packages/animated-fluent-emojis/package.json"),
    ) as { description?: string };
    expect(collapse(manifest.description ?? "")).toBe(copyDescription());
  });
});
