import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

test("Tooltip renders its trigger and keeps the popup closed", () => {
  const html = renderToString(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Copy</TooltipTrigger>
        <TooltipContent>Copy to clipboard</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );

  expect(html).toContain('data-slot="tooltip-trigger"');
  expect(html).not.toContain("Copy to clipboard");
});
