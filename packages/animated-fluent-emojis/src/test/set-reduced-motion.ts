import { cdp, commands, server } from "vitest/browser";

/**
 * Switches `prefers-reduced-motion` for the current test file. Chromium keeps
 * the per-file CDP session, because `page.emulateMedia` is page-wide and would
 * leak into test files running in parallel; the other engines have no CDP, so
 * they use the page-level browser command.
 * @param value - The media value to emulate.
 */
export const setReducedMotion = async (value: "reduce" | "no-preference"): Promise<void> => {
  if (server.browser === "chromium") {
    await cdp().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value }],
    });
    return;
  }
  await commands.emulateReducedMotion(value);
};
