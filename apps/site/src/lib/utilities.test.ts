import { expect, test } from "vitest";

import { cn } from "./utilities";

test("cn joins truthy class names and drops falsy ones", () => {
  expect(cn("p-2", false, undefined, "m-2", ["text-sm"])).toBe("p-2 m-2 text-sm");
});

test("cn resolves conflicting Tailwind utilities in favor of the last one", () => {
  expect(cn("rounded-lg px-2", "rounded-full px-6")).toBe("rounded-full px-6");
});

test("cn keeps a themed font size next to a text color", () => {
  expect(cn("text-micro text-muted-foreground")).toBe("text-micro text-muted-foreground");
  expect(cn("text-xs text-caption")).toBe("text-caption");
});

test("cn lets a themed radius replace another radius", () => {
  expect(cn("rounded-lg", "rounded-10")).toBe("rounded-10");
});
