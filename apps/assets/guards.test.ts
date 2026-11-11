import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import {
  appendStepSummary,
  assertDiscoveryHealthy,
  assertFileCountWithinLimit,
  assertRemovalsWithinLimit,
  countFiles,
} from "./guards.js";
import { createTeamsManifest } from "./test-support.js";

function manifestWithCount(count: number): Manifest {
  const template = createTeamsManifest().categories[0]?.emoticons[0];
  if (!template) throw new Error("missing template emoticon");
  return {
    categories: [
      {
        id: "c",
        title: "C",
        description: "C",
        emoticons: Array.from({ length: count }, (_, index) => ({
          ...template,
          id: `e${String(index)}`,
        })),
      },
    ],
  };
}

const removed = (count: number) => ({
  removed: Array.from({ length: count }, (_, index) => `e${String(index)}`),
});

test("fails when both discovery sources failed, unless guards are bypassed", () => {
  expect(() => {
    assertDiscoveryHealthy({ advertisedSourcesFailed: true }, false);
  }).toThrow("Teams discovery failed");
  expect(() => {
    assertDiscoveryHealthy({ advertisedSourcesFailed: true }, true);
  }).not.toThrow();
  expect(() => {
    assertDiscoveryHealthy({ advertisedSourcesFailed: false }, false);
  }).not.toThrow();
});

test("fails when removals exceed 5% of the previous catalog, unless guards are bypassed", () => {
  const previous = manifestWithCount(100);
  expect(() => {
    assertRemovalsWithinLimit(previous, removed(5), false);
  }).not.toThrow();
  expect(() => {
    assertRemovalsWithinLimit(previous, removed(6), false);
  }).toThrow("6 of 100");
  expect(() => {
    assertRemovalsWithinLimit(previous, removed(60), true);
  }).not.toThrow();
});

test("the file cap fails over the limit and is not bypassable", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "guards-"));
  await Promise.all(["a", "b", "c"].map((name) => writeFile(path.join(directory, name), name)));

  expect(await countFiles(directory)).toBe(3);
  await expect(assertFileCountWithinLimit(directory, 3)).resolves.toBeUndefined();
  await expect(assertFileCountWithinLimit(directory, 2)).rejects.toThrow("3 files");
});

test("appendStepSummary writes to the given file and skips empty input", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "summary-"));
  const summary = path.join(directory, "summary.md");

  appendStepSummary("Warnings", [], summary);
  appendStepSummary("Warnings", ["one", "two"], summary);

  expect(await readFile(summary, "utf8")).toBe("### Warnings\n\n- one\n- two\n\n");
});
