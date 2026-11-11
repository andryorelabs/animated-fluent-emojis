import { describe, expect, it, vi } from "vitest";

import {
  createPackageManagerStore,
  DEFAULT_PACKAGE_MANAGER,
  installCommand,
  isPackageManager,
  PACKAGE_MANAGER_STORAGE_KEY,
  PACKAGE_MANAGERS,
  type PackageManagerStorage,
} from "./package-manager";

function memoryStorage(initial?: string): PackageManagerStorage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(PACKAGE_MANAGER_STORAGE_KEY, initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function throwingStorage(): PackageManagerStorage {
  return {
    getItem: () => {
      throw new DOMException("denied", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
  };
}

describe("package manager commands", () => {
  it("supports bun, pnpm, npm and yarn", () => {
    expect(PACKAGE_MANAGERS).toEqual(["bun", "pnpm", "npm", "yarn"]);
  });

  it.each([
    ["bun", "bun add animated-fluent-emojis"],
    ["npm", "npm install animated-fluent-emojis"],
    ["pnpm", "pnpm add animated-fluent-emojis"],
    ["yarn", "yarn add animated-fluent-emojis"],
  ] as const)("installs with %s", (manager, command) => {
    expect(installCommand(manager)).toBe(command);
  });

  it("recognizes only supported managers", () => {
    expect(isPackageManager("pnpm")).toBe(true);
    expect(isPackageManager("deno")).toBe(false);
    expect(isPackageManager(undefined)).toBe(false);
  });
});

describe("package manager store", () => {
  it("uses the afe:pm key", () => {
    expect(PACKAGE_MANAGER_STORAGE_KEY).toBe("afe:pm");
  });

  it("defaults to bun when nothing valid is stored", () => {
    const empty = createPackageManagerStore({
      storage: () => memoryStorage(),
      target: new EventTarget(),
    });
    const invalid = createPackageManagerStore({
      storage: () => memoryStorage("deno"),
      target: new EventTarget(),
    });
    expect(empty.get()).toBe(DEFAULT_PACKAGE_MANAGER);
    expect(invalid.get()).toBe(DEFAULT_PACKAGE_MANAGER);
  });

  it("persists the choice and restores it in a new store", () => {
    const storage = memoryStorage();
    const first = createPackageManagerStore({
      storage: () => storage,
      target: new EventTarget(),
    });
    first.set("pnpm");
    expect(storage.getItem("afe:pm")).toBe("pnpm");
    const second = createPackageManagerStore({
      storage: () => storage,
      target: new EventTarget(),
    });
    expect(second.get()).toBe("pnpm");
  });

  it("syncs separate stores that share a page", () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    const first = createPackageManagerStore({ storage: () => storage, target });
    const second = createPackageManagerStore({ storage: () => storage, target });
    const listener = vi.fn();
    second.subscribe(listener);
    first.set("yarn");
    expect(listener).toHaveBeenCalledWith("yarn");
    expect(second.get()).toBe("yarn");
  });

  it("stops notifying after unsubscribe and ignores foreign events", () => {
    const target = new EventTarget();
    const store = createPackageManagerStore({
      storage: () => memoryStorage(),
      target,
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    target.dispatchEvent(new CustomEvent("afe:pm-change", { detail: "deno" }));
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
    store.set("npm");
    expect(listener).not.toHaveBeenCalled();
  });

  it("survives a throwing localStorage and still syncs", () => {
    const target = new EventTarget();
    const first = createPackageManagerStore({
      storage: throwingStorage,
      target,
    });
    const second = createPackageManagerStore({
      storage: throwingStorage,
      target,
    });
    const listener = vi.fn();
    second.subscribe(listener);
    expect(first.get()).toBe(DEFAULT_PACKAGE_MANAGER);
    expect(() => {
      first.set("npm");
    }).not.toThrow();
    expect(first.get()).toBe("npm");
    expect(second.get()).toBe("npm");
    expect(listener).toHaveBeenCalledWith("npm");
  });

  it("survives a storage getter that throws", () => {
    const store = createPackageManagerStore({
      storage: () => {
        throw new ReferenceError("localStorage is not defined");
      },
      target: new EventTarget(),
    });
    expect(store.get()).toBe(DEFAULT_PACKAGE_MANAGER);
    expect(() => {
      store.set("yarn");
    }).not.toThrow();
    expect(store.get()).toBe("yarn");
  });
});
