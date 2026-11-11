import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { flattenKeys, getUi, UI_STRINGS } from "./ui";

const englishKeys = flattenKeys(UI_STRINGS.en);

describe("ui strings", () => {
  it("flattens nested keys to sorted dotted paths", () => {
    expect(flattenKeys({ b: "x", a: { c: "y", a: "z" } })).toEqual(["a.a", "a.c", "b"]);
  });

  it.each(LOCALES)("%s has every key that en has and no others", (locale) => {
    expect(flattenKeys(getUi(locale))).toEqual(englishKeys);
  });

  it.each(LOCALES)("%s has no empty strings", (locale) => {
    expect(JSON.stringify(getUi(locale))).not.toContain('""');
  });

  it("detects a locale that is missing a key", () => {
    const incomplete = { ...UI_STRINGS.en, notFound: { title: "x" } };
    expect(flattenKeys(incomplete)).not.toEqual(englishKeys);
  });
});
