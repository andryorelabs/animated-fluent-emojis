import { expect, test } from "vitest";

import { CORPUS } from "./corpus";

test("every corpus repository is pinned to a full commit sha", () => {
  for (const repository of CORPUS) {
    expect(repository.commit).toMatch(/^[0-9a-f]{40}$/);
  }
});

test("corpus repository names are unique", () => {
  const names = CORPUS.map((repository) => repository.name);
  expect(new Set(names).size).toBe(names.length);
});
