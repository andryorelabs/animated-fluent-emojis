import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { Input } from "./input";

test("Input renders a native input with the default pill styles and forwards typing", async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<Input aria-label="Name" onValueChange={onValueChange} className="mt-2" />);

  const input = screen.getByRole("textbox", { name: "Name" });
  expect(input).toHaveProperty("tagName", "INPUT");
  expect(input.dataset.slot).toBe("input");
  expect(input.className).toContain("rounded-full");
  expect(input.className).toContain("mt-2");

  await user.type(input, "hi");

  expect(input).toHaveProperty("value", "hi");
  expect(onValueChange).toHaveBeenLastCalledWith("hi", expect.anything());
});

test("Input applies the compact search variant", () => {
  render(<Input aria-label="Search" variant="search" type="search" />);

  const input = screen.getByRole("searchbox", { name: "Search" });
  expect(input.className).toContain("pl-9");
  expect(input.className).not.toContain("rounded-full");
});
