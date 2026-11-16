import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  createPackageManagerStore,
  PACKAGE_MANAGERS,
  type PackageManager,
} from "@/lib/package-manager";

import InstallBlock from "./InstallBlock";

const labels = {
  tabsLabel: "Package manager",
  copy: "Copy command",
  copied: "Copied",
};

const htmlByManager = Object.fromEntries(
  PACKAGE_MANAGERS.map((manager) => [manager, `<div>${manager}-markup</div>`]),
) as Record<PackageManager, string>;

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

beforeEach(() => {
  vi.stubGlobal("fetch", () => new Promise(vi.fn()));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("choosing a manager updates the shared store and the copied command", async () => {
  const user = userEvent.setup();
  const store = memoryStore();
  render(<InstallBlock htmlByManager={htmlByManager} labels={labels} store={store} />);

  await user.click(screen.getByRole("tab", { name: "pnpm" }));
  expect(store.get()).toBe("pnpm");

  await user.click(screen.getByRole("button", { name: "Copy command" }));
  expect(await navigator.clipboard.readText()).toBe("pnpm add animated-fluent-emojis");
});

test("a copy starts a party-popper burst from the copy button", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  render(<InstallBlock htmlByManager={htmlByManager} labels={labels} store={memoryStore()} />);

  expect(document.querySelector("[data-copy-burst]")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Copy command" }));

  expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  expect(document.querySelector("[data-copy-burst]")).not.toBeNull();
});
