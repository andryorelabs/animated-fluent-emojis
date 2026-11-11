import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { createPackageManagerStore, PACKAGE_MANAGERS } from "@/lib/package-manager";

import DockInstall from "./DockInstall";

const labels = {
  label: "Install command",
  tabsLabel: "Package manager",
  copy: "Copy",
  copied: "Copied",
};

function render(): string {
  return renderToString(<DockInstall labels={labels} />);
}

test("DockInstall always lists every package manager, never only bun", () => {
  const html = render();

  expect(html.match(/role="tab"/g)).toHaveLength(PACKAGE_MANAGERS.length);
  for (const manager of PACKAGE_MANAGERS) {
    expect(html).toContain(`${manager}</button>`);
  }
});

test("DockInstall selects the default manager on the server", () => {
  const html = render();

  expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  expect(html).toMatch(/aria-selected="true"[^>]*>bun</);
});

test("DockInstall keeps the default on the server even when another is stored", () => {
  const store = createPackageManagerStore({
    storage: () => ({ getItem: () => "pnpm", setItem: vi.fn() }),
    target: new EventTarget(),
  });
  const html = renderToString(<DockInstall labels={labels} store={store} />);

  expect(html).toMatch(/aria-selected="true"[^>]*>bun</);
});

test("DockInstall labels the group, the tab list and the copy button", () => {
  const html = render();

  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Install command"');
  expect(html).toContain('aria-label="Package manager"');
  expect(html).toContain('aria-label="Copy"');
  expect(html).toContain("tab-pill");
  expect(html).toContain('data-variant="dock"');
});

test("DockInstall tabs are compact rect pills, not forced to a 44px circle", () => {
  const html = render();

  expect(html).not.toContain("variant=dock]/tabs:h-11");
  expect(html).toContain("variant=dock]/tabs:rounded-7");
  expect(html).not.toMatch(/variant=dock\]\/tabs:rounded-full/);
});
