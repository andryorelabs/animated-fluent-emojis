import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

function ThemeMenu(props: { onValueChange: (value: string) => void; onReset: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="split" aria-label="Theme options" />
      <DropdownMenuContent variant="split">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup defaultValue="dark" onValueChange={props.onValueChange}>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuItem onClick={props.onReset}>Reset</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

test("the split trigger opens a portaled nova menu whose radio items report the chosen value", async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<ThemeMenu onValueChange={onValueChange} onReset={vi.fn()} />);

  const trigger = screen.getByRole("button", { name: "Theme options" });
  expect(trigger.dataset.slot).toBe("dropdown-menu-trigger");
  expect(trigger.className).toContain("size-8");

  await user.click(trigger);

  const menu = await screen.findByRole("menu");
  expect(menu.dataset.slot).toBe("dropdown-menu-content");
  expect(menu.className).toContain("min-w-42");
  expect(screen.getByText("Theme").dataset.slot).toBe("dropdown-menu-label");
  expect(screen.getByRole("separator").dataset.slot).toBe("dropdown-menu-separator");
  expect(screen.getByRole("menuitemradio", { name: "Dark" }).getAttribute("aria-checked")).toBe(
    "true",
  );

  await user.click(screen.getByRole("menuitemradio", { name: "Light" }));

  expect(onValueChange).toHaveBeenCalledWith("light", expect.anything());
});

test("a plain menu item runs its action and closes the menu", async () => {
  const user = userEvent.setup();
  const onReset = vi.fn();
  render(<ThemeMenu onValueChange={vi.fn()} onReset={onReset} />);

  await user.click(screen.getByRole("button", { name: "Theme options" }));
  await user.click(await screen.findByRole("menuitem", { name: "Reset" }));

  expect(onReset).toHaveBeenCalledOnce();
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

test("link items render real anchors in the default and compact styles", async () => {
  const user = userEvent.setup();
  render(
    <DropdownMenu>
      <DropdownMenuTrigger className="px-2">Language</DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} collisionPadding={4}>
        <DropdownMenuLinkItem href="/en/">English</DropdownMenuLinkItem>
        <DropdownMenuLinkItem href="/es/" variant="compact">
          Español
        </DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );

  const trigger = screen.getByRole("button", { name: "Language" });
  expect(trigger.className).toBe("px-2");

  await user.click(trigger);

  const menu = await screen.findByRole("menu");
  expect(menu.className).toContain("rounded-brand");
  const english = screen.getByRole("menuitem", { name: "English" });
  const spanish = screen.getByRole("menuitem", { name: "Español" });
  expect(english.getAttribute("href")).toBe("/en/");
  expect(english.className).toContain("rounded-full");
  expect(spanish.getAttribute("href")).toBe("/es/");
  expect(spanish.className).toContain("rounded-md");
  expect(spanish.dataset.slot).toBe("dropdown-menu-link-item");
});

test("the nova content variant uses the compact panel width", async () => {
  const user = userEvent.setup();
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>More</DropdownMenuTrigger>
      <DropdownMenuContent variant="nova">
        <DropdownMenuItem>Copy</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );

  await user.click(screen.getByRole("button", { name: "More" }));

  const menu = await screen.findByRole("menu");
  expect(menu.className).toContain("min-w-40");
});
