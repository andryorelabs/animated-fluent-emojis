import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { Separator } from "./separator";

test("Separator renders a horizontal rule by default", () => {
  const html = renderToString(<Separator />);

  expect(html).toContain('role="separator"');
  expect(html).toContain("data-horizontal");
});

test("Separator supports the vertical orientation", () => {
  const html = renderToString(<Separator orientation="vertical" />);

  expect(html).toContain("data-vertical");
});
