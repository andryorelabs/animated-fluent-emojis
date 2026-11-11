import { ExpressiveCode, loadShikiTheme } from "expressive-code";
import { describe, expect, it } from "vitest";

import { sharedCodeConfig } from "./code-config";

async function createEngine(): Promise<ExpressiveCode> {
  const themes = await Promise.all(sharedCodeConfig.themes.map((name) => loadShikiTheme(name)));
  return new ExpressiveCode({
    ...sharedCodeConfig,
    themes,
    plugins: [...sharedCodeConfig.plugins],
  });
}

describe("shared code configuration", () => {
  it("applies the GitHub themes keyed on the dark class", async () => {
    const engine = await createEngine();
    const { renderedGroupAst } = await engine.render({
      code: "const answer = 42",
      language: "ts",
    });
    const html = JSON.stringify(renderedGroupAst);
    expect(html).toContain("--0:");
    expect(html).toContain("--1:");
    const styles = await engine.getThemeStyles();
    expect(styles).toContain(":root.dark .expressive-code");
  });

  it("applies the token-based style overrides", async () => {
    const engine = await createEngine();
    const styles = await engine.getThemeStyles();
    expect(styles).toContain("--ec-brdRad:12px");
    expect(styles).toContain("--ec-brdCol:var(--border)");
    expect(styles).toContain("--ec-codeBg:var(--card)");
    expect(styles).toContain("--ec-codeFontFml:var(--font-mono)");
    expect(styles).toContain("--ec-lineNumbers-fg:var(--muted-foreground)");
  });

  it("numbers lines in code but not in shell commands", async () => {
    const engine = await createEngine();
    const code = await engine.render({ code: "a\nb", language: "ts" });
    const shell = await engine.render({ code: "bun add x", language: "bash" });
    expect(JSON.stringify(code.renderedGroupAst)).toContain('"gutter"');
    expect(JSON.stringify(shell.renderedGroupAst)).not.toContain('"gutter"');
  });
});
