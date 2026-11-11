import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const MODULE_PATH = path.resolve(import.meta.dirname, "../vanilla/create-emoji.ts");

const FRAMEWORKS = /^(react|react-dom|vue|svelte|astro|preact|solid-js)(\/|$)/;

test("importing the vanilla module touches no DOM", async () => {
  expect(typeof document).toBe("undefined");

  const module = await import("../vanilla/create-emoji.js");

  expect(typeof module.createEmoji).toBe("function");
});

test("the vanilla module imports no framework", () => {
  const code = readFileSync(MODULE_PATH, "utf8");
  const specifiers = Array.from(code.matchAll(/from\s+'([^']+)'/g), (match) => match[1] ?? "");

  expect(specifiers.filter((value) => FRAMEWORKS.test(value))).toEqual([]);
});
