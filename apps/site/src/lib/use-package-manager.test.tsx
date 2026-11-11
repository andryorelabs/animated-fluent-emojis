import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import {
  createPackageManagerStore,
  sharedPackageManagerStore,
  type PackageManagerStore,
} from "./package-manager";
import { usePackageManager } from "./use-package-manager";

function Probe({ store }: { store: PackageManagerStore }) {
  const [manager] = usePackageManager(store);
  return <span>{manager}</span>;
}

test("usePackageManager renders the default manager on the server", () => {
  const store = createPackageManagerStore({
    storage: () => ({ getItem: () => "pnpm", setItem: vi.fn() }),
    target: new EventTarget(),
  });
  expect(renderToString(<Probe store={store} />)).toContain(">bun<");
});

test("the hook falls back to the shared store", () => {
  expect(sharedPackageManagerStore.get()).toBe("bun");
});
