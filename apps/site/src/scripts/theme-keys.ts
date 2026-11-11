/**
 * localStorage key holding the stored theme override, shared by the inline init
 * script and the toggle.
 */
export const THEME_STORAGE_KEY = "afe:theme";

/**
 * Hex values of `--background` in the light and dark schemes, used for the
 * `theme-color` meta tags so the browser chrome matches the page.
 */
export const THEME_COLORS = { light: "#f7faf9", dark: "#0d1715" } as const;
