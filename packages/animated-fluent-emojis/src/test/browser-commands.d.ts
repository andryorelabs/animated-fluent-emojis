import "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (value: "reduce" | "no-preference") => Promise<void>;
  }
}
