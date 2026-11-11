import { expect, test } from "vitest";

import { glyphToCodepoints, hexToCodepoints } from "./codepoints.js";

test("glyphToCodepoints converts a single emoji", () => {
  expect(glyphToCodepoints("👋")).toBe("1f44b");
});

test("glyphToCodepoints drops variation selectors and keeps joiners", () => {
  expect(glyphToCodepoints("🙂‍↔️")).toBe("1f642-200d-2194");
  expect(glyphToCodepoints("❤️")).toBe("2764");
});

test("hexToCodepoints normalizes spaces, case and variation selectors", () => {
  expect(hexToCodepoints("1F642 200D 2194 FE0F")).toBe("1f642-200d-2194");
  expect(hexToCodepoints("1f44b")).toBe("1f44b");
});

test("both normalizers agree for the same emoji", () => {
  expect(hexToCodepoints("1f642 200d 2194 fe0f")).toBe(glyphToCodepoints("🙂‍↔️"));
});
