import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const segments = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta", leading: <i data-testid="lead" /> },
];

test("SegmentedControl reports the chosen segment value", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<SegmentedControl label="Pick" segments={segments} selected="a" onSelect={onSelect} />);

  expect(screen.getByRole("group", { name: "Pick" })).toBeTruthy();
  expect(screen.getByTestId("lead")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Beta" }));

  expect(onSelect).toHaveBeenCalledWith("b");
});

test("SegmentedControl ignores changes and shows the hint while disabled", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <SegmentedControl
      label="Pick"
      segments={segments}
      selected="a"
      onSelect={onSelect}
      disabled
      disabledHint="Unavailable"
    />,
  );

  const segment = screen.getByRole("button", { name: "Beta" });
  expect(segment.getAttribute("aria-disabled")).toBe("true");
  expect(segment.getAttribute("title")).toBe("Unavailable");

  await user.click(segment);

  expect(onSelect).not.toHaveBeenCalled();
});
