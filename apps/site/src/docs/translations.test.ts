import { describe, expect, it } from "vitest";

import {
  classifyTranslation,
  hashSource,
  MalformedTranslationError,
  parseTranslation,
} from "./translations";

describe("hashSource", () => {
  it("is stable across line endings and changes with content", () => {
    expect(hashSource("a\r\nb")).toBe(hashSource("a\nb"));
    expect(hashSource("a")).not.toBe(hashSource("b"));
    expect(hashSource("a")).toHaveLength(16);
  });
});

describe("parseTranslation", () => {
  it("reads frontmatter and body", () => {
    expect(
      parseTranslation(
        '---\ntitle: "Guía"\nsourceHash: abc\ndescription: Hola\n---\n\nCuerpo\n',
        "es/usage.md",
      ),
    ).toEqual({
      title: "Guía",
      sourceHash: "abc",
      description: "Hola",
      body: "\nCuerpo\n",
    });
  });

  it.each([
    ["no frontmatter", "# Hola"],
    ["no title", "---\nsourceHash: a\n---\nx"],
    ["no sourceHash", "---\ntitle: a\n---\nx"],
    ["a bad line", "---\ntitle a\nsourceHash: a\n---\nx"],
  ])("rejects %s", (_name, text) => {
    expect(() => parseTranslation(text, "es/usage.md")).toThrow(MalformedTranslationError);
  });
});

describe("classifyTranslation", () => {
  it("distinguishes missing, stale and translated", () => {
    expect(classifyTranslation(undefined, "a")).toBe("missing");
    expect(classifyTranslation({ sourceHash: "old" }, "a")).toBe("stale");
    expect(classifyTranslation({ sourceHash: "a" }, "a")).toBe("translated");
  });
});
