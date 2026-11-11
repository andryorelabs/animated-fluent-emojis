import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const FRAMEWORKS = /^(react|react-dom|vue|svelte|astro|preact|solid-js)(\/|$)/;

const IMPORT_SPECIFIER = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;

const sources = readdirSync(import.meta.dirname).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

test("core modules exist", () => {
  expect(sources.length).toBeGreaterThan(0);
});

test.each(sources)("%s imports no framework and nothing outside utils", (file) => {
  const code = readFileSync(path.join(import.meta.dirname, file), "utf8");
  const specifiers = Array.from(code.matchAll(IMPORT_SPECIFIER), (match) => match[1] ?? "");

  expect(specifiers.filter((specifier) => FRAMEWORKS.test(specifier))).toEqual([]);
  expect(
    specifiers.filter(
      (specifier) =>
        specifier.startsWith("..") &&
        !/^\.\.\/utils\/(visibility-observer|shared-subscription)\.js$/.test(specifier),
    ),
  ).toEqual([]);
});
