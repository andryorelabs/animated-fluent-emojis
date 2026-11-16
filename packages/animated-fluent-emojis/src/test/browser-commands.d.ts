// oxlint-disable-next-line unicorn/require-module-specifiers -- makes this file a module so the declaration below augments vitest/browser instead of replacing it
import type {} from "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (value: "reduce" | "no-preference") => Promise<void>;
  }
}
