import { describe, expect, it } from "vitest";

import { ANSWER_CRAWLERS, SEARCH_CRAWLERS, TRAINING_CRAWLERS } from "./crawlers";

describe("crawlers", () => {
  it("has no crawler in two categories", () => {
    const all = [...SEARCH_CRAWLERS, ...ANSWER_CRAWLERS, ...TRAINING_CRAWLERS];
    expect(new Set(all).size).toBe(all.length);
  });

  it("never lists Google-Extended", () => {
    const all: readonly string[] = [...SEARCH_CRAWLERS, ...ANSWER_CRAWLERS, ...TRAINING_CRAWLERS];
    expect(all).not.toContain("Google-Extended");
  });
});
