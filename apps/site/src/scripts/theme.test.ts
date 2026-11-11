import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  applyThemeAnimated,
  isTheme,
  readStoredTheme,
  storeTheme,
  subscribeTheme,
} from "./theme";
import { THEME_STORAGE_KEY } from "./theme-keys";

function stubBrowser(
  prefersDark: boolean,
  storage: Map<string, string>,
  options: { reducedMotion?: boolean; startViewTransition?: boolean } = {},
) {
  const classes = new Set<string>();
  const root = {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
      toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name)),
    },
    dataset: {} as Record<string, string>,
  };
  const frames: FrameRequestCallback[] = [];
  const metas = ["light", "dark"].map((scheme) => {
    const attributes = new Map([
      ["media", `(prefers-color-scheme: ${scheme})`],
      ["content", scheme === "dark" ? "#0d1715" : "#f7faf9"],
    ]);
    return {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attributes.set(name, value);
      },
    };
  });
  const startViewTransition = vi.fn((update: () => void) => {
    update();
  });
  vi.stubGlobal("document", {
    documentElement: root,
    querySelectorAll: () => metas,
    ...(options.startViewTransition && { startViewTransition }),
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion")
      ? Boolean(options.reducedMotion)
      : prefersDark,
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
  return { classes, root, frames, metas, startViewTransition };
}

function blockedStorage(): never {
  throw new Error("blocked");
}

describe("theme", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognises only the three themes", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("sepia")).toBe(false);
  });

  it("stores light and dark and clears the override for system", () => {
    stubBrowser(false, storage);
    storeTheme("dark");
    expect(storage.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
    storeTheme("system");
    expect(readStoredTheme()).toBe("system");
  });

  it("notifies subscribers until they unsubscribe", () => {
    stubBrowser(false, storage);
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    storeTheme("dark");
    unsubscribe();
    storeTheme("light");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("falls back to system and flags the page when storage is blocked", () => {
    const { root } = stubBrowser(false, storage);
    vi.stubGlobal("localStorage", {
      getItem: blockedStorage,
      setItem: blockedStorage,
      removeItem: blockedStorage,
    });
    expect(readStoredTheme()).toBe("system");
    storeTheme("dark");
    expect(root.dataset.themeStorage).toBe("unavailable");
  });

  it("applies system by following the OS color scheme", () => {
    const { classes, root } = stubBrowser(true, storage);
    applyTheme("system");
    expect(classes.has("dark")).toBe(true);
    expect(root.dataset.theme).toBe("system");
  });

  it("keeps theme-color in step with a manual toggle", () => {
    const { metas } = stubBrowser(false, storage);
    const colors = () => metas.map((meta) => meta.getAttribute("content"));
    applyTheme("dark");
    expect(colors()).toEqual(["#0d1715", "#0d1715"]);
    applyTheme("light");
    expect(colors()).toEqual(["#f7faf9", "#f7faf9"]);
    applyTheme("system");
    expect(colors()).toEqual(["#f7faf9", "#0d1715"]);
  });

  it("holds theme-switching for two frames", () => {
    const { classes, frames } = stubBrowser(false, storage);
    applyTheme("dark");
    expect(classes.has("theme-switching")).toBe(true);
    frames.shift()?.(0);
    expect(classes.has("theme-switching")).toBe(true);
    frames.shift()?.(0);
    expect(classes.has("theme-switching")).toBe(false);
  });

  it("cross-fades through one view transition that applies the theme", () => {
    const { classes, startViewTransition } = stubBrowser(false, storage, {
      startViewTransition: true,
    });
    applyThemeAnimated("dark");
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(classes.has("dark")).toBe(true);
  });

  it("applies the theme directly when view transitions are missing", () => {
    const { classes, root } = stubBrowser(false, storage);
    applyThemeAnimated("dark");
    expect(classes.has("dark")).toBe(true);
    expect(root.dataset.theme).toBe("dark");
  });

  it("applies the theme directly under reduced motion", () => {
    const { classes, startViewTransition } = stubBrowser(false, storage, {
      reducedMotion: true,
      startViewTransition: true,
    });
    applyThemeAnimated("dark");
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(classes.has("dark")).toBe(true);
  });

  it("never starts a view transition from applyTheme", () => {
    const { startViewTransition } = stubBrowser(false, storage, {
      startViewTransition: true,
    });
    applyTheme("dark");
    expect(startViewTransition).not.toHaveBeenCalled();
  });
});
