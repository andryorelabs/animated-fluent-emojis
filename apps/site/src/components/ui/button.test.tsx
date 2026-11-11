import { expect, test } from "vitest";

import { buttonVariants } from "./button";

test("buttonVariants defaults to the primary variant with the rounded shape", () => {
  const classes = buttonVariants();

  expect(classes).toContain("bg-primary");
  expect(classes).toContain("rounded-lg");
});

test("buttonVariants applies the brand pill shape", () => {
  const classes = buttonVariants({ shape: "pill" });

  expect(classes).toContain("rounded-full");
  expect(classes).not.toContain("rounded-lg");
});

test("buttonVariants lets className override variant utilities", () => {
  const classes = buttonVariants({ size: "lg", className: "h-11 px-6" });

  expect(classes).toContain("h-11");
  expect(classes).not.toContain("h-9");
});

test("buttonVariants adds the sm and icon-sm sizes at 8 units", () => {
  expect(buttonVariants({ size: "sm" })).toContain("h-8");
  expect(buttonVariants({ size: "icon-sm" })).toContain("size-8");
});

test("buttonVariants gives ghost a muted hover and a press scale", () => {
  const classes = buttonVariants({ variant: "ghost" });

  expect(classes).toContain("hover:bg-muted");
  expect(classes).toContain("active:scale-97");
});

test("buttonVariants presses every variant except link and never uses transition-all", () => {
  for (const variant of ["default", "outline", "secondary", "ghost", "destructive"] as const) {
    expect(buttonVariants({ variant })).toContain("active:scale-97");
  }
  expect(buttonVariants({ variant: "link" })).not.toContain("active:scale-");
  expect(buttonVariants()).not.toContain("transition-all");
  expect(buttonVariants()).toContain("duration-(--duration-press)");
});

test("buttonVariants grows icon sizes on coarse pointers", () => {
  expect(buttonVariants({ size: "icon" })).toContain("pointer-coarse:size-10");
  expect(buttonVariants({ size: "icon-sm" })).toContain("pointer-coarse:size-10");
});
