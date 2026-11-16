import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { ChipGroup } from "./ChipGroup";

const chips = [
  { value: 64, label: "Small" },
  { value: 96, label: "Medium", leading: <i data-testid="lead" /> },
];

test("ChipGroup reports the chosen chip value with its original type", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<ChipGroup label="Size" chips={chips} selected={64} onSelect={onSelect} />);

  expect(screen.getByRole("group", { name: "Size" })).toBeTruthy();
  expect(screen.getByTestId("lead")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Medium" }));

  expect(onSelect).toHaveBeenCalledWith(96);
});

test("ChipGroup ignores changes and shows the hint while disabled", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <ChipGroup
      label="Size"
      chips={chips}
      selected={64}
      onSelect={onSelect}
      disabled
      disabledHint="Not available"
    />,
  );

  const chip = screen.getByRole("button", { name: "Medium" });
  expect(chip.getAttribute("aria-disabled")).toBe("true");
  expect(chip.getAttribute("title")).toBe("Not available");

  await user.click(chip);

  expect(onSelect).not.toHaveBeenCalled();
});
