import { beforeAll, describe, expect, it, vi } from "vitest";

import { emojiSlugFromUrl, installEmojiTransition, nameGalleryTile } from "./emoji-transition";

beforeAll(() => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
});

describe("emojiSlugFromUrl", () => {
  it("reads the slug from an emoji page", () => {
    expect(emojiSlugFromUrl("https://x.test/emojis/waving-hand/")).toBe("waving-hand");
  });

  it("reads the slug from a localized emoji page", () => {
    expect(emojiSlugFromUrl("https://x.test/es/emojis/waving-hand/")).toBe("waving-hand");
    expect(emojiSlugFromUrl("https://x.test/pt-br/emojis/waving-hand/")).toBe("waving-hand");
  });

  it("ignores the gallery and other pages", () => {
    expect(emojiSlugFromUrl("https://x.test/es/emojis/")).toBeUndefined();
    expect(emojiSlugFromUrl("https://x.test/emojis/")).toBeUndefined();
    expect(emojiSlugFromUrl("https://x.test/docs/")).toBeUndefined();
    expect(emojiSlugFromUrl(undefined)).toBeUndefined();
  });
});

describe("nameGalleryTile", () => {
  it("names the matched tile emoji and can clear it", () => {
    const target = { style: { viewTransitionName: "" } };
    const root = {
      querySelector: (selector: string) =>
        selector === '[data-slug="b"] [data-transition-target]' ? target : null,
    } as unknown as ParentNode;
    const clear = nameGalleryTile(root, "b");
    expect(target.style.viewTransitionName).toBe("emoji-b");
    clear?.();
    expect(target.style.viewTransitionName).toBe("");
  });

  it("returns undefined when the tile is not rendered", () => {
    const root = { querySelector: () => null } as unknown as ParentNode;
    expect(nameGalleryTile(root, "zzz")).toBeUndefined();
  });
});

const setup = (activationFrom?: string) => {
  const handlers = new Map<string, (event: unknown) => void>();
  const tile = { style: { viewTransitionName: "" } };
  const target = {
    addEventListener: (name: string, handler: (event: unknown) => void) => {
      handlers.set(name, handler);
    },
    document: {
      querySelector: (selector: string) => (selector.includes('"waving-hand"') ? tile : null),
    },
    navigation: { activation: { from: { url: activationFrom } } },
  };
  installEmojiTransition(target as unknown as typeof globalThis);
  return { handlers, tile };
};

const transition = () => {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  return {
    viewTransition: { finished: promise },
    finish: () => {
      resolve(undefined);
    },
  };
};

describe("installEmojiTransition", () => {
  it("names the tile on pageswap and clears it when the transition ends", async () => {
    const { handlers, tile } = setup();
    const { viewTransition, finish } = transition();
    handlers.get("pageswap")?.({
      viewTransition,
      activation: { entry: { url: "https://x.test/emojis/waving-hand/" } },
    });
    expect(tile.style.viewTransitionName).toBe("emoji-waving-hand");
    finish();
    await viewTransition.finished;
    await Promise.resolve();
    expect(tile.style.viewTransitionName).toBe("");
  });

  it("names the tile on pagereveal from the previous emoji page", () => {
    const { handlers, tile } = setup("https://x.test/emojis/waving-hand/");
    handlers.get("pagereveal")?.({
      viewTransition: transition().viewTransition,
    });
    expect(tile.style.viewTransitionName).toBe("emoji-waving-hand");
  });

  it("ignores events without a transition, an emoji page or a tile", () => {
    const { handlers, tile } = setup("https://x.test/docs/");
    handlers.get("pageswap")?.({ viewTransition: null });
    handlers.get("pagereveal")?.({ viewTransition: null });
    handlers.get("pagereveal")?.({
      viewTransition: transition().viewTransition,
    });
    handlers.get("pageswap")?.({
      viewTransition: transition().viewTransition,
      activation: { entry: { url: "https://x.test/docs/" } },
    });
    handlers.get("pageswap")?.({
      viewTransition: transition().viewTransition,
      activation: { entry: { url: "https://x.test/emojis/unknown/" } },
    });
    expect(tile.style.viewTransitionName).toBe("");
  });
});
