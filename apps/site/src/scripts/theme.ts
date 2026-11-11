import { THEME_COLORS, THEME_STORAGE_KEY } from "./theme-keys";

export type Theme = "system" | "light" | "dark";

const listeners = new Set<() => void>();

/**
 * Subscribes to stored-theme changes for `useSyncExternalStore`.
 * @param listener - Called after {@link storeTheme} persists a choice.
 * @returns A function that removes the listener.
 */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Narrows an arbitrary value to a {@link Theme}.
 * @param value - The candidate, such as a Base UI radio value.
 * @returns Whether the value is a known theme.
 */
export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && ["system", "light", "dark"].includes(value);
}

/**
 * Reads the stored theme override, falling back to `system` when nothing is
 * stored or storage is blocked.
 * @returns `light` or `dark` when overridden, otherwise `system`.
 */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * Persists a theme choice. `system` clears the override. A blocked storage is
 * flagged on `html[data-theme-storage]` instead of throwing.
 * @param theme - The chosen theme.
 */
export function storeTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    document.documentElement.dataset.themeStorage = "unavailable";
  }
  for (const listener of listeners) listener();
}

/**
 * Applies a theme to the root element: toggles `html.dark` and sets
 * `html[data-theme]`. When `suppressTransitions` is true the
 * `theme-switching` class stays on the root for two animation frames so
 * colors change at once.
 * @param theme - The theme whose class and attribute are written.
 * @param suppressTransitions - Whether to add `theme-switching` while applying.
 */
export function applyTheme(theme: Theme, suppressTransitions = true): void {
  const root = document.documentElement;
  if (suppressTransitions) {
    root.classList.add("theme-switching");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("theme-switching");
      });
    });
  }
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.dataset.theme = theme;
  syncThemeColor(theme);
}

/**
 * Applies a user-chosen theme, cross-fading the page through a same-document
 * view transition. Falls back to an instant {@link applyTheme} when the user
 * prefers reduced motion or the browser lacks `startViewTransition`.
 * @param theme - The theme whose class and attribute are written.
 */
export function applyThemeAnimated(theme: Theme): void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof document.startViewTransition !== "function") {
    applyTheme(theme);
    return;
  }
  document.startViewTransition(() => {
    applyTheme(theme);
  });
}

/**
 * Points every `theme-color` meta at the chosen scheme. `system` restores each
 * tag's own `prefers-color-scheme` color.
 * @param theme - The theme being applied.
 */
function syncThemeColor(theme: Theme): void {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const scheme =
      theme === "system"
        ? meta.getAttribute("media")?.includes("dark")
          ? "dark"
          : "light"
        : theme;
    meta.setAttribute("content", THEME_COLORS[scheme]);
  }
}
