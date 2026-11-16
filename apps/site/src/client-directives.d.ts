// oxlint-disable-next-line unicorn/require-module-specifiers -- makes this file a module so the declaration below augments astro instead of replacing it
import type {} from "astro";

declare module "astro" {
  interface AstroClientDirectives {
    "client:interaction"?: boolean;
  }
}
