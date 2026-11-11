import { useSyncExternalStore } from "react";

import {
  DEFAULT_PACKAGE_MANAGER,
  sharedPackageManagerStore,
  type PackageManager,
  type PackageManagerStore,
} from "./package-manager";

/**
 * Reads and writes the page-wide package manager choice from any React island.
 * The server and the first client render show the default manager, then the
 * stored choice is applied after hydration; every island using the same store
 * re-renders together when one of them changes it.
 * @param store - The store to bind to; defaults to the shared page-wide store.
 * @returns The current manager and a setter that persists and broadcasts it.
 */
export function usePackageManager(
  store: PackageManagerStore = sharedPackageManagerStore,
): readonly [PackageManager, (manager: PackageManager) => void] {
  const manager = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_PACKAGE_MANAGER);
  return [manager, store.set] as const;
}
