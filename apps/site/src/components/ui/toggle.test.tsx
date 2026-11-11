import { expect, test } from "vitest";

import { toggleVariants } from "./toggle";

test("toggleVariants defaults to the transparent default size", () => {
  const classes = toggleVariants();

  expect(classes).toContain("bg-transparent");
  expect(classes).toContain("h-8");
});

test("toggleVariants applies the outline border", () => {
  expect(toggleVariants({ variant: "outline" })).toContain("border-input");
});
