import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { interactionDirective } from "./interaction-integration";

describe("interactionDirective integration", () => {
  it("registers the client:interaction directive on config setup", () => {
    const integration = interactionDirective();
    const addClientDirective = vi.fn();
    const setup = integration.hooks["astro:config:setup"];
    expect(integration.name).toBe("interaction-directive");
    expect(setup).toBeDefined();
    void setup?.({ addClientDirective } as never);
    expect(addClientDirective).toHaveBeenCalledWith({
      name: "interaction",
      entrypoint: fileURLToPath(new URL("interaction-directive.ts", import.meta.url)),
    });
  });
});
