import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { getUi } from "../../i18n/ui";
import { GallerySidebar } from "./GallerySidebar";

const strings = getUi("en").gallery;
const categories = [
  { name: "Animals", count: 3 },
  { name: "Food", count: 2 },
];

function renderSidebar(
  overrides: { category?: string; toneDisabled?: boolean; tone?: "dark" } = {},
) {
  const handlers = { onCategory: vi.fn(), onTone: vi.fn(), onSize: vi.fn() };
  render(
    <GallerySidebar
      strings={strings}
      categories={categories}
      totalCount={5}
      category={overrides.category}
      tone={overrides.tone}
      toneDisabled={overrides.toneDisabled ?? false}
      size={96}
      {...handlers}
    />,
  );
  return handlers;
}

test("GallerySidebar lists categories with counts and reports the chosen one", async () => {
  const user = userEvent.setup();
  const handlers = renderSidebar({ category: "Animals" });

  const group = screen.getByRole("group", { name: strings.categoryLabel });
  expect(within(group).getAllByRole("button")).toHaveLength(3);
  expect(
    within(group)
      .getByRole("button", { name: /Animals/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");

  await user.click(within(group).getByRole("button", { name: /Food/ }));
  expect(handlers.onCategory).toHaveBeenLastCalledWith("Food");

  await user.click(
    within(group).getByRole("button", {
      name: new RegExp(strings.categoryAll),
    }),
  );
  expect(handlers.onCategory).toHaveBeenLastCalledWith(undefined);
});

test("GallerySidebar maps tone and size choices to their handlers", async () => {
  const user = userEvent.setup();
  const handlers = renderSidebar({ tone: "dark" });

  await user.click(screen.getByRole("button", { name: strings.toneLight }));
  expect(handlers.onTone).toHaveBeenLastCalledWith("light");

  await user.click(screen.getByRole("button", { name: strings.toneDefault }));
  expect(handlers.onTone).toHaveBeenLastCalledWith(undefined);

  await user.click(screen.getByRole("button", { name: "128" }));
  expect(handlers.onSize).toHaveBeenLastCalledWith(128);
});
