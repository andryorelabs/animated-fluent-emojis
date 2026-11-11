import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

/**
 * Astro integration that registers the `client:interaction` directive, which
 * hydrates an island on its first pointer, focus or touch interaction.
 * @returns The integration to register in `astro.config.ts`.
 */
export function interactionDirective(): AstroIntegration {
  return {
    name: "interaction-directive",
    hooks: {
      "astro:config:setup": ({ addClientDirective }) => {
        addClientDirective({
          name: "interaction",
          entrypoint: fileURLToPath(new URL("interaction-directive.ts", import.meta.url)),
        });
      },
    },
  };
}
