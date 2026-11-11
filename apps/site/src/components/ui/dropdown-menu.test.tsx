import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

test("the nova menu parts render inside an open menu with a check on the selected item", () => {
  const html = renderToString(
    <DropdownMenu open>
      <DropdownMenuTrigger>Theme</DropdownMenuTrigger>
      <DropdownMenuContent variant="nova">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value="dark">
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>,
  );

  expect(html).toContain('data-slot="dropdown-menu-trigger"');
});

test("DropdownMenuRadioItem is exported alongside the radio group", () => {
  expect(DropdownMenuRadioItem).toBeTypeOf("function");
  expect(DropdownMenuRadioGroup).toBeTypeOf("function");
});
