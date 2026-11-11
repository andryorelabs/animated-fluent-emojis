import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { THEME_INIT_HASH, THEME_INIT_SCRIPT } from "./theme-init";
import { THEME_COLORS, THEME_STORAGE_KEY } from "./theme-keys";

interface FakeEnvironment {
  stored: string | null;
  blocked?: boolean;
  prefersDark: boolean;
}

function runInit({ stored, blocked = false, prefersDark }: FakeEnvironment) {
  const classes = new Set<string>();
  const root = {
    classList: {
      toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name)),
    },
    dataset: {} as Record<string, string>,
  };
  const metas = [THEME_COLORS.light, THEME_COLORS.dark].map((initial: string) => {
    const meta = {
      content: initial,
      setAttribute: (_name: string, value: string) => {
        meta.content = value;
      },
    };
    return meta;
  });
  let onChange: ((event: { matches: boolean }) => void) | undefined;
  const localStorage = {
    getItem: (key: string) => {
      if (blocked) throw new Error("blocked");
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  runInNewContext(THEME_INIT_SCRIPT, {
    document: { documentElement: root, querySelectorAll: () => metas },
    localStorage,
    matchMedia: () => ({
      matches: prefersDark,
      addEventListener: (_type: string, listener: typeof onChange) => {
        onChange = listener;
      },
    }),
  });
  return {
    dark: () => classes.has("dark"),
    theme: root.dataset.theme,
    colors: () => metas.map((meta) => meta.content),
    systemChanged: (matches: boolean) => onChange?.({ matches }),
    setTheme: (value: string) => {
      root.dataset.theme = value;
    },
  };
}

describe("theme init script", () => {
  it("follows the system when nothing is stored", () => {
    const dark = runInit({ stored: null, prefersDark: true });
    expect([dark.dark(), dark.theme]).toEqual([true, "system"]);
    expect(runInit({ stored: null, prefersDark: false }).dark()).toBe(false);
  });

  it("lets a stored override win over the system", () => {
    const light = runInit({ stored: "light", prefersDark: true });
    expect([light.dark(), light.theme]).toEqual([false, "light"]);
    const dark = runInit({ stored: "dark", prefersDark: false });
    expect([dark.dark(), dark.theme]).toEqual([true, "dark"]);
  });

  it("ignores junk and blocked storage", () => {
    expect(runInit({ stored: "purple", prefersDark: false }).theme).toBe("system");
    expect(runInit({ stored: null, blocked: true, prefersDark: true }).dark()).toBe(true);
  });

  it("sets theme-color before paint for a stored override only", () => {
    expect(runInit({ stored: "dark", prefersDark: false }).colors()).toEqual([
      THEME_COLORS.dark,
      THEME_COLORS.dark,
    ]);
    expect(runInit({ stored: "light", prefersDark: true }).colors()).toEqual([
      THEME_COLORS.light,
      THEME_COLORS.light,
    ]);
    expect(runInit({ stored: null, prefersDark: true }).colors()).toEqual([
      THEME_COLORS.light,
      THEME_COLORS.dark,
    ]);
  });

  it("follows live system changes only while the preference is system", () => {
    const system = runInit({ stored: null, prefersDark: false });
    system.systemChanged(true);
    expect(system.dark()).toBe(true);
    system.systemChanged(false);
    expect(system.dark()).toBe(false);
    system.setTheme("light");
    system.systemChanged(true);
    expect(system.dark()).toBe(false);
  });

  it("exposes a sha256 hash for the CSP", () => {
    expect(THEME_INIT_HASH).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
  });
});
