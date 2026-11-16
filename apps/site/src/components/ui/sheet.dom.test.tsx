import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";

import { Sheet, SheetClose, SheetContent } from "./sheet";

function querySlot(slot: "sheet-overlay" | "sheet-close"): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-slot="${CSS.escape(slot)}"]`);
}

test("an open sheet portals its backdrop and right-side panel to the body", () => {
  render(
    <Sheet open>
      <SheetContent aria-label="Filters">Panel body</SheetContent>
    </Sheet>,
  );

  const panel = screen.getByRole("dialog", { name: "Filters" });
  expect(panel.dataset.side).toBe("right");
  expect(panel.className).toContain("border-l");
  expect(panel.className).toContain("p-5");
  expect(panel.textContent).toContain("Panel body");
  expect(querySlot("sheet-overlay")).not.toBeNull();
  expect(querySlot("sheet-close")).toBeNull();
});

test("a flush bottom sheet without overlay shows a labelled corner close button", () => {
  render(
    <Sheet open modal={false}>
      <SheetContent
        aria-label="Menu"
        side="bottom"
        flush
        showOverlay={false}
        showCloseButton
        closeLabel="Dismiss"
      >
        Items
      </SheetContent>
    </Sheet>,
  );

  const panel = screen.getByRole("dialog", { name: "Menu" });
  expect(panel.dataset.side).toBe("bottom");
  expect(panel.className).toContain("p-0");
  expect(querySlot("sheet-overlay")).toBeNull();
  expect(screen.getByRole("button", { name: "Dismiss" }).dataset.slot).toBe("sheet-close");
});

test("SheetClose closes an uncontrolled left sheet", async () => {
  const user = userEvent.setup();
  render(
    <Sheet defaultOpen>
      <SheetContent aria-label="Settings" side="left" showCloseButton>
        <SheetClose>Done</SheetClose>
      </SheetContent>
    </Sheet>,
  );

  expect(screen.getByRole("dialog", { name: "Settings" }).dataset.side).toBe("left");

  await user.click(screen.getByRole("button", { name: "Done" }));

  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  });
});

test("the corner close button closes a top sheet", async () => {
  const user = userEvent.setup();
  render(
    <Sheet defaultOpen>
      <SheetContent aria-label="Search" side="top" showCloseButton>
        Query
      </SheetContent>
    </Sheet>,
  );

  await user.click(screen.getByRole("button", { name: "Close" }));

  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Search" })).toBeNull();
  });
});
