import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";

import { createPackageManagerStore } from "@/lib/package-manager";

import DockInstall from "./DockInstall";

const labels = {
  label: "Install command",
  tabsLabel: "Package manager",
  copy: "Copy",
  copied: "Copied",
};

function memoryStore() {
  let stored: string | null = null;
  return createPackageManagerStore({
    storage: () => ({
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    }),
    target: new EventTarget(),
  });
}

test("choosing a tab updates the shared store and the shown command", async () => {
  const user = userEvent.setup();
  const store = memoryStore();
  const { container } = render(<DockInstall labels={labels} store={store} />);
  expect(container.querySelector("[data-dock-command]")?.textContent).toBe(
    "bun add animated-fluent-emojis",
  );

  await user.click(screen.getByRole("tab", { name: "yarn" }));

  expect(store.get()).toBe("yarn");
  expect(container.querySelector("[data-dock-command]")?.textContent).toBe(
    "yarn add animated-fluent-emojis",
  );
});

test("the copy button writes the chosen command and announces it", async () => {
  const user = userEvent.setup();
  render(<DockInstall labels={labels} store={memoryStore()} />);

  await user.click(screen.getByRole("tab", { name: "npm" }));
  await user.click(screen.getByRole("button", { name: "Copy" }));

  expect(await navigator.clipboard.readText()).toBe("npm install animated-fluent-emojis");
  expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Copied");
});
