import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import type { ExpressiveCodeTheme } from "expressive-code";

const SHELL_LANGUAGES = "bash,sh,shell,zsh,console,powershell";

/**
 * The Expressive Code options shared by the docs (through Starlight) and by the
 * site's own snippet renderer, so a code block looks the same everywhere.
 * Colors come from the brand tokens through CSS variables, and the themes
 * follow the `.dark` class set by the theme script.
 */
export const sharedCodeConfig = {
  themes: ["github-light", "github-dark"],
  themeCssSelector: (theme: ExpressiveCodeTheme): string =>
    theme.type === "dark" ? ".dark" : ":root",
  useDarkModeMediaQuery: false,
  plugins: [pluginLineNumbers()],
  defaultProps: {
    showLineNumbers: true,
    overridesByLang: { [SHELL_LANGUAGES]: { showLineNumbers: false } },
  },
  styleOverrides: {
    borderRadius: "12px",
    borderWidth: "1px",
    borderColor: "var(--border)",
    codeBackground: "var(--card)",
    codeFontFamily: "var(--font-mono)",
    uiFontFamily: "var(--font-sans)",
    lineNumbers: {
      foreground: "var(--muted-foreground)",
      highlightForeground: "var(--foreground)",
    },
    frames: {
      frameBoxShadowCssValue: "none",
    },
  },
} as const;
