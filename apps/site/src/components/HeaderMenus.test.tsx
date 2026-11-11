import { expect, test } from "vitest";

import { compactLinkItemStyles } from "@/components/ui/dropdown-menu";

test("header menu items never underline, so the portaled popups ignore docs link styles", () => {
  expect(compactLinkItemStyles.split(" ")).toContain("no-underline");
});
