import { describe, expect, it, vi } from "vitest";

const { hydrateOnInteraction } = vi.hoisted(() => ({
  hydrateOnInteraction: vi.fn(),
}));

vi.mock("./hydrate-on-interaction", () => ({ hydrateOnInteraction }));

import interactionDirective from "./interaction-directive";

describe("interaction directive", () => {
  it("hands the island element and loader to hydrateOnInteraction", () => {
    const load = vi.fn();
    const element = {} as HTMLElement;
    interactionDirective(load, { name: "interaction", value: "" }, element);
    expect(hydrateOnInteraction).toHaveBeenCalledWith(element, load);
  });
});
